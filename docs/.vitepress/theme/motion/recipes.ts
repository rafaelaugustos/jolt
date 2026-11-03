import type { Words } from './copy'

export type Category = 'Motion' | 'Touch' | 'Visual' | 'Type' | 'Layout'
export interface Recipe {
  slug: string
  title: Words
  description: Words
  category: Category
  video: string
  guide: string
  source: string
  color: string
  platform: string
  caption: Words
  project?: {
    name: string
    repository: string
    revision: string
    sha256: string
    joltVersion: string
    showcaseAnchor: string
  }
  requirements?: Words
  guideAnchor?: string
}
export function recipeSourceUrl(recipe: Recipe) {
  return recipe.project
    ? `https://github.com/${recipe.project.repository}/blob/${recipe.project.revision}/${recipe.source}`
    : `https://github.com/rafaelaugustos/jolt/blob/main/demo/src/${recipe.source}`
}
const ios: Words = [
  'iOS 26 simulator · native playback with actual XCTest input, original speed. Not a physical-device performance measurement.',
  'Simulador iOS 26 · execução nativa com interação real via XCTest, velocidade original. Não é uma medição em aparelho físico.',
  'Simulador iOS 26 · ejecución nativa con interacción real vía XCTest, velocidad original. No mide el rendimiento de un dispositivo físico.',
  'iOS 26 模拟器 · 真实 XCTest 输入与原生播放，原始速度。并非真机性能测试。',
]
const revealCaption = ios.map(
  (caption, i) =>
    caption +
    [
      ' The app selects a 1600 ms reveal.',
      ' O app seleciona uma revelação de 1600 ms.',
      ' La app selecciona una revelación de 1600 ms.',
      ' 应用内选择了 1600 毫秒的揭示时长。',
    ][i],
) as unknown as Words
const driveProject = {
  name: 'Jolt Drive',
  repository: 'rafaelaugustos/jolt-drive',
  revision: '2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f',
  joltVersion: '0.1.0-rc.10',
  showcaseAnchor: 'jolt-drive',
}
const driveCaption: Words = [
  'Jolt Drive · iPhone 17 Pro simulator, iOS 26.2. Real idb interaction in the native app, original speed. English UI; not a physical-device recording or performance measurement.',
  'Jolt Drive · simulador iPhone 17 Pro, iOS 26.2. Interação real via idb no app nativo, velocidade original. Interface em inglês; não é gravação em aparelho físico nem medição de desempenho.',
  'Jolt Drive · simulador iPhone 17 Pro, iOS 26.2. Interacción real mediante idb en la app nativa, velocidad original. Interfaz en inglés; no es una grabación de dispositivo físico ni una medición de rendimiento.',
  'Jolt Drive · iPhone 17 Pro 模拟器，iOS 26.2。通过 idb 在原生应用中执行真实交互，保持原始速度。英文界面；非真机录屏，也不是性能测试。',
]
export const categoryNames: Record<Category, Words> = {
  Motion: ['Motion', 'Movimento', 'Movimiento', '运动'],
  Touch: ['Touch & gestures', 'Toque e gestos', 'Toque y gestos', '触控与手势'],
  Visual: ['Visual effects', 'Efeitos visuais', 'Efectos visuales', '视觉效果'],
  Type: ['Typography', 'Tipografia', 'Tipografía', '文字'],
  Layout: ['Layout', 'Layout', 'Layout', '布局'],
}
export const hexdropCaption: Words = [
  'Hexdrop on iOS: creator-provided recording of the animated launch, dragging, brewing, document picker and replay. Original speed, no audio; the first 3.8 seconds of the system home and launch transition are omitted. Capture device unspecified. Local demo; no file is uploaded.',
  'Hexdrop no iOS: gravação enviada pelo criador com abertura animada, arraste, preparo da poção, seletor de documentos e replay. Velocidade original, sem áudio; os primeiros 3,8 segundos da tela inicial e transição do sistema foram omitidos. Dispositivo não informado. Demo local; nenhum arquivo é enviado.',
  'Hexdrop en iOS: grabación del creador con apertura animada, arrastre, preparación, selector de documentos y repetición. Velocidad original, sin audio; se omiten los primeros 3,8 segundos de la pantalla de inicio y transición del sistema. Dispositivo no especificado. Demo local; no se suben archivos.',
  'Hexdrop iOS 创作者录屏：动画开场、拖动、酿制、文档选择与重播。原始速度，无音频；省略最初 3.8 秒的系统主屏幕与启动转场。录制设备未说明。本地演示，不上传文件。',
]
export const recipes: Recipe[] = [
  {
    slug: 'hexdrop-launch',
    title: [
      'A little opening spell.',
      'Um feitiço de abertura.',
      'Un hechizo de apertura.',
      '开场的小魔法。',
    ],
    description: [
      'A floating potion, a traced seal and a soft reveal into the app.',
      'Uma poção flutua, o selo se desenha e o app aparece.',
      'Una poción flotante, un sello que se dibuja y la entrada a la app.',
      '魔药轻浮，印记绘出，柔和揭开应用。',
    ],
    category: 'Motion',
    video: 'hexdrop-launch-ios',
    guide: 'hexdrop-recipes',
    guideAnchor: 'launch',
    source: 'src/launch/launch-animation.ts',
    color: '#c8dea1',
    platform: 'iOS',
    caption: [
      'Hexdrop launch on iOS: the 3.8–7.0 second excerpt of the creator-provided recording. Floating mark, traced seal, particles, light wave and app reveal. English UI, original speed, no audio. Capture device unspecified; not a performance measurement.',
      'Abertura do Hexdrop no iOS: trecho de 3,8 a 7,0 segundos da gravação enviada pelo criador. Marca flutuante, selo desenhado, partículas, onda de luz e revelação do app. Interface em inglês, velocidade original, sem áudio. Dispositivo não informado; não é medição de desempenho.',
      'Apertura de Hexdrop en iOS: fragmento de 3,8 a 7,0 segundos de la grabación del creador. Marca flotante, sello trazado, partículas, onda de luz y revelación de la app. Interfaz en inglés, velocidad original, sin audio. Dispositivo no especificado; no mide rendimiento.',
      'Hexdrop iOS 开场：创作者录屏中 3.8 至 7.0 秒的片段。悬浮图案、印记描边、粒子、光波与应用揭示。英文界面，原始速度，无音频。录制设备未说明；非性能测试。',
    ],
    project: {
      name: 'Hexdrop',
      repository: 'rafaelaugustos/hexdrop',
      revision: 'ebdc02a2652051c982779ea43ba3d76cf99bb538',
      joltVersion: '0.1.0-rc.11',
      showcaseAnchor: 'hexdrop',
      sha256: '23a0f5463b4e38c651707e1bbb956e86b0573bab9831b1b38bc0eb657fcd87bd',
    },
    requirements: [
      'NativeScript-Vue 3 and Jolt RC.11. Supply the measured, mounted native GridLayout and child IDs from LaunchScreen.vue, its styles and hexdrop-mark.png. Keep drawing surfaces at fixed bounds and transform their containers. The reveal callback mounts app content and awaits nextTick before the overlay fades. Own the returned handle, await finished and call dispose on permanent unload; preserve the reduced-motion branch and failure fallback. The system launch screen is static; this timeline starts after NativeScript is ready. iOS simulator playback only.',
      'NativeScript-Vue 3 e Jolt RC.11. Forneça o GridLayout nativo montado e medido, os IDs de LaunchScreen.vue, seus estilos e hexdrop-mark.png. Preserve as superfícies de desenho em tamanho fixo e transforme os contêineres. O callback reveal monta o conteúdo e aguarda nextTick antes do fade. Guarde o handle, aguarde finished e chame dispose no descarte permanente; preserve redução de movimento e fallback de falha. A tela de inicialização do sistema é estática; a timeline começa quando o NativeScript está pronto. Execução verificada no simulador iOS.',
      'NativeScript-Vue 3 y Jolt RC.11. Proporciona el GridLayout nativo montado y medido, los IDs de LaunchScreen.vue, sus estilos y hexdrop-mark.png. Mantén las superficies de dibujo con tamaño fijo y transforma sus contenedores. reveal monta el contenido y espera nextTick antes del fade. Conserva el handle, espera finished y llama a dispose al descargar permanentemente; preserva movimiento reducido y recuperación de errores. La pantalla de inicio del sistema es estática; la timeline comienza cuando NativeScript está listo. Verificado en simulador iOS.',
      '需要 NativeScript-Vue 3 和 Jolt RC.11。提供挂载并测量后的原生 GridLayout、LaunchScreen.vue 的子视图 ID、样式和 hexdrop-mark.png。绘图表面保持固定边界，变换其容器。reveal 回调挂载内容并等待 nextTick 后淡出遮罩。保留返回句柄，等待 finished，永久卸载时调用 dispose；保留减少动态效果和故障回退分支。系统启动屏是静态的；NativeScript 就绪后才播放此时间线。仅验证 iOS 模拟器。',
    ],
  },
  {
    slug: 'hexdrop-drag',
    title: [
      'Drop a little magic.',
      'Solte um pouco de magia.',
      'Suelta un poco de magia.',
      '拖出一点魔法。',
    ],
    description: [
      'A file card that tilts, springs home or disappears into a potion.',
      'Um card que inclina, volta com spring ou desaparece em uma poção.',
      'Una tarjeta que se inclina, vuelve con un resorte o desaparece en una poción.',
      '文件卡片倾斜跟手，弹回原位，或融入魔药。',
    ],
    category: 'Touch',
    video: 'hexdrop-native-ios',
    guide: 'hexdrop-recipes',
    guideAnchor: 'ingredient-drag',
    source: 'src/composables/useIngredientDrag.ts',
    color: '#d7c4ed',
    platform: 'iOS',
    caption: [
      'Hexdrop · iPhone 17 Pro simulator, iOS 26.2. Real idb drags: spring return, accepted drop, ignition, fill and stopper swing. English UI, original speed, silent capture. Local interaction demo; no file is uploaded. Not a physical-device performance measurement.',
      'Hexdrop · simulador iPhone 17 Pro, iOS 26.2. Arrastes reais via idb: retorno com spring, drop aceito, ignição, preenchimento e balanço da tampa. Interface em inglês, velocidade original, captura sem áudio. Demo local; nenhum arquivo é enviado. Não mede desempenho em aparelho físico.',
      'Hexdrop · simulador iPhone 17 Pro, iOS 26.2. Arrastres reales mediante idb: retorno con resorte, drop aceptado, ignición, llenado y balanceo del tapón. Interfaz en inglés, velocidad original, captura sin audio. Demo local; no se sube ningún archivo. No mide rendimiento en dispositivo físico.',
      'Hexdrop · iPhone 17 Pro 模拟器，iOS 26.2。真实 idb 拖动：弹回、成功投放、点火、填充和瓶塞摆动。英文界面，原始速度，无声录屏。仅为本地交互演示，不上传文件。非真机性能测试。',
    ],
    project: {
      name: 'Hexdrop',
      repository: 'rafaelaugustos/hexdrop',
      revision: 'ebdc02a2652051c982779ea43ba3d76cf99bb538',
      joltVersion: '0.1.0-rc.11',
      showcaseAnchor: 'hexdrop',
      sha256: '30c54e558f33fbd086f2e642c7ecc94598f8f1b07535cefaa30da2f2b1ccccaf',
    },
    requirements: [
      'NativeScript-Vue 3 and Jolt RC.11. Call useIngredientDrag during setup; wire loaded and tap to the native card. Supply disabled, window-space target bounds, onStart, onHover and onDrop. Copy transformedRect, intersects and Rect from the pinned potion/geometry.ts. Keep gesture ownership separate from the feedback scope and preserve disposal/background guards. This hook does not draw the potion or upload files; the full scene lives in potion-view.ts. Only iOS simulator playback was verified.',
      'NativeScript-Vue 3 e Jolt RC.11. Chame useIngredientDrag no setup; conecte loaded e tap ao card nativo. Forneça disabled, limites do alvo nas coordenadas da janela, onStart, onHover e onDrop. Copie transformedRect, intersects e Rect de potion/geometry.ts na revisão indicada. Mantenha o gesto separado do scope de feedback e preserve descarte e proteções de background. O hook não desenha a poção nem envia arquivos; a cena está em potion-view.ts. Execução verificada apenas no simulador iOS.',
      'NativeScript-Vue 3 y Jolt RC.11. Llama a useIngredientDrag durante setup; conecta loaded y tap a la tarjeta nativa. Proporciona disabled, límites del destino en coordenadas de ventana, onStart, onHover y onDrop. Copia transformedRect, intersects y Rect del potion/geometry.ts fijado. Separa el gesto del scope de feedback y conserva limpieza y protecciones de segundo plano. El hook no dibuja la poción ni sube archivos; la escena está en potion-view.ts. Solo se verificó la ejecución en simulador iOS.',
      '需要 NativeScript-Vue 3 和 Jolt RC.11。在 setup 中调用 useIngredientDrag，将 loaded 和 tap 连接到原生卡片。提供 disabled、窗口坐标系中的目标边界、onStart、onHover 和 onDrop。复制固定版本 potion/geometry.ts 中的 transformedRect、intersects 和 Rect。将手势所有权与反馈 scope 分开，保留清理和后台保护。此 hook 不绘制魔药，也不上传文件；完整场景在 potion-view.ts 中。仅验证了 iOS 模拟器运行。',
    ],
  },
  {
    slug: 'drive-cockpit',
    title: [
      'Pull the whole scene.',
      'Puxe a cena inteira.',
      'Mueve toda la escena.',
      '牵动整个场景。',
    ],
    description: [
      'The cockpit, camera framing and card reveals follow one drag.',
      'Cockpit, enquadramento e cards acompanham o mesmo arraste.',
      'El cockpit, el encuadre y las tarjetas siguen un mismo arrastre.',
      '一次拖动，联动控制台、镜头构图与卡片。',
    ],
    category: 'Touch',
    video: 'drive-cockpit-ios',
    guide: 'drive-recipes',
    guideAnchor: 'cockpit',
    source: 'src/pages/Home/useCockpitGesture.ts',
    color: '#c6dfaa',
    platform: 'iOS',
    caption: driveCaption,
    project: {
      ...driveProject,
      sha256: '3ca05662736fbc921cbcc3956c99ed4bd476618219373addddc01631ee4bc287',
    },
    requirements: [
      'Use NativeScript-Vue template refs named root (GestureSurface) and scrollContent (ScrollView), an offset motion value, measured height/closed positions and active state. Home and ControlSheet map that offset to the camera and cards; the gesture hook alone does not create a 3D scene.',
      'Use refs de NativeScript-Vue chamadas root (GestureSurface) e scrollContent (ScrollView), um motion value offset, posições height/closed medidas e estado active. Home e ControlSheet mapeiam esse offset para câmera e cards; o hook de gesto sozinho não cria a cena 3D.',
      'Usa refs de NativeScript-Vue llamadas root (GestureSurface) y scrollContent (ScrollView), un motion value offset, posiciones height/closed medidas y estado active. Home y ControlSheet conectan ese offset con la cámara y las tarjetas; el hook no crea la escena 3D.',
      '需要 NativeScript-Vue 模板 ref：root（GestureSurface）和 scrollContent（ScrollView），以及 offset 动效值、测量后的 height/closed 位置和 active 状态。Home 与 ControlSheet 将 offset 映射到镜头和卡片；手势 hook 本身不创建 3D 场景。',
    ],
  },
  {
    slug: 'drive-atmosphere',
    title: [
      'A mood that follows you.',
      'Uma atmosfera que acompanha você.',
      'Un ambiente que te sigue.',
      '氛围随你而动。',
    ],
    description: [
      'Retarget color, border and shape through one selection spring.',
      'Cor, borda e forma respondem à mesma spring de seleção.',
      'Color, borde y forma responden al mismo resorte de selección.',
      '一个选择弹簧，联动颜色、边框与形状。',
    ],
    category: 'Visual',
    video: 'drive-atmosphere-ios',
    guide: 'drive-recipes',
    guideAnchor: 'atmosphere',
    source: 'src/pages/Home/AtmosphereOption.vue',
    color: '#c9b7ea',
    platform: 'iOS',
    caption: driveCaption,
    project: {
      ...driveProject,
      sha256: '64f8dcd6f1313287c816219f588de68fd5bc9dd436c2ef1969ba0184997d1019',
    },
    requirements: [
      'Provide name, color and selected props, handle the select event, and install the Jolt Vue plugin for v-press. Copy or replace the project’s springs.snap and withAlpha helpers. The parent owns which option is selected; SceneKit is not required.',
      'Forneça name, color e selected, trate o evento select e instale o plugin Vue do Jolt para v-press. Copie ou substitua os helpers springs.snap e withAlpha do projeto. O pai controla a opção selecionada; SceneKit não é necessário.',
      'Proporciona name, color y selected, gestiona select e instala el plugin Vue de Jolt para v-press. Copia o sustituye springs.snap y withAlpha. El padre controla la selección; no requiere SceneKit.',
      '提供 name、color、selected，处理 select 事件，并安装 Jolt Vue 插件以使用 v-press。复制或替换 springs.snap 与 withAlpha 辅助函数。父组件管理选中项，无需 SceneKit。',
    ],
  },
  {
    slug: 'drive-charge-sheet',
    title: [
      'Bring the controls forward.',
      'Traga os controles para perto.',
      'Acerca los controles.',
      '让控件走到眼前。',
    ],
    description: [
      'A draggable charge sheet stays sharp while the garage blurs away.',
      'Um painel de carga arrastável fica nítido enquanto a garagem desfoca.',
      'Un panel de carga arrastrable permanece nítido mientras el garaje se desenfoca.',
      '充电面板清晰可拖动，背景车库渐渐虚化。',
    ],
    category: 'Touch',
    video: 'drive-charge-sheet-ios',
    guide: 'drive-recipes',
    guideAnchor: 'charge-sheet',
    source: 'src/pages/Home/EnergyPlan.vue',
    color: '#c7e594',
    platform: 'iOS',
    caption: driveCaption,
    project: {
      ...driveProject,
      sha256: '92a4a14dc845baa0663260e4eab00cfe2663a48e56f092dd134e0814e657f812',
    },
    requirements: [
      'Register GestureSurface and Jolt’s Vue directives. Supply accent, level, limit and the mounted garage background view; render the sheet as its sibling. Adapt Icon, safeArea and theme helpers. Handle save/close without unmounting before dismissal finishes.',
      'Registre GestureSurface e as diretivas Vue do Jolt. Forneça accent, level, limit e a view montada da garagem como background; renderize o painel como irmão dela. Adapte Icon, safeArea e os helpers de tema. Trate save/close sem desmontar antes do fim da saída.',
      'Registra GestureSurface y las directivas Vue de Jolt. Proporciona accent, level, limit y la vista montada del garaje como background; el panel debe ser su hermano. Adapta Icon, safeArea y el tema. Gestiona save/close sin desmontar antes de terminar la salida.',
      '注册 GestureSurface 与 Jolt Vue 指令，提供 accent、level、limit 和已挂载的车库 background 视图；面板应为其同级元素。适配 Icon、safeArea 和主题辅助函数。处理 save/close 时等待退出完成再卸载。',
    ],
  },
  {
    slug: 'drive-cabin',
    title: [
      'Step into the scene.',
      'Entre na cena.',
      'Entra en la escena.',
      '走入场景之中。',
    ],
    description: [
      'Move from an orbiting camera to the cabin, then back outside.',
      'Passe da câmera orbital à cabine e volte para fora.',
      'Pasa de una cámara orbital a la cabina y vuelve al exterior.',
      '从环绕镜头进入座舱，再回到车外。',
    ],
    category: 'Motion',
    video: 'drive-cabin-ios',
    guide: 'drive-recipes',
    guideAnchor: 'cabin',
    source: 'src/components/scene/Car3D.vue',
    color: '#b7d9e4',
    platform: 'iOS · SceneKit',
    caption: driveCaption,
    project: {
      ...driveProject,
      sha256: 'd7f5f59b37c3f3d160d4a6b1e1ff48d810a26fe678655d56f9e39b30371b6626',
    },
    requirements: [
      'iOS only. Requires the project’s SceneView/createCarStage renderer, camera-path helpers, model, materials and ClimatePanel, plus @rafaelaugusto/jolt-native. Use your own scene measurements. Car3D is the complete source, not a standalone camera helper or a Web implementation.',
      'Exclusivo do iOS. Requer SceneView/createCarStage, helpers camera-path, modelo, materiais e ClimatePanel do projeto, além de @rafaelaugusto/jolt-native. Use as medidas da sua cena. Car3D é o arquivo completo, não um helper isolado de câmera nem uma implementação Web.',
      'Solo iOS. Requiere SceneView/createCarStage, camera-path, modelo, materiales y ClimatePanel del proyecto, además de @rafaelaugusto/jolt-native. Usa las medidas de tu escena. Car3D es el archivo completo, no un helper aislado ni una implementación Web.',
      '仅支持 iOS。依赖项目的 SceneView/createCarStage、camera-path、模型、材质、ClimatePanel 及 @rafaelaugusto/jolt-native。应使用自己的场景尺寸。Car3D 是完整源文件，并非独立镜头函数或 Web 实现。',
    ],
  },
  {
    slug: 'spring-feeling',
    title: [
      'A spring with feeling.',
      'Uma spring com personalidade.',
      'Un resorte con personalidad.',
      '有生命力的弹簧。',
    ],
    description: [
      'Interrupt it. Change direction. Keep the momentum.',
      'Interrompa. Mude a direção. Preserve o impulso.',
      'Interrumpe. Cambia de dirección. Conserva el impulso.',
      '随时打断、改变方向，动量依然流畅。',
    ],
    category: 'Motion',
    video: 'showcase-springs-ios',
    guide: 'transitions',
    source: 'showcase/MotionStudio.vue',
    color: '#d5ef8a',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'press-feedback',
    title: [
      'Made to be pressed.',
      'Feito para apertar.',
      'Hecho para pulsar.',
      '为触碰而生。',
    ],
    description: [
      'A little resistance. A satisfying release.',
      'Uma leve resistência. Uma resposta que dá gosto.',
      'Un poco de resistencia. Una respuesta que se siente bien.',
      '轻轻按下，感受恰到好处的回弹。',
    ],
    category: 'Touch',
    video: 'motion-recipe-press-ios',
    guide: 'press',
    source: 'components/Press.vue',
    color: '#ded3fc',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'drag-and-snap',
    title: [
      'Let it find its place.',
      'Deixe encontrar seu lugar.',
      'Que encuentre su lugar.',
      '找到它的位置。',
    ],
    description: [
      'Drag, release and settle into the next snap point.',
      'Arraste, solte e encaixe no próximo ponto.',
      'Arrastra, suelta y encaja en el siguiente punto.',
      '拖动、松手，自然吸附到下一个位置。',
    ],
    category: 'Touch',
    video: 'motion-recipe-drag-ios',
    guide: 'drag',
    source: 'components/DragLab.vue',
    color: '#f2ba9c',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'stagger',
    title: [
      'A beautiful ripple.',
      'Uma onda de movimento.',
      'Una onda de movimiento.',
      '层层涟漪。',
    ],
    description: [
      'One entrance becomes a whole choreography.',
      'Uma entrada vira uma coreografia inteira.',
      'Una entrada se convierte en toda una coreografía.',
      '一次入场，演绎整段编舞。',
    ],
    category: 'Motion',
    video: 'motion-recipe-stagger-ios',
    guide: 'stagger',
    source: 'components/Stagger.vue',
    color: '#b9d8ed',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'live-springs',
    title: [
      'Follow the feeling.',
      'Siga o movimento.',
      'Sigue el movimiento.',
      '跟随每一刻。',
    ],
    description: [
      'A chain of springs that stays connected to your input.',
      'Uma cadeia de springs conectada ao seu toque.',
      'Una cadena de resortes conectada a tu toque.',
      '一串弹簧，始终回应你的输入。',
    ],
    category: 'Motion',
    video: 'motion-recipe-followers-ios',
    guide: 'live-springs',
    source: 'components/LiveSprings.vue',
    color: '#d6ed92',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'gradients',
    title: [
      'Change the atmosphere.',
      'Mude a atmosfera.',
      'Cambia la atmósfera.',
      '改变氛围。',
    ],
    description: [
      'Color, light and direction, always in motion.',
      'Cor, luz e direção em movimento.',
      'Color, luz y dirección en movimiento.',
      '让色彩、光线与方向流动起来。',
    ],
    category: 'Visual',
    video: 'motion-recipe-gradients-ios',
    guide: 'gradients',
    source: 'components/Gradients.vue',
    color: '#e1b4c6',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'rolling-numbers',
    title: [
      'Every number counts.',
      'Cada número conta.',
      'Cada número cuenta.',
      '每个数字都有故事。',
    ],
    description: [
      'Turn a changing value into a moment worth noticing.',
      'Transforme uma mudança de valor em um detalhe especial.',
      'Convierte un cambio de valor en un detalle especial.',
      '让每次数值变化都值得留意。',
    ],
    category: 'Type',
    video: 'motion-recipe-rolling-ios',
    guide: 'rolling',
    source: 'components/Rolling.vue',
    color: '#f2d5a0',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'confetti',
    title: [
      'A little celebration.',
      'Uma pequena celebração.',
      'Una pequeña celebración.',
      '值得庆祝的瞬间。',
    ],
    description: [
      'Give the good moments a proper send-off.',
      'Dê aos bons momentos a resposta que merecem.',
      'Dale a los buenos momentos la respuesta que merecen.',
      '为美好的时刻，添上一场彩纸雨。',
    ],
    category: 'Visual',
    video: 'motion-recipe-confetti-ios',
    guide: 'particles',
    source: 'components/Particles.vue',
    color: '#bdcfed',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'living-layout',
    title: [
      'Make a little room.',
      'Abra um espaço.',
      'Haz un poco de espacio.',
      '腾出一点空间。',
    ],
    description: [
      'Insert, reorder and expand. Everything moves together.',
      'Insira, reordene e expanda. Tudo se move junto.',
      'Inserta, reordena y expande. Todo se mueve junto.',
      '插入、重排、展开，让所有元素一起流动。',
    ],
    category: 'Layout',
    video: 'motion-recipe-layout-ios',
    guide: 'layout',
    source: 'components/LayoutLab.vue',
    color: '#c6d3bb',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'circular-reveal',
    title: [
      'Something to reveal.',
      'Algo para revelar.',
      'Algo que revelar.',
      '惊喜即将揭晓。',
    ],
    description: [
      'A new surface unfolds from a single point.',
      'Uma nova superfície surge de um único ponto.',
      'Una nueva superficie surge de un solo punto.',
      '从一个点，展开全新的画面。',
    ],
    category: 'Visual',
    video: 'motion-recipe-reveal-ios',
    guide: 'reveal',
    source: 'components/Reveal.vue',
    color: '#d4c4e9',
    platform: 'iOS',
    caption: revealCaption,
  },
  {
    slug: 'motion-paths',
    title: [
      'Take the scenic route.',
      'Escolha outro caminho.',
      'Elige otro camino.',
      '沿途皆是风景。',
    ],
    description: [
      'Curves, arcs and a little sense of adventure.',
      'Curvas, arcos e um pouco de aventura.',
      'Curvas, arcos y un poco de aventura.',
      '曲线、弧线，还有一点冒险精神。',
    ],
    category: 'Motion',
    video: 'motion-recipe-paths-ios',
    guide: 'paths',
    source: 'components/MotionPath.vue',
    color: '#b9dbce',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'bottom-sheet',
    title: [
      'It all comes together.',
      'Tudo se conecta.',
      'Todo se conecta.',
      '一切自然衔接。',
    ],
    description: [
      'A sheet that drags, scrolls and follows the keyboard.',
      'Um painel que arrasta, rola e acompanha o teclado.',
      'Un panel que se arrastra, desplaza y sigue al teclado.',
      '拖动、滚动、跟随键盘的底部面板。',
    ],
    category: 'Touch',
    video: 'bottom-sheet-ios',
    guide: 'bottom-sheet',
    source: 'components/BottomSheetLab.vue',
    color: '#e9c49d',
    platform: 'iOS',
    caption: ios,
  },
]
