# Validação do Web mobile

O mantenedor escolheu simuladores/emuladores para esta entrega. As interações usam Safari e Chrome reais com seus teclados virtuais; não foram injetados eventos de sensores. As correções de teclado descritas aqui foram publicadas na **0.1.0-rc.11**.

<Clip name="web-mobile-ios" caption="Safari 26.2 · simulador de iPhone 17, iOS 26.2. Digitação real, rotação, pedido de permissão, pausa/retomada e descarte. A permissão de movimento é concedida, mas não chegam leituras: as duas fontes ficam indisponíveis. Haptics indisponíveis. Interface em inglês, velocidade original." />

<Clip name="web-mobile-android" caption="Chrome 133 · emulador Android API 36. Teclado virtual real, rotação da interface, pausa/retomada e descarte. As leituras de rotação/gravidade vêm do emulador; solicitar vibração não comprova vibração física. Interface em inglês, velocidade original." />

## Contrato do teclado

A existência de VirtualKeyboard com um retângulo vazio não comprova um backend de geometria ativo. Sem overlaysContent habilitado pelo app ou um retângulo não vazio, o Jolt usa VisualViewport. A configuração overlaysContent do app é preservada.

Quando o navegador redimensiona as duas viewports, a visibilidade é estimada pela altura de repouso e a altura coberta permanece zero, evitando deslocamento duplicado. O deslocamento da viewport muda a cobertura inferior sem indicar que o teclado fechou. A rotação invalida a referência de altura. A estimativa não distingue todos os redimensionamentos de janela com um campo focado.

## Reproduzir e inspecionar

[Protocol and raw reports](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/web-mobile).

```sh
node benchmarks/web-mobile/server.mjs
python3 benchmarks/web-mobile/android.py YOUR_EMULATOR /tmp/jolt-mobile-android
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/jolt-mobile-ios testMobileBrowser
```

[Keyboard API](keyboard.md) · [Parity inventory](web-parity.md)
