# API

## Animando

- `animate(target, keyframes | preset, transition?)` — [cores](./colors), [cantos, bordas e sombras](./decorations)
- [`decay(target, velocity, options?)`](./decay)
- `stop(target, properties?)`
- `sequence(steps)`
- `press(target, pressed?, transition?)`
- [`scrollLinked(scrollView, target, keyframes, { range, axis? })`](./scroll-linked) — retorna uma função de limpeza.
- [`symbolEffect(image, effect, options?)`](./symbol-effects) — SF Symbols no iOS.
- [`shimmer(target, options?)`](./shimmer) — placeholders de carregamento no iOS; retorna uma função de limpeza.
- [`liquid(image, options?)`](./liquid) — deformação de textura no iOS; retorna um `LiquidEffect` com `pause()`, `resume()` e `stop()`.
- [`loader(target, options?)`](./loaders) — indicadores de bolinhas, barras e anel no iOS; retorna uma função de limpeza.
- [`reveal(target, options?)`, `conceal(target, options?)`](./reveal) — transições circulares de visibilidade no iOS; retornam uma `Animation`.
- [`animateText(label, options?)`](./text) — entrada de texto por letra ou palavra no iOS; retorna uma `Animation`.
- [`confetti(target, options?)`, `particles(target, options?)`](./particles) — efeitos de partículas no iOS; retornam funções de limpeza.

`target` é uma view ou qualquer coisa que contenha uma (um template ref, um `ElementRef`). `animate()`, `decay()`, `stop()` e os passos de uma sequência também aceitam arrays de alvos.

As opções de `animate()` também aceitam [`haptic`](./haptics): `light`, `medium`, `heavy`, `{ style, times }` ou `false`. O feedback funciona só no iOS.

## Animações

O que `animate()`, `decay()`, `sequence()` e os passos de uma sequência retornam: espere com `await`, leia `finished`, ou chame `stop()`. Resolve com `true` quando tocou até o fim e `false` quando foi parada ou substituída, e nunca rejeita.

`animate()` e `decay()` retornam [`PlaybackAnimation`](./playback): o ciclo de vida básico mais `pause()`, `play()`, `progress` gravável e `paused`/`duration` somente para leitura. Sequências e efeitos mantêm o contrato básico de `Animation`.

## Transições

- **Springs**: `'smooth' | 'snappy' | 'bouncy'`, `{ bounce, duration, velocity }` ou `{ stiffness, damping, mass, velocity }`.
- **Tweens**: `{ duration, ease, times }`.
- **Tempo**: `delay`, `repeat`, `repeatType: 'loop' | 'reverse'`, `stagger: number | { each, from }`.
- **Por propriedade**: qualquer nome de propriedade mapeado para a própria transição.
- **Keyframes relativos**: `{ relative: true }` soma deslocamentos de translação/rotação e multiplica escala/opacidade pelos valores iniciais.

## Helpers

`definePreset(name, preset)`, `presets`, `springs`, `cubicBezier`. Veja como registrar [presets personalizados](./presets#presets-personalizados) com nomes tipados.

## Tipos

`ScrollLinkedOptions`, `ColorValue`, `ColorKeyframes`, `Keyframes`, `Transition`, `Spring`, `Tween`, `Preset`, `Presets`, `PresetName`, `SpringName`, `Easing`, `Animation`, `Target`, `DecayVelocity`, `DecayOptions`, `SymbolEffect`, `SymbolEffectName`, `SymbolEffectOptions`, `ShimmerOptions`, `LiquidOptions`, `LiquidEffect`, `LoaderOptions`, `LoaderStyle`, `TextOptions`, `RevealOptions`, `ConcealOptions`, `Haptic`, `HapticOptions`, `HapticStyle`, `ConfettiOptions`, `ParticleOptions` e o resto exportado pelo pacote.
