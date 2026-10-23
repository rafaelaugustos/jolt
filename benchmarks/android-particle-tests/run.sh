#!/bin/sh
set -eu
repo=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
classes=$(mktemp -d)
trap 'rm -rf "$classes"' EXIT HUP INT TERM
javac -d "$classes" "$repo/platforms/android/java/org/rafaelaugusto/jolt/ParticleSimulation.java" "$repo/benchmarks/android-particle-tests/ParticleSimulationTest.java"
java -cp "$classes" org.rafaelaugusto.jolt.ParticleSimulationTest
