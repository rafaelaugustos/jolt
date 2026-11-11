#!/bin/sh
# Builds a release executable against JoltSwiftUI and runs it from a directory holding only that file.
set -eu
cd "$(dirname "$0")"
scratch="${TMPDIR:-/tmp}/jolt-cli-$$"
alone="$scratch/alone"
trap 'rm -rf "$scratch"' EXIT
swift build -c release --scratch-path "$scratch/build"
mkdir -p "$alone"
cp "$(swift build -c release --scratch-path "$scratch/build" --show-bin-path)/JoltCLI" "$alone/"
ls "$alone"
cd "$alone" && ./JoltCLI
