"""Execute both production native solvers, including parity and time-step checks."""
import math
import ctypes
import pathlib
import random
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]


class NativeSpringSolver(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="jolt-spring-tests-")
        cls.path = pathlib.Path(cls.temp.name)
        subprocess.run(["cc", "-std=c11", "-Wall", "-Wextra", "-Werror", "-I", str(ROOT / "platforms/ios/src"), str(ROOT / "benchmarks/live-spring-tests/trace.c"), "-lm", "-o", str(cls.path / "trace")], check=True)
        subprocess.run(["javac", "-d", str(cls.path), str(ROOT / "platforms/android/java/org/rafaelaugusto/jolt/SpringState.java"), str(ROOT / "benchmarks/live-spring-tests/Trace.java")], check=True)
        subprocess.run(["cc", "-shared", "-fPIC", "-I", str(ROOT / "platforms/ios/src"), str(ROOT / "benchmarks/live-spring-tests/trace.c"), "-lm", "-o", str(cls.path / "solver.so")], check=True)
        cls.native = ctypes.CDLL(str(cls.path / "solver.so"))
        cls.native.jolt_step.argtypes = [ctypes.POINTER(ctypes.c_double)] + [ctypes.c_double] * 5

    def test_three_link_chain_at_60_and_120_hz_and_after_a_dropped_frame(self):
        def trace(hz, dropped=False, cap=.064):
            states = [(ctypes.c_double * 2)(0, 0) for _ in range(3)]
            now = 0
            result = []
            for frame in range(hz * 4):
                duration = .1 if dropped and frame == hz else 1 / hz
                now += duration
                remaining = min(cap, duration)
                while remaining > 1e-9:
                    dt = min(remaining, 1 / 240)
                    remaining -= dt
                    time = now - remaining
                    target = (180 if int((time + 1e-8) / .25) % 2 == 0 else -180) if time < 2 else 0
                    for state in states:
                        self.native.jolt_step(state, target, 260, 24, 1, dt)
                        target = state[0]
                self.assertTrue(all(math.isfinite(value) for state in states for value in state))
                result.append(tuple(state[0] for state in states))
            self.assertLess(abs(result[-1][-1]), .01)
            return result
        slow, fast = trace(60), trace(120)
        for at60, at120 in zip(slow, fast[1::2]):
            for a, b in zip(at60, at120):
                self.assertAlmostEqual(a, b, delta=1e-6)
        dropped = trace(60, True)
        uncapped = trace(60, True, cap=.1)
        bounded_distance = sum(abs(a - b) for a, b in zip(dropped[60], dropped[59]))
        catchup_distance = sum(abs(a - b) for a, b in zip(uncapped[60], uncapped[59]))
        self.assertLess(bounded_distance, catchup_distance)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def run_cases(self, cases, java=False):
        command = ["java", "-cp", str(self.path), "Trace"] if java else [str(self.path / "trace")]
        output = subprocess.check_output(command, input="\n".join(" ".join(map(str, case)) for case in cases), text=True)
        return [tuple(map(float, line.split())) for line in output.splitlines()]

    def test_native_parity_with_abrupt_targets_and_dropped_frames(self):
        rng = random.Random(52)
        cases = []
        for _ in range(500):
            stiffness, mass = rng.uniform(1, 4000), rng.uniform(.1, 10)
            ratio = rng.choice([0, .15, .8, .9999999, 1, 1.0000001, 1.5, 50])
            cases.append((rng.uniform(-500, 500), rng.uniform(-3000, 3000), rng.choice([-200, 0, 200]), stiffness, 2 * ratio * math.sqrt(stiffness * mass), mass, rng.choice([0, 1 / 120, 1 / 60, .09, .5, 5])))
        c, java = self.run_cases(cases), self.run_cases(cases, True)
        for index, (left, right) in enumerate(zip(c, java)):
            for a, b in zip(left, right):
                self.assertTrue(math.isfinite(a) and math.isfinite(b), index)
                self.assertAlmostEqual(a, b, delta=max(1e-9, abs(a) * 1e-12), msg=str(index))

    def test_step_partition_preserves_trajectory(self):
        for damping in [0, 12, 2 * math.sqrt(260), 70, 10000]:
            initial = (32, -400, -120, 260, damping, 1)
            direct = self.run_cases([(*initial, .2)])[0]
            for hz in [60, 120]:
                state = initial[:2]
                for _ in range(round(.2 * hz)):
                    state = self.run_cases([(*state, *initial[2:], 1 / hz)])[0]
                for a, b in zip(direct, state):
                    self.assertAlmostEqual(a, b, delta=1e-7)

    def test_target_update_does_not_reset_state_or_velocity(self):
        for java in [False, True]:
            state = self.run_cases([(0, 0, 200, 260, 24, 1, .1)], java)[0]
            unchanged = self.run_cases([(*state, -200, 260, 24, 1, 0)], java)[0]
            self.assertEqual(state, unchanged)
            next_state = self.run_cases([(*state, -200, 260, 24, 1, 1e-7)], java)[0]
            self.assertAlmostEqual((next_state[0] - state[0]) / 1e-7, state[1], delta=.02)

    def test_energy_and_equilibrium(self):
        cases = [(10, 25, 0, 260, damping, 1, .5) for damping in [0, 12, 24, 80]]
        for java in [False, True]:
            result = self.run_cases(cases, java)
            initial_energy = .5 * 260 * 10 ** 2 + .5 * 25 ** 2
            for index, (position, velocity) in enumerate(result):
                energy = .5 * 260 * position ** 2 + .5 * velocity ** 2
                if index == 0:
                    self.assertAlmostEqual(energy, initial_energy, delta=1e-8)
                else:
                    self.assertLess(energy, initial_energy)
            self.assertEqual(self.run_cases([(18, 0, 18, 260, 24, 1, 5)], java), [(18, 0)])


if __name__ == "__main__":
    unittest.main()
