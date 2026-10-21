# API

## Animando

- `animate(target, keyframes | preset, transition?)` — [paths](./paths), [cores](./colors), [cantos, bordas e sombras](./decorations)
- [`interactionSurface(target)`](./interaction-surface) — alinha a geometria nativa de toque de uma subárvore animada.
- [`animateLayout(container, change?, options?)`](./layout) — anima o próximo layout dos filhos diretos de um container.
- [`motionScope()`](./motion-controllers) — agrupa animações, subscriptions e ciclo de vida.
- [`motionStates(targets, definitions, options?)`](./motion-controllers#estados-nomeados) — estados visuais nomeados com interrupção.
- [`decay(target, velocity, options?)`](./decay)
- `stop(target, properties?)`
- [`set(target, values)`](./interrupting#aplicar-valores-sem-animar) — aplica valores na hora e para o que estiver animando essas propriedades.
- [`sequence(steps)`](./sequences) — passos sobrepostos e posições fixas.
- `press(target, pressed?, transition?)`
- [`drag(target, options?)`](./drag)
- [`scrollLinked(scrollView, target, keyframes, { range, axis? })`](./scroll-linked) — retorna uma função de limpeza.
- [`animateItems(list, keyframes | preset, options?)`](./lists) — linhas conforme aparecem, com `once`; retorna uma função de limpeza.
- [`followKeyboard(target, options?)`](./keyboard) — move uma view junto com o teclado no iOS e no Android 11+; retorna uma função de limpeza.
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
- [`confetti(target, options?)`, `particles(target, options?)`](./particles) — efeitos de partículas no iOS; retornam funções de limpeza.

`target` é uma view ou qualquer coisa que contenha uma (um template ref, um `ElementRef`). `animate()`, `decay()`, `stop()`, `set()` e os passos de uma sequência também aceitam arrays de alvos.

As opções de `animate()` também aceitam [`haptic`](./haptics): `light`, `medium`, `heavy`, `{ style, times }` ou `false`. O feedback funciona só no iOS.

## Animações

O que `animate()`, `decay()`, `sequence()` e os passos de uma sequência retornam: espere com `await`, leia `finished`, ou chame `stop()`. Resolve com `true` quando tocou até o fim e `false` quando foi parada ou substituída, e o cancelamento não rejeita. Erros de configuração ou de callback de uma sequência podem rejeitar `finished` depois de cancelar o restante.

`animate()` e `decay()` retornam [`PlaybackAnimation`](./playback): o ciclo de vida básico mais `pause()`, `play()`, `progress` gravável e `paused`/`duration` somente para leitura. Sequências e efeitos mantêm o contrato básico de `Animation`.

## Transições

- **Springs**: `'smooth' | 'snappy' | 'bouncy'`, `{ bounce, duration, velocity }` ou `{ stiffness, damping, mass, velocity }`.
- **Tweens**: `{ duration, ease, times }`.
- **Tempo**: `delay`, `repeat`, `repeatType: 'loop' | 'reverse'`, `stagger: number | { each, from }`.
- **Por propriedade**: qualquer nome de propriedade mapeado para a própria transição.
- **Keyframes relativos**: `{ relative: true }` soma deslocamentos de translação/rotação e multiplica escala/opacidade pelos valores iniciais.

## Helpers

`definePreset(name, preset)`, `presets`, `springs`, `cubicBezier`. Veja como registrar [presets personalizados](./presets#presets-personalizados) com nomes tipados.

## Vue

`@rafaelaugusto/jolt/vue` é um ponto de entrada separado para o NativeScript-Vue 3: `vAnimate` (`v-animate`), `vPress` (`v-press`), `JoltTransition`, `transitionHooks(props)`, `useMotionScope()`, `useReducedMotion()`, `useKeyboard()` e `install(app)`, também a exportação padrão para `app.use()`. Tipos: `AnimateValue`, `PressValue`, `TransitionProps`. Veja o [guia do Vue](./vue).

## Tipos

`Step`, `SequenceOptions`, `SequencePosition`, `JoltConfig`, `KeyframeProperty`, `ScrollLinkedOptions`, `KeyboardOptions`, `ItemsOptions`, `ColorValue`, `ColorKeyframes`, `Keyframes`, `Transition`, `Spring`, `Tween`, `Preset`, `Presets`, `PresetName`, `SpringName`, `Easing`, `Animation`, `Target`, `DecayVelocity`, `DecayOptions`, `SymbolEffect`, `SymbolEffectName`, `SymbolEffectOptions`, `ShimmerOptions`, `LiquidOptions`, `LiquidEffect`, `LoaderOptions`, `LoaderStyle`, `TextOptions`, `RollOptions`, `RevealOptions`, `ConcealOptions`, `Haptic`, `HapticOptions`, `HapticStyle`, `ConfettiOptions`, `ParticleOptions` e o resto exportado pelo pacote.
[`configure({ timeScale })`](./configure) define a velocidade global das animações iniciadas depois da chamada.
[`configure({ timeScale, reducedMotion })`](./configure) define a velocidade global e a preferência de redução de movimento (`'user'`, `'always'` ou `'never'`) das animações iniciadas depois da chamada. [`reducedMotion()` e `onReducedMotion(callback)`](./configure#lendo-a-preferencia) leem e acompanham essa preferência.

## Tipos
