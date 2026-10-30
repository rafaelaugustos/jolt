"""Keep unavailable Android thermal telemetry distinct from a nominal measurement."""


def check_thermal(state, device, allow_unavailable=False):
    thermal = state['thermalState']
    if device.get('thermalStatusAvailable') is False:
        assert thermal is None, 'Unavailable thermal telemetry must not be reported as nominal'
    if thermal is None:
        assert allow_unavailable, 'Thermal status unavailable; not nominal-temperature acceptance'
        api = device.get('apiLevel')
        assert type(api) is int and 21 <= api < 29, 'Unavailable override requires Android API 21–28'
        assert device.get('thermalStatusAvailable') is False
    else:
        assert type(thermal) is int and thermal == 0, 'Non-nominal thermal status'
    assert state['lowPowerMode'] is False, 'Power saving enabled'
