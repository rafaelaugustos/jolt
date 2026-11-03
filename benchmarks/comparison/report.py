"""Validate the full protocol and summarize variability without mixing frame metrics.

python3 benchmarks/comparison/report.py RESULTS_DIRECTORY
"""
import csv, gzip, hashlib, json, re, statistics, sys
from pathlib import Path
root=Path(sys.argv[1]); meta=json.loads((root/'metadata.json').read_text())
assert meta['windowSeconds']==30 and meta['repetitions']==3 and meta['screenRecording'] is False
apps=('jolt','reanimated','flutter'); phases=('normal','app-runtime-block-300ms','ui-thread-block-300ms')
expected={(app,phase,r) for app in apps for phase in phases for r in range(1,4)}
assert len(meta['runs'])==27 and {(r['app'],r['phase'],r['repetition']) for r in meta['runs']}==expected

def spread(values):
    values=[v for v in values if v is not None]
    return {'n':len(values),'median':statistics.median(values) if values else None,
        'min':min(values) if values else None,'max':max(values) if values else None}
def pss(path):
    match=re.search(r'TOTAL PSS:\s*(\d+)',path.read_text()); assert match,path
    return int(match[1])/1024
for run in meta['runs']:
    folder=root/f"{run['repetition']}-{run['phase']}-{run['app']}"
    assert json.loads((folder/'summary.json').read_text())==run
    host=json.loads((folder/'host.json').read_text())
    assert all(x['quiet'] and x['loadAverage1m'] <= x['logicalCpus']*.75 and sum(c['cpuPercent'] for c in x['busyCompilers']) <= x['logicalCpus']*25 for x in host), folder
    archive=folder/'trace.perfetto-trace.gz'
    if archive.exists():
        with gzip.open(archive,'rb') as f:
            hasher=hashlib.sha256()
            for chunk in iter(lambda:f.read(1024*1024),b''): hasher.update(chunk)
            digest=hasher.hexdigest()
        assert digest==run['traceSha256'],archive
    else:
        raise AssertionError(f'Missing retained raw trace: {archive}')
    run['pssBeforeMiB']=pss(folder/'memory-before.txt');run['pssAfterMiB']=pss(folder/'memory-after.txt')
rows=[]
for phase in phases:
    for app in apps:
        runs=[r for r in meta['runs'] if r['phase']==phase and r['app']==app]
        row={'app':app,'phase':phase,'runs':3}
        for metric in ('presentationGapMs','queueToPresentMs','inputHandlingMs','inputAssociatedPresentMs','appFrameTimelineDurationMs','sampledRssBytes'):
            row[metric]={p:spread([r[metric][p] for r in runs]) for p in ('p50','p95','p99','max')}
        for metric in ('presentedFrames','cpuSeconds','pssBeforeMiB','pssAfterMiB','appDeadlineMissed','droppedFrames'):
            row[metric]=spread([r[metric] for r in runs])
        row['warnings']=[{'repetition':r['repetition'],'warnings':r['traceWarnings']} for r in runs if r['traceWarnings']]
        rows.append(row)
result={'scope':meta['scope'],'windowSeconds':30,'repetitions':3,'aggregation':'Each value is the median and range of three run-level statistics. No pooled-frame percentile is presented as a per-run percentile.','rows':rows}
(root/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
def cell(value):
    if value['n']==0:return 'unavailable'
    return f"{value['median']:.2f} ({value['min']:.2f}–{value['max']:.2f})"
lines=['# First comparison results','',
'Android API 36 arm64 emulator; release builds; no screen recording during measurement. Each cell is the **median of three runs (minimum–maximum)**. Each run has five seconds of warmup and a 30-second trace. These are emulator baselines, not physical-device rankings.','',
'| Phase | Stack | Presentation gap p95 (ms) | Maximum gap (ms) | Queue→present p95 (ms) | Input acknowledgement p95 (ms) | CPU seconds / 30 s | Post-run PSS (MiB) |',
'| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for r in rows:
    lines.append('| '+' | '.join([r['phase'],r['app'],cell(r['presentationGapMs']['p95']),cell(r['presentationGapMs']['max']),cell(r['queueToPresentMs']['p95']),cell(r['inputHandlingMs']['p95']),cell(r['cpuSeconds']),cell(r['pssAfterMiB'])])+' |')
lines+=['', 'Presentation is a SurfaceFlinger buffer fence on an emulated display. Queue→present is buffer latency; input acknowledgement is handling latency. Neither identifies the first changed tile pixel or physical input-to-photon response. Missing input/frame associations stay unavailable in the JSON. Optional app FrameTimeline intervals and deadline classifications are retained separately; the tested Flutter SurfaceView does not provide those app records, so they cannot support a cross-stack missed-deadline ranking.', '',
'NativeScript application JS shares Android’s main thread; Reanimated application JS is separate from UI worklets. Flutter’s Dart UI isolate and Android main thread are also separate. Read the two blocking phases as distinct experiments. Static controls exclude ripple/elevation animations that could keep submitting buffers while the tile stalls.', '',
'Raw traces, hashes, configuration, package/APK metadata, source pins, input actions, frame/input/memory CSV and pre/post process dumps accompany these summaries. See `metadata.json`, each run directory and `summary.json`. Startup files retain `am start -W` activity timing; they do not measure first meaningful content. Process PSS includes runtime and caches; it is not texture memory. No regression budget is inferred from this single host/emulator baseline.']
(root/'README.md').write_text('\n'.join(lines)+'\n')
print('PASS 27 complete runs, retained trace integrity and per-run variability')
