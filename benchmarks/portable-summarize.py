"""Summarize raw portable workloads; excludes warmups, never filters measured outliers.
Run from any directory: python3 benchmarks/portable-summarize.py
"""
import json
import math
import statistics
from pathlib import Path

root = Path(__file__).resolve().parent
raw = root/'results/portable-foundations'
lines = ['# Portable workload measurements', '', 'Generated from the committed raw JSON by `python3 benchmarks/portable-summarize.py`. Five measured repetitions per variant/density; one warmup per variant excluded. Cells show median [minimum, maximum], except counts and frame percentiles. CPU/heap counters have different meanings on Android and Chromium: see [method and limitations](portable-foundations.md).', '']
def cell(values):
    values = list(values)
    if not values: return '—'
    return f'{statistics.median(values):.2f} [{min(values):.2f}, {max(values):.2f}]'
def allocation_cell(rr):
    values=[(int(r['recording']['after']['art']['art.gc.bytes-allocated'])-int(r['recording']['before']['art']['art.gc.bytes-allocated']))/1024 for r in rr]
    bad=sum(v<0 for v in values)
    return f'Unavailable ({bad}/5 counter decreases)' if bad else cell(values)

def percentile(values, fraction):
    values = sorted(values)
    return values[max(0, math.ceil(len(values)*fraction)-1)] if values else 0

def table(headers, rows):
    lines.append('| '+' | '.join(headers)+' |')
    lines.append('| '+' | '.join('---' for _ in headers)+' |')
    lines.extend('| '+' | '.join(map(str,row))+' |' for row in rows)
    lines.append('')

native = []
for kind in ['groups','drawing','activity']:
    report = json.loads((raw/('physical-android-'+kind+'.json')).read_text())
    assert report['complete'] and not report['recorded']
    runs = [r for r in report['runs'] if not r['warmup']]
    for density in sorted(set(r['density'] for r in runs)):
        for variant in ['baseline','candidate']:
            rr = [r for r in runs if r['density']==density and r['variant']==variant]
            assert len(rr)==5 and all(not r['recording']['overflow'] for r in rr)
            native.append((kind,density,variant,rr))
lines += ['## Physical Android: cost per workload', '', 'Process CPU is the delta inside the native probe (setup + 1,200 ms motion for groups/drawing; 900 ms motion + 800 ms observation for activity, with instrumentation). ART values are counter deltas, not total allocations. A decreasing counter makes that variant/density unavailable (all raw samples retained). Even monotonic deltas cover only managed memory. RSS delta is ending minus starting resident memory; GC can make it negative. Updates show each run’s median of five targeted updates, then the five-run summary.', '']
table(['Workload','Items','Variant','Setup ms','Update ms','CPU ms','ART KiB','RSS delta MiB'], [
 [kind,density,variant,cell(r['setupMs'] for r in rr),cell(statistics.median(r['updateMs']) for r in rr if r['updateMs']),cell(r['recording']['after']['cpuMs']-r['recording']['before']['cpuMs'] for r in rr),allocation_cell(rr),cell((r['recording']['after']['memoryBytes']-r['recording']['before']['memoryBytes'])/1048576 for r in rr)] for kind,density,variant,rr in native])
lines += ['## Physical Android: scheduling, resources and renderer demand', '', 'Frame cells are medians of each run’s p50/p95/p99 native Choreographer timestamp intervals (ms), **not presented-frame timestamps**. First-write skew is between the three native property setters, not GPU presentation. Views include the common fixture host; resource counts are from the measured subtree after completion, before explicit cleanup.', '']
def native_frames(rr):
    samples = [[b[1]-a[1] for a,b in zip(r['recording']['frames'],r['recording']['frames'][1:])] for r in rr]
    return '/'.join(f'{statistics.median(percentile(s,p) for s in samples):.2f}' for p in [.5,.95,.99])
table(['Workload','Items','Variant','Interval p50/p95/p99 ms','First-write skew ms','Views during → after','Drawing owners during → after','Render callbacks','Renderer active ms'], [
 [kind,density,variant,native_frames(rr),cell(r['nativeFirstWriteSkewMs'] for r in rr if r.get('nativeFirstWriteSkewMs') is not None),f"{rr[0]['counts']['during']['views']} → {rr[0]['counts']['after']['views']}",f"{rr[0]['counts']['during']['shapes']+rr[0]['counts']['during']['batches']} → {rr[0]['counts']['after']['shapes']+rr[0]['counts']['after']['batches']}",cell(r['renderMetrics']['frames'] for r in rr if r.get('renderMetrics')),cell(r['renderMetrics']['activeMs'] for r in rr if r.get('renderMetrics'))] for kind,density,variant,rr in native])

browser = []
for engine in ['chromium','firefox','webkit']:
    report = json.loads((raw/('browser-'+engine+'.json')).read_text())
    assert not report['recorded']
    for kind in ['groups','drawing','activity']:
        for density in ([259,512,1024] if kind=='drawing' else [3]):
            for variant in ['baseline','candidate']:
                rr=[r for r in report['runs'] if not r['warmup'] and r['kind']==kind and r['density']==density and r['variant']==variant]
                assert len(rr)==5 and all(r['ownedEffectsAfterDispose']==0 for r in rr)
                browser.append((engine,kind,density,variant,rr))
lines += ['## Browser scheduling and structure', '', 'RAF interval p95 is the median of each run’s p95 callback interval, not display presentation. DOM counts include fixture descendants; batch SVG intentionally retains one path per item. Zero owned effect nodes remained after disposal in every measured run.', '']
table(['Engine','Workload','Items','Variant','Setup ms','Update ms','RAF p95 ms','DOM nodes','First-write skew ms'], [
 [engine,kind,density,variant,cell(r['setupMs'] for r in rr),cell(statistics.median(r['updateMs']) for r in rr if r['updateMs']),cell(percentile([b-a for a,b in zip(r['frames'],r['frames'][1:])],.95) for r in rr),rr[0]['domDescendants'],cell(r['skewMs'] for r in rr if r['skewMs'] is not None)] for engine,kind,density,variant,rr in browser])
lines += ['## Browser renderer demand', '', 'A small application-owned RAF renderer uses a 1,300 ms guessed stop timer in baseline and actual 900 ms playback completion in candidate. Both wait another 800 ms. This is a policy comparison; baseline could also use completion manually. Actual WebGL uniforms and idle stopping are separately verified by browser acceptance tests and recordings.', '']
table(['Engine','Variant','Render callbacks','Renderer active ms'],[[engine,variant,cell(r['renderFrames'] for r in rr),cell(r['activeMs'] for r in rr)] for engine,kind,density,variant,rr in browser if kind=='activity'])
lines += ['## Chromium main-thread counters', '', '`TaskDuration` is browser main-thread task time (ms), not whole-browser CPU. `JSHeapUsedSize` delta is observed JS heap (KiB), not allocation volume, PSS or total memory; GC can make deltas negative. Other engines expose no equivalent counters in this runner.', '']
def delta(run,key):
    metrics=run['chromium']
    before={v['name']:v['value'] for v in metrics['before']};after={v['name']:v['value'] for v in metrics['after']}
    return after[key]-before[key]
table(['Workload','Items','Variant','Main-thread tasks ms','JS heap delta KiB'],[[kind,density,variant,cell(delta(r,'TaskDuration')*1000 for r in rr),cell(delta(r,'JSHeapUsedSize')/1024 for r in rr)] for engine,kind,density,variant,rr in browser if engine=='chromium'])
(root/'portable-foundations-results.md').write_text('\n'.join(lines)+'\n')
print('Wrote benchmarks/portable-foundations-results.md')
