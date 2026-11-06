import type { WebSensorKind, WebSensor } from '../../../../../src/web/public'
import { type Experiment, element, tile, action, travel, onRun } from './types'

const sensors: Experiment[] = (['rotation', 'gravity'] as const).map(
  (kind: WebSensorKind): Experiment => ({
    id: `sensor-${kind}`,
    family: 'device',
    title:
      kind === 'rotation'
        ? ['Rotation sensor', 'Sensor de rotação', 'Sensor de rotación', '旋转传感器']
        : ['Gravity sensor', 'Sensor de gravidade', 'Sensor de gravedad', '重力传感器'],
    hint: [
      'Enable on a compatible phone, then tilt it. No simulated readings.',
      'Ative em um celular compatível e incline. Sem leituras simuladas.',
      'Actívalo en un móvil compatible e inclínalo. Sin lecturas simuladas.',
      '在兼容手机上启用后倾斜设备，使用真实读数。',
    ],
    guide: 'web-parity#sensors',
    apis: ['sensor', 'bind'],
    manual: true,
    runLabel: ['Enable sensor', 'Ativar sensor', 'Activar sensor', '启用传感器'],
    code: `const sensor = scope.sensor('${kind}', { coordinates: 'interface' })\n// Call directly from a user gesture:\nawait sensor.requestPermission()\nscope.bind(card, { rotate: scope.map(sensor.z, [-1, 1], [-35, 35]) })\n// Inspect sensor.snapshot(); available requires actual samples.`,
    mount(ctx) {
      const card = tile(ctx, '◎')
      let sensor: WebSensor | undefined
      const readout = element(
        ctx.host,
        'output',
        'lab-device-readout',
        ctx.t([
          'Waiting for permission',
          'Aguardando ativação',
          'Esperando activación',
          '等待启用',
        ]),
      )
      const update = () => {
        if (!sensor || !ctx.alive()) return
        const s = sensor.snapshot()
        readout.textContent = `${s.status} · ${s.samples} ${ctx.t(['samples', 'amostras', 'muestras', '次采样'])}${s.reason ? ` · ${s.reason}` : ''}`
      }
      const run = () => {
        if (!sensor) {
          sensor = ctx.scope.sensor(kind, { coordinates: 'interface', onStatus: update })
          ctx.scope.bind(card, {
            rotate: ctx.scope.map(sensor.z, [-1, 1], [-35, 35]),
            x: ctx.scope.map(sensor.x, [-3, 3], [-travel(ctx), travel(ctx)]),
          })
          ctx.scope.subscribe(sensor.z, update)
        }
        return sensor.requestPermission().then(update)
      }
      onRun(ctx, card, run)
      return { run }
    },
  }),
)

export const deviceExperiments: Experiment[] = [
  ...sensors,
  {
    id: 'haptics',
    family: 'device',
    title: ['Haptics', 'Hápticos', 'Hápticos', '触觉反馈'],
    hint: [
      'A real vibration request. Browser acceptance cannot confirm physical feedback.',
      'Uma solicitação real de vibração. A resposta do navegador não confirma a sensação física.',
      'Una solicitud real de vibración. La respuesta no confirma una sensación física.',
      '发送真实振动请求，浏览器接受不代表已产生实际触感。',
    ],
    guide: 'web-parity#haptics',
    apis: ['haptic'],
    manual: true,
    runLabel: [
      'Request vibration',
      'Solicitar vibração',
      'Solicitar vibración',
      '请求振动',
    ],
    code: `// Inside a click handler:\nconst result = motion.haptic('medium')\n// result.status: requested | unavailable | blocked | disabled\n// requested is not proof of tactile output.`,
    mount(ctx) {
      const card = tile(ctx, '≋')
      const request = (style: 'light' | 'medium' | 'heavy') => {
        const result = ctx.motion.haptic(style)
        ctx.report(`${result.backend} · ${result.status}`)
      }
      const run = () => request('medium')
      onRun(ctx, card, run)
      return {
        run,
        actions: [
          action('light', ['Light', 'Leve', 'Suave', '轻'], () => request('light')),
          action('heavy', ['Heavy', 'Forte', 'Fuerte', '重'], () => request('heavy')),
        ],
      }
    },
  },
  {
    id: 'keyboard',
    family: 'device',
    title: ['Keyboard', 'Teclado', 'Teclado', '键盘'],
    hint: [
      'Focus the field on a phone. Desktop keyboards normally report zero covered pixels.',
      'Foque o campo no celular. Teclados físicos normalmente cobrem zero pixels.',
      'Enfoca el campo en un móvil. Los teclados físicos normalmente cubren cero píxeles.',
      '在手机上聚焦输入框，桌面键盘通常报告遮挡为零。',
    ],
    guide: 'web-platforms#keyboard',
    apis: ['onKeyboard', 'followKeyboard'],
    manual: true,
    runLabel: ['Focus input', 'Focar campo', 'Enfocar campo', '聚焦输入'],
    code: `scope.onKeyboard(state => {\n  // visible, height, backend, accuracy\n  updateReadout(state)\n})\nscope.followKeyboard(composer, { offset: 12 })`,
    mount(ctx) {
      const panel = element(ctx.host, 'div', 'lab-keyboard')
      const output = element(panel, 'output', 'lab-keyboard-state')
      const composer = element(
        panel,
        'label',
        'lab-composer',
        ctx.t(['Write something', 'Escreva algo', 'Escribe algo', '写点什么']),
      )
      const input = element(composer, 'input', '')
      input.placeholder = 'Hello, Jolt.'
      ctx.scope.onKeyboard((state) => {
        output.textContent = `${state.height}px · ${state.backend}\n${state.accuracy}`
      })
      ctx.scope.followKeyboard(composer, { offset: 12 })
      return { run: () => input.focus() }
    },
  },
  {
    id: 'lifecycle',
    family: 'device',
    title: [
      'Playback & lifecycle',
      'Playback e ciclo de vida',
      'Reproducción y ciclo de vida',
      '播放与生命周期',
    ],
    hint: [
      'Play, pause, resume, stop. Inspect real runtime ownership.',
      'Reproduza, pause, retome, pare. Inspecione os recursos reais do runtime.',
      'Reproduce, pausa, reanuda, detén. Inspecciona recursos reales.',
      '播放、暂停、恢复、停止，查看运行时资源。',
    ],
    guide: 'web-lifecycle',
    apis: ['diagnostics', 'stop', 'playbackProgress', 'scope'],
    code: `const owner = motion.scope()\nconst playback = owner.animate(card, { rotate: [0, 360] }, { duration: 4000 })\nconst progress = owner.playbackProgress(playback)\nowner.subscribe(progress, updateReadout)\n// owner.suspend(); owner.resume(); motion.stop(card)\n// On teardown: owner.dispose(); motion.dispose()`,
    mount(ctx) {
      const card = tile(ctx, '✳︎'),
        output = element(ctx.host, 'output', 'lab-device-readout', '0%')
      const owner = ctx.scope.scope()
      const diagnostics = ctx.motion.diagnostics({ development: true, maxEvents: 40 })
      ctx.scope.add(diagnostics)
      let playback: ReturnType<typeof ctx.scope.animate> | undefined,
        off: (() => void) | undefined
      const run = () => {
        off?.()
        playback?.stop()
        playback = owner.animate(card, { rotate: [0, 360] }, { duration: 4000 })
        const progress = ctx.scope.playbackProgress(playback)
        off = ctx.scope.subscribe(progress, (value) => {
          output.textContent = `${Math.round(value * 100)}%`
        })
        return playback
      }
      return {
        run,
        actions: [
          action('pause', ['Pause', 'Pausar', 'Pausar', '暂停'], () => playback?.pause()),
          action('resume', ['Resume', 'Retomar', 'Reanudar', '恢复'], () =>
            playback?.play(),
          ),
          action('stop', ['Stop', 'Parar', 'Detener', '停止'], () =>
            ctx.motion.stop(card),
          ),
          action('inspect', ['Inspect', 'Inspecionar', 'Inspeccionar', '检查'], () => {
            const snapshot = diagnostics.snapshot()
            ctx.report(
              `${snapshot.targets.length} ${ctx.t(['targets', 'alvos', 'objetivos', '目标'])} · ${snapshot.events.length} ${ctx.t(['events', 'eventos', 'eventos', '事件'])}`,
            )
          }),
        ],
      }
    },
  },
]
