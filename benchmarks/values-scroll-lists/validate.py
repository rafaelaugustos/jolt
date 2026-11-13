"""Reject recordings whose app-side lifecycle/anchor audit failed, even if taps succeeded."""
def validate(report):
    events=report['events']
    assert not any(e['name']=='error' for e in events),report
    def all_named(name):return [e for e in events if e['name']==name]
    for name in ['values-audit','list-audit']:
        audits=all_named(name)
        assert audits and any(e['scroll']['updates']>5 for e in audits),audits
        assert all(e['scroll']['callbacks']==0 for e in audits),audits
    before=all_named('list-prepend')[0]['before']
    settled=all_named('list-prepend-settled')[0]
    assert settled['done'],settled
    assert settled['after']['key']==before['key'],(before,settled)
    assert abs(settled['after']['top']-before['top'])<=1,(before,settled)
    assert all_named('list-delete-settled')[0]['done'],all_named('list-delete-settled')
    # Sorting around a preserved edge key can legitimately have no overlapping moves.
    # The explicit delete/prepend pair must still prove interruption of active motion.
    assert any(not e['done'] for e in all_named('list-delete-settled')),all_named('list-delete-settled')
    assert all_named('list-sort-settled')[-1]['done'],all_named('list-sort-settled')
    assert all_named('exit-costs'),events
