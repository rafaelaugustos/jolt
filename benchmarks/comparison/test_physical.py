import unittest
from physical import analyze_probe, process_cpu, pss_kib


def stat(cpu, start=100):
    fields = ['S']+['0']*19
    fields[11],fields[12],fields[19] = str(cpu),'3',str(start)
    return '42 (a process ) name) '+' '.join(fields)


def probe(second=(2_000_000_000,3_000_000_000), after_start=100):
    lines = ['CLOCK_TICKS\t100','STAT\tbefore\t1000000000\t'+stat(10),
             'WINDOW_START\t1000000000','INPUT_START\t0\t1500000000',
             'INPUT_START\t1\t2000000000','INPUT_START\t2\t2500000000',
             'WINDOW_END\t3000000000','STAT\tafter\t3000000000\t'+stat(30,after_start)]
    for i,values in enumerate(((500_000_000,1_500_000_000,2_000_000_000),second)):
        lines.append(f'POLL\t{i}\t{1_000_000_000+i*1_000_000_000}')
        for value in values:
            lines.append(f'FENCE\t{i}\t{value-2000}\t{value}\t{value-1000}')
        lines.append(f'POLL_END\t{i}\t{1_000_000_010+i*1_000_000_000}')
    return '\n'.join(lines)


class PhysicalAnalysis(unittest.TestCase):
    def test_pss_formats_and_missing_data(self):
        self.assertEqual(pss_kib('  TOTAL: 90140 TOTAL SWAP PSS: 27'),90140)
        self.assertEqual(pss_kib('  TOTAL PSS: 90140 TOTAL RSS: 100000'),90140)
        with self.assertRaises(AssertionError): pss_kib('TOTAL SWAP PSS: 27')

    def test_cpu_comm_parentheses_and_window_boundaries(self):
        self.assertEqual(process_cpu(stat(10)),{'pid':42,'ticks':13,'startTicks':100})
        result = analyze_probe(probe())
        self.assertEqual(result['presentedFrames'],3)
        self.assertAlmostEqual(result['cpuSeconds'],.2)
        self.assertAlmostEqual(result['cpuSecondsPer30Seconds'],3)
        self.assertEqual(result['presentationGapMs']['max'],1000)
        self.assertIsNone(result['queueToPresentMs'])
        self.assertAlmostEqual(result['frameReadyToPresentMs']['p50'],.001)

    def test_rejects_overwritten_frame_history(self):
        with self.assertRaisesRegex(AssertionError,'history gap'):
            analyze_probe(probe(second=(2_500_000_000,3_000_000_000)))

    def test_rejects_restarted_process_even_when_pid_is_reused(self):
        with self.assertRaisesRegex(AssertionError,'Process restarted'):
            analyze_probe(probe(after_start=101))

    def test_rejects_incomplete_poll(self):
        with self.assertRaisesRegex(AssertionError,'Incomplete presentation poll'):
            analyze_probe(probe().rsplit('\n',1)[0])


if __name__ == '__main__': unittest.main()
