# API

## Animando

- `animate(target, keyframes | preset, transition?)`
- `stop(target, properties?)`
- `sequence(steps)`
- `press(target, pressed?, transition?)`
- [`symbolEffect(image, effect, options?)`](./symbol-effects) — SF Symbols no iOS.
- [`shimmer(target, options?)`](./shimmer) — placeholders de carregamento no iOS; retorna uma função de limpeza.
- [`confetti(target, options?)`, `particles(target, options?)`](./particles) — efeitos de partículas no iOS; retornam funções de limpeza.

`target` é uma view ou qualquer coisa que contenha uma (um template ref, um `ElementRef`). `animate()`, `stop()` e os passos de uma sequência também aceitam arrays de alvos.

As opções de `animate()` também aceitam [`haptic`](./haptics): `light`, `medium`, `heavy`, `{ style, times }` ou `false`. O feedback funciona só no iOS.

## Animações

O que `animate()`, `sequence()` e os passos de uma sequência retornam: espere com `await`, leia `finished`, ou chame `stop()`. Resolve com `true` quando tocou até o fim e `false` quando foi parada ou substituída, e nunca rejeita.

## Transições

- **Springs**: `'smooth' | 'snappy' | 'bouncy'`, `{ bounce, duration, velocity }` ou `{ stiffness, damping, mass, velocity }`.
- **Tweens**: `{ duration, ease, times }`.
- **Tempo**: `delay`, `repeat`, `repeatType: 'loop' | 'reverse'`, `stagger: number | { each, from }`.
- **Por propriedade**: qualquer nome de propriedade mapeado para a própria transição.
- **Keyframes relativos**: `{ relative: true }` soma deslocamentos de translação/rotação e multiplica escala/opacidade pelos valores iniciais.

## Helpers

`definePreset(name, preset)`, `presets`, `springs`, `cubicBezier`. Veja como registrar [presets personalizados](./presets#presets-personalizados) com nomes tipados.

## Tipos

`Keyframes`, `Transition`, `Spring`, `Tween`, `Preset`, `Presets`, `PresetName`, `SpringName`, `Easing`, `Animation`, `Target`, `SymbolEffect`, `SymbolEffectName`, `SymbolEffectOptions`, `ShimmerOptions`, `Haptic`, `HapticOptions`, `HapticStyle`, `ConfettiOptions`, `ParticleOptions` e o resto exportado pelo pacote.
