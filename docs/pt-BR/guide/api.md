# API

## Animando

- `animate(target, keyframes | preset, transition?)` — [paths](./paths), [cores](./colors), [cantos, bordas e sombras](./decorations)
- [`interactionSurface(target)`](./interaction-surface) — alinha a geometria nativa de toque de uma subárvore animada.
- [`animateLayout(container, change?, options?)`](./layout) — anima o próximo layout dos filhos diretos de um container.
- [`animateSize(view, dimensions, change?, options?)`](./size) — anima width/height/auto reais com reorganização de texto, pausa/retomada e ownership pelo scope; executa layout em JS por frame.
- [`motionScope()`](./motion-controllers) — agrupa animações, subscriptions e ciclo de vida.
- [`motionStates(targets, definitions, options?)`](./motion-controllers#estados-nomeados) — estados visuais nomeados com interrupção; [`attach()` e `ref()`](./motion-controllers#views-que-voltam) mantêm o estado em views recriadas, e uma transição pode [separar alvos](./motion-controllers#uma-transicao-por-alvo).
- [`motionValue(initial)`, `bind(target, bindings)`](./motion-values) — um valor controlando várias propriedades e views; `animate()`, `set()` e `stop()` também aceitam um valor. [`scrollValue(scrollView, { axis? })`](./motion-values#offsets-de-rolagem) é um offset de rolagem como valor.
- [`springValue(source, options?)`](./live-springs) — seguidores nativos com continuidade de posição/velocidade, cadeias, mapeamentos numéricos e camadas de transformação/opacidade. Descarte a assinatura com seu escopo.
- [`gestures(surface, options?)`](./gestures) e `GestureSurface` — pan/pinch/rotação nativos, relações entre taps e transferência para ScrollView do core, no entry point opcional `@rafaelaugusto/jolt/gestures`.
- [`bottomSheet(panel, options)`](./bottom-sheet) — sheet opcional dentro da página, com transferência nativa para scroll, snaps dinâmicos, teclado e ações acessíveis.
- [`value.subscribe(listener, { immediate? })`](./motion-values#observando-fora-das-views) — observa números, cores derivadas e valores de scroll em JavaScript; retorna a função para cancelar a assinatura.
- [`animate(value, target, { layer })`, `stop(value, { layer })`](./motion-values#camadas-em-um-valor) — camadas escalares aditivas antes dos mapeamentos.
- [`decay(target, velocity, options?)`](./decay)
- [`gradient(target, options)`](./gradients) — gradientes nativos lineares, radiais e cônicos com componentes estáticos e motion values (`GradientBindings`); retorna um `Gradient` com `bind()`, `animate()`, `set()`, `stop()`, `suspend()`, `resume()`, `suspended` e `remove()`. [`motionScope().gradient()` e `v-gradient`](./gradients#escopos-e-vue) cuidam dele por um escopo ou um template.
- `stop(target, properties?)`
- [`set(target, values)`](./interrupting#aplicar-valores-sem-animar) — aplica valores na hora e para o que estiver animando essas propriedades.
- [`playbackProgress(animation)`](./playback) — progresso observável somente para leitura no relógio da animação existente.
- [`timeline(steps)`](./sequences) — pausa e retoma juntos os passos ativos e pendentes.
- [`@rafaelaugusto/jolt/native`](./native-properties) — registro opcional de propriedades, mapas nativos e câmeras, [luzes e materiais SceneKit](./scene-lighting) e [FOV da câmera](./scene-camera).
- [`sequence(steps)`](./sequences) — passos sobrepostos e posições fixas.
- `press(target, pressed?, transition?)`
- [`drag(target, options?)`](./drag) — com `value`, o gesto controla um [valor de movimento](./motion-values#arrastando) em vez da view.
- [`scrollLinked(scrollView, target, keyframes, { range, axis? })`](./scroll-linked) — retorna uma função de limpeza.
- [`animateItems(list, keyframes | preset, options?)`](./lists) — linhas conforme aparecem, com `once`; retorna uma função de limpeza.
- [`followKeyboard(target, options?)`](./keyboard) — move uma view junto com o teclado no iOS e no Android 7+; retorna uma função de limpeza.
- [`onKeyboard(callback)`](./keyboard#estado-do-teclado) — quanto da janela o teclado cobre, com o timing dele; retorna uma função de limpeza.
- [`symbolEffect(image, effect, options?)`](./symbol-effects) — SF Symbols no iOS.
- [`shimmer(target, options?)`](./shimmer) — placeholders de carregamento no iOS; retorna uma função de limpeza.
- [`liquid(image, options?)`](./liquid) — deformação de textura no iOS; retorna um `LiquidEffect` com `pause()`, `resume()` e `stop()`.
- [`imageEffect(image, name, options?)`](./image-effects) — ripple, distorção por toque e dissolve determinístico, com controles e fallback explícito.
- [`zoomable(image, options?)`](./photo-zoom) — pinch, zoom por toque duplo, pan com limites e intenções de fechamento nativos.
- [`loader(target, options?)`](./loaders) — indicadores de bolinhas, barras e anel no iOS; retorna uma função de limpeza.
- [`reveal(target, options?)`, `conceal(target, options?)`](./reveal) — transições circulares de visibilidade no iOS; retornam uma `Animation`.
- [`animateText(label, options?)`](./text) — entrada de texto por letra ou palavra no iOS e no Android; retorna uma `Animation`.
- [`animateText(label, options?)`](./text) — entrada de texto por letra ou palavra no iOS; retorna uma `Animation`.
- [`rollTo(label, value, options?)`](./rolling) — dígitos rolando no iOS e no Android; retorna uma `Animation`.
- [`confetti(target, options?)`, `particles(target, options?)`](./particles) — efeitos nativos de partículas no iOS e Android; retornam funções de limpeza.

`target` é uma view ou qualquer coisa que contenha uma (um template ref, um `ElementRef`). `animate()`, `decay()`, `stop()`, `set()` e os passos de uma sequência também aceitam arrays de alvos.

As opções de `animate()` também aceitam [`haptic`](./haptics): `light`, `medium`, `heavy`, `{ style, times }` ou `false`. O feedback funciona no iOS e no Android, respeitando as configurações do aparelho.

## Animações

O que `animate()`, `decay()`, `sequence()` e os passos de uma sequência retornam: espere com `await`, leia `finished`, ou chame `stop()`. Resolve com `true` quando tocou até o fim e `false` quando foi parada ou substituída, e o cancelamento não rejeita. Erros de configuração ou de callback de uma sequência podem rejeitar `finished` depois de cancelar o restante.

`animate()` e `decay()` retornam [`PlaybackAnimation`](./playback): o ciclo de vida básico mais `pause()`, `play()`, `progress` gravável e `paused`/`duration` somente para leitura. Sequências e efeitos mantêm o contrato básico de `Animation`.

## Transições

- **Springs**: `'smooth' | 'snappy' | 'bouncy'`, `{ bounce, duration, velocity }` ou `{ stiffness, damping, mass, velocity }`.
- **Tweens**: `{ duration, ease, times, easeTrack }`.
- **Tempo**: `delay`, `repeat`, `repeatType: 'loop' | 'reverse'`, `repeatDelay`, `stagger: number | { each, from }`.
- **Camadas**: [`layer: 'nome'`](./layers) toca por cima das outras animações da propriedade; `stop(target, properties, { layer })` para uma camada.
- **Por propriedade**: qualquer nome de propriedade mapeado para a própria transição.
- **Keyframes relativos**: `{ relative: true }` soma deslocamentos de translação/rotação e multiplica escala/opacidade pelos valores iniciais.

## Helpers

`definePreset(name, preset)`, `presets`, `springs`, [`origamiSpring({ friction, tension })`](./react-native#molas), `cubicBezier`. Veja como registrar [presets personalizados](./presets#presets-personalizados) com nomes tipados.

## Vue

`@rafaelaugusto/jolt/vue` é um ponto de entrada separado para o NativeScript-Vue 3: `vAnimate` (`v-animate`), `vPress` (`v-press`), `JoltTransition`, `transitionHooks(props)`, `useMotionScope()`, `useReducedMotion()`, `useKeyboard()`, `useMotionValue()`, `useBinding()`, `useScrollValue()` e `install(app)`, também a exportação padrão para `app.use()`. Tipos: `AnimateValue`, `PressValue`, `TransitionProps`. Veja o [guia do Vue](./vue).

## Tipos

`Step`, `SequenceOptions`, `SequencePosition`, `JoltConfig`, `KeyframeProperty`, `ScrollLinkedOptions`, `KeyboardOptions`, `ItemsOptions`, `ColorValue`, `ColorKeyframes`, `Keyframes`, `Transition`, `Spring`, `Tween`, `Preset`, `Presets`, `PresetName`, `SpringName`, `Easing`, `Animation`, `Target`, `DecayVelocity`, `DecayOptions`, `SymbolEffect`, `SymbolEffectName`, `SymbolEffectOptions`, `ShimmerOptions`, `LiquidOptions`, `LiquidEffect`, `LoaderOptions`, `LoaderStyle`, `TextOptions`, `RollOptions`, `RevealOptions`, `ConcealOptions`, `Haptic`, `HapticOptions`, `HapticStyle`, `ConfettiOptions`, `ParticleOptions` e o resto exportado pelo pacote.
[`configure({ timeScale })`](./configure) define a velocidade global das animações iniciadas depois da chamada.
[`configure({ timeScale, reducedMotion })`](./configure) define a velocidade global e a preferência de redução de movimento (`'user'`, `'always'` ou `'never'`) das animações iniciadas depois da chamada. [`reducedMotion()` e `onReducedMotion(callback)`](./configure#lendo-a-preferencia) leem e acompanham essa preferência.

## Tipos

- [Ambiente e parâmetros de shader SceneKit](./scene-shaders) — prévia da beta.17: iluminação nativa e uniforms escalares/vetoriais tipados.
