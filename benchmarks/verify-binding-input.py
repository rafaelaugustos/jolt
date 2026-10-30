"""Verify real-input windows and teardown. This does not measure input-to-photon latency."""
import argparse
import gzip
import json
import math
from pathlib import Path
from binding_thermal import check_thermal


def verify(report, allow_simulator=False, allow_dirty=False, allow_unavailable_thermal=False):
    assert report['schema'] == 1 and report['completed'] is True
    # Objective-C boxes !TARGET_OS_SIMULATOR as NSNumber 0/1; preserve raw evidence.
    physical = report['device']['physical']
    assert type(physical) in (bool, int) and physical in (0, 1)
    assert physical == 1 or allow_simulator
    assert report['build']['bundleMode'] == 'production'
    assert report['build']['dirty'] is False or allow_dirty
    assert report['input'] in ('drag-js', 'pan-native', 'scroll-js', 'header-native')
    assert report['session']
    events = report['events']
    assert [e['name'] for e in events] == ['start', 'end', 'disposed', 'idle']
    assert all(a['timeMs'] < b['timeMs'] for a,b in zip(events,events[1:]))
    assert all(e['suspensions'] == 0 for e in events)
    start, end, disposed, idle = events
    assert end['timeMs'] - start['timeMs'] >= 4000
    assert idle['timeMs'] - disposed['timeMs'] >= 640
    assert idle['live'] == dict(nodes=0, clock=0)
    for key in ('activeTracks', 'pendingFrames', 'pendingTimers', 'overflow'):
        assert idle['driver'][key] == 0
    for key in ('frameCallbacks', 'frameRequests', 'plays', 'timerCallbacks', 'endCallbacks'):
        assert idle['driver'][key] == disposed['driver'][key], ('Work at rest', key)
    if report['input'] in ('drag-js', 'scroll-js'):
        assert end['jsMoves'] - start['jsMoves'] >= 10, 'No real input events'
    else:
        assert end['jsMoves'] == 0
        assert end['semanticCallbacks'] > start['semanticCallbacks']
    native = report['native']
    assert native['overflow'] == 0
    assert native['columns'] == ['callbackMs', 'timestampMs', 'targetMs', 'xDip', 'scaleX', 'yDip']
    frames = native['frames']
    assert 10 < len(frames) <= 4096
    for frame in frames:
        assert len(frame) == 6 and all(type(n) in (int,float) and math.isfinite(n) for n in frame)
    assert all(a[0] < b[0] for a,b in zip(frames,frames[1:]))
    axis = 5 if report['input'] == 'header-native' else 3
    movement = max(f[axis] for f in frames) - min(f[axis] for f in frames)
    assert movement > 2, 'Bound native view did not move'
    for boundary in ('before', 'after'):
        state = native[boundary]
        check_thermal(state, report['device'], allow_unavailable_thermal)
        assert state['memoryBytes'] > 0 and math.isfinite(state['cpuMs'])
    duration = native['after']['timeMs'] - native['before']['timeMs']
    cpu = native['after']['cpuMs'] - native['before']['cpuMs']
    assert duration >= 4000 and cpu >= 0
    return dict(input=report['input'], physical=report['device']['physical'],
                thermalStatus='unavailable' if native['before']['thermalState'] is None else 'nominal',
                observedMovementDip=movement, durationMs=duration, processCpuMs=cpu,
                jsMoveCallbacks=end['jsMoves']-start['jsMoves'],
                nativeSamples=len(frames), sampledPeakMiB=native['sampledPeakMemoryBytes']/1024**2,
                inputToPhotonLatency='not measured')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', type=Path)
    parser.add_argument('--allow-simulator', action='store_true')
    parser.add_argument('--allow-dirty', action='store_true')
    parser.add_argument('--allow-unavailable-thermal', action='store_true')
    args = parser.parse_args()
    data = gzip.decompress(args.report.read_bytes()) if args.report.suffix == '.gz' else args.report.read_bytes()
    print(json.dumps(verify(json.loads(data), args.allow_simulator, args.allow_dirty,
                           args.allow_unavailable_thermal), indent=2))
