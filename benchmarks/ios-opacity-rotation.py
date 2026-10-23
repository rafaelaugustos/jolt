"""Look for copies of the blue sibling in an unscaled opacity/rotation recording.

Requires Python 3, numpy, ffmpeg and ffprobe. This is a visual investigation aid,
not proof that the renderer is correct. Review the actual video as well.
Usage: python3 benchmarks/ios-opacity-rotation.py --scale 3 recording.mov [...]
"""
import argparse
import json
from pathlib import Path
import subprocess

import numpy as np


def marker_pixels(rgb):
    color = rgb.astype(np.int16)
    return (color[:, :, 2] - color[:, :, 0] > 20) & (color[:, :, 2] > 40)


def outside_count(mask, bounds):
    x1, y1, x2, y2 = bounds
    return int(mask.sum()) - int(mask[y1:y2, x1:x2].sum())


def self_check():
    # Positive control: a second, faint blue copy must be reported. This is
    # detector input in memory only; it is never included in recorded footage.
    frame = np.zeros((60, 60, 3), dtype=np.uint8)
    frame[10:20, 10:20] = [10, 90, 250]
    assert outside_count(marker_pixels(frame), (9, 9, 21, 21)) == 0
    frame[30:40, 30:40] = [5, 20, 50]
    assert outside_count(marker_pixels(frame), (9, 9, 21, 21)) == 100
    frame[30:40, 30:40] = [255, 180, 60]  # The orange SVG is not a copy.
    assert outside_count(marker_pixels(frame), (9, 9, 21, 21)) == 0


def inspect(file, scale):
    metadata = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,nb_frames', '-of', 'json', str(file),
    ]))['streams'][0]
    width, height = metadata['width'], metadata['height']
    decoder = subprocess.Popen([
        'ffmpeg', '-v', 'error', '-i', str(file),
        # Each decoded frame is analyzed once, without frame-rate conversion.
        # Normalizing these pipe-only timestamps avoids simctl VFR mux warnings.
        # Neither the source recording nor its playback timing is changed.
        '-vf', 'setpts=N', '-fps_mode', 'passthrough', '-enc_time_base', '1:600',
        '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
    ], stdout=subprocess.PIPE)
    frames, worst = 0, 0
    anomalous = []
    bounds = None
    minimum, maximum = width * height, 0
    try:
        while True:
            data = decoder.stdout.read(width * height * 3)
            if not data:
                break
            if len(data) != width * height * 3:
                raise ValueError('Truncated decoded frame')
            rgb = np.frombuffer(data, dtype=np.uint8).reshape(height, width, 3)
            mask = marker_pixels(rgb)
            if bounds is None:
                ys, xs = np.nonzero(mask)
                if not len(xs):
                    raise ValueError('The first frame has no blue marker')
                expected = 90 * scale
                for extent in (xs.max() - xs.min() + 1, ys.max() - ys.min() + 1):
                    if abs(extent - expected) > 4:
                        raise ValueError('First marker is not 90pt; check scale, framing and copies')
                # Tolerate H.264 edge ringing outside the original image.
                bounds = (max(0, int(xs.min()) - 3), max(0, int(ys.min()) - 3),
                          min(width, int(xs.max()) + 4), min(height, int(ys.max()) + 4))
            count = int(mask.sum())
            minimum, maximum = min(minimum, count), max(maximum, count)
            outside = outside_count(mask, bounds)
            worst = max(worst, outside)
            if outside > 5:
                anomalous.append({'frame': frames, 'outsidePixels': outside})
            frames += 1
        if decoder.wait() != 0:
            raise ValueError('Video decoding failed')
        expected_frames = metadata.get('nb_frames')
        if not frames or (expected_frames not in (None, 'N/A') and frames != int(expected_frames)):
            raise ValueError('Did not inspect every encoded frame')
    finally:
        decoder.stdout.close()
        if decoder.poll() is None:
            decoder.terminate()
            decoder.wait()
    return {
        'file': file.name, 'frames': frames, 'markerBounds': bounds,
        'maxOutsidePixels': worst, 'bluePixelsRange': [minimum, maximum],
        'anomalousFrames': anomalous,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scale', type=float, default=3, help='Native screen pixels per DIP')
    parser.add_argument('videos', nargs='+', type=Path)
    args = parser.parse_args()
    self_check()
    results = [inspect(file, args.scale) for file in args.videos]
    print(json.dumps(results, indent=2))
    raise SystemExit(1 if any(result['anomalousFrames'] for result in results) else 0)
