# API

## Animando

- `animate(target, keyframes | preset, transition?)`
- `stop(target, properties?)`
- `sequence(steps)`
- `press(target, pressed?, transition?)`

`target` é uma view, um array de views, ou qualquer coisa que contenha uma (um template ref, um `ElementRef`).

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

`Keyframes`, `Transition`, `Spring`, `Tween`, `Preset`, `Presets`, `PresetName`, `SpringName`, `Easing`, `Animation`, `Target` e o resto exportado pelo pacote.
