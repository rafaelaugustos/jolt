# Efeitos de imagem

Equivalente experimental na Web: consulte [partículas, superfícies e imagens](./web-surfaces). Disponível desde a RC.10.

`imageEffect()` aplica ripple, distorção por toque, dissolve e máscaras líquidas em uma `Image` do NativeScript. Recompile o aplicativo nativo depois da instalação. O alvo deve ter uma imagem raster carregada, com textura de vídeo local opcional no iOS. Árvores de views, SVG e imagens animadas continuam fora deste contrato.

<Clip name="image-effects-ios" caption="Ripple, distorção por toque e dissolve numa imagem de teste usando Metal no simulador iOS." />

```ts
import { imageEffect } from '@rafaelaugusto/jolt'

const efeito = imageEffect(foto, 'ripple', {
  origin: { x: 80, y: 120 }, // DIPs locais da Image
  amplitude: 12,
  radius: 96,
  duration: 700,
})
await efeito.finished // true ao concluir; false ao parar/substituir
```

| Preset       | Comportamento                                                                |
| ------------ | ---------------------------------------------------------------------------- |
| `ripple`     | Onda que parte de uma origem local e retorna à imagem original               |
| `distortion` | Toque nativo deforma a imagem dentro de um limite; soltar retorna ao repouso |
| `dissolve`   | Transição determinística para uma `ImageSource` carregada em `to`            |

Origem, raio e amplitude usam DIPs locais da imagem. Os padrões são centro, raio 96, amplitude 8 (intervalo 0–64), duração 650 ms e seed 1 (inteiro 0–65535).

## Controle

```ts
const troca = imageEffect(foto, 'dissolve', {
  to: proximaImagem,
  seed: 42,
  duration: 900,
  paused: true,
})
troca.progress = 0.4
troca.play()
troca.pause()
troca.reverse()
troca.finish()
```

`progress` vai de 0 a 1 e preserva o estado de reprodução. Pause antes de buscar um quadro estático. `reverse()` inverte e reproduz a partir do progresso atual. `finish()` conclui na extremidade da direção atual. O dissolve concluído para frente atualiza `imageSource`; ao concluir de volta, preserva a origem. `stop()` restaura a origem e resolve `false`. Handles terminados não reiniciam.

A distorção continua até `stop()`, aceita pausa/reprodução e rejeita seek/reverse. Seu `finish()` equivale a `stop()`. Toques e quadros não atravessam callbacks JavaScript.

## Compatibilidade e fallback

| Plataforma                                                                          | Renderização               |
| ----------------------------------------------------------------------------------- | -------------------------- |
| iOS com Metal disponível                                                            | Metal dentro da mesma view |
| Android 13/API 33+, aceleração de hardware                                          | AGSL/RuntimeShader         |
| Android anterior, imagem incompatível, backend indisponível ou redução de movimento | Fallback explícito         |

No fallback, efeitos decorativos mantêm a origem e resolvem `false`. Dissolve aplica o destino imediatamente e resolve `true`, mesmo quando solicitado pausado. Consulte `diagnostics.backend`, `reason` e, quando disponível, `detail` para diagnóstico.

A superfície aceita até 4.194.304 pixels físicos. Transparência e stretch são preservados. A aplicação continua responsável por decodificar arquivos grandes em resolução apropriada. Os efeitos não animam layout nem navegação.

## Propriedade e ciclo de vida

Cada imagem aceita um controlador de `imageEffect()`, `liquid()` ou `zoomable()`: o próximo encerra o anterior. Animação externa da view pode coexistir com um efeito, mas não substitua manualmente seu drawable/imagem nativa enquanto ele estiver ativo.

Unload, ocultação e troca da origem/stretch/tint encerram o efeito e liberam recursos. Antes do início, ele espera imagem carregada e layout positivo. Background pausa e resume respeitando a pausa do usuário. Mudanças do ajuste de acessibilidade são observadas no iOS; após mudar `configure()`, recrie efeitos contínuos.

`diagnostics` informa backend, quadros, bytes atuais e de pico das texturas próprias, tempo de preparação em milissegundos e maior intervalo observado entre desenhos. Esses dados servem a diagnóstico, não substituem um profiler GPU. Depois de encerrar, bytes próprios retornam a zero; a plataforma pode liberar alocações GPU de forma assíncrona. O limite de pixels é uma proteção conservadora de alocação, não uma garantia de desempenho medida.

Mudar tamanho, padding, largura das bordas ou raios dos cantos atualiza a superfície e o recorte preservando progresso, pausa, direção e bindings. As texturas novas são preparadas antes da troca; o limite de pixels continua valendo. Se o resize falhar, o efeito encerra e restaura a origem. Bordas e fundos ficam fora da textura deformada.

O laboratório de imagens da [demo](./demo) inclui origem por toque, arraste nativo, pausa, reverse, scrub, restauração, quatro modos de stretch, bordas arredondadas e redução de movimento. A imagem horizontal se dissolve em uma imagem vertical com canto transparente.

<Clip name="web-image-surfaces-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais demonstram reprodução, pausa/retomada, substituição, movimento reduzido e descarte na velocidade original. Captura de navegador; sem alegação de desempenho em aparelho físico." />

## Escopo do renderer e medições nativas

O backend suporta imagens estáticas e texturas de vídeo local no iOS. Snapshots feitos pelo app permanecem congelados; esta API não fornece subárvores vivas, captura contínua, amostragem de fundo, câmera/WebView ou filtros SwiftUI hospedados. O [relatório do renderer](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/image-renderer.md) descreve desenho, coordenadas, ownership, fallback, passes e reprodução das medições. `diagnostics.frameIntervalsMs` mantém até 512 intervalos ativos de desenho nativo em milissegundos. Pausas são excluídas; não são tempos de GPU ou de apresentação.

<Clip name="image-profile-ios" caption="Simulador de iPhone 17, iOS 26.2, interface em inglês. Toques reais executam ripple, dois dissolves simultâneos e cancelamento. Velocidade original; as medições usam uma execução separada sem gravação. Não comprova desempenho físico." />

## Parâmetros de shader com entradas nativas

`bind()` conecta um valor numérico do Jolt, incluindo `springValue()` e seus mapeamentos `.to()`, ao renderer. `bindScroll()` lê diretamente o deslocamento nativo de uma ScrollView. Nenhuma conexão instala uma assinatura JavaScript por frame. Listeners de scroll e chamadas explícitas a `subscribe()` do aplicativo continuam funcionando quando solicitados.

```ts
import { animate, imageEffect, motionValue, springValue } from '@rafaelaugusto/jolt'

const destino = motionValue(0)
const mola = springValue(destino, { stiffness: 100, damping: 13 })
const efeito = imageEffect(foto, 'ripple', { paused: true })
const soltar = efeito.bind('progress', mola)
animate(destino, 1, { duration: 0 })
animate(destino, 0, { duration: 0 }) // interrompe/inverte a mola retida

const pararScroll = efeito.bindScroll('progress', scroll, {
  range: [0, 240],
  output: [0, 1],
  axis: 'y',
})
efeito.set('amplitude', 16)
// Ao descartar o dono:
efeito.stop()
mola.dispose()
```

| Parâmetro            | Unidade/intervalo                          |
| -------------------- | ------------------------------------------ |
| `progress`           | 0–1; indisponível para distorção por toque |
| `amplitude`          | 0–64 DIPs locais                           |
| `radius`             | DIPs locais positivos                      |
| `originX`, `originY` | DIPs locais                                |

O overshoot da mola é limitado nativamente para progresso/amplitude; o raio permanece positivo. Scroll aceita faixas crescentes ou decrescentes e limita os valores fora delas. São entradas tipadas dos presets do Jolt; esta API não compila shaders arbitrários do aplicativo.

Cada parâmetro tem um dono. Um novo binding ou `set()` substitui apenas seu dono; descartes antigos não afetam o novo. Atribuir `progress` ou chamar `play()` retoma o controle do progresso. `pause()` congela a timeline finita; fontes nativas vinculadas continuam controlando seus parâmetros. Descarte o binding ou pause a mola para congelar a entrada. `stop()` remove todos os bindings e observadores de scroll. O trabalho permanece nos caminhos nativos de UI/renderização e pode disputar a thread de interface.

## Máscara líquida de formas

`liquid-mask` recorta a origem com uma união suave de 1–8 círculos ou retângulos arredondados. Cada forma interpola entre `from` e `to` pelo mesmo progresso; inverter o progresso desfaz a fusão. O contorno visível muda, diferentemente de [`liquid()`](./liquid).

```ts
const mascara = imageEffect(foto, 'liquid-mask', {
  paused: true,
  mask: {
    blend: 22, // suavidade da união em DIPs; 0 = união rígida; máximo 128
    shapes: [
      {
        kind: 'circle',
        from: { x: 0.25, y: 0.5, radius: 0.18 },
        to: { x: 0.43, y: 0.5, radius: 0.22 },
      },
      {
        kind: 'rectangle',
        from: { x: 0.77, y: 0.5, width: 0.3, height: 0.5, radius: 0.09 },
        to: { x: 0.59, y: 0.5, width: 0.44, height: 0.6, radius: 0.15 },
      },
    ],
  },
})
mascara.progress = 0.5
mascara.play()
mascara.reverse()
```

Centros e dimensões dos retângulos são normalizados pela largura/altura do alvo. O raio é uma fração do menor lado; círculos permanecem circulares durante resize. O raio dos cantos é limitado à metade do tamanho do retângulo. Centros aceitam −4…4, dimensões positivas até 4 e raios 0…2 (positivos para círculos).

O shader multiplica cor e alfa pré-multiplicados pela cobertura da máscara. As áreas transparentes revelam o conteúdo abaixo; a máscara é decorativa e não altera hit testing. As extremidades permanecem visíveis e reversíveis: a máscara retém o renderer ao chegar a 0 ou 1. `finish()` mantém a extremidade da direção atual; `finished` permanece pendente até stop/substituição, que resolve `false`.

<Clip name="shader-inputs-liquid-mask-ios" caption="Simulador de iPhone 17 Pro, iOS 26.2, interface em inglês. Toques e scroll reais via XCTest controlam fusão/separação, resize pausado e em reprodução e descarte. O fundo quadriculado mostra a transparência. Velocidade original; não é aparelho físico." />

<Clip name="shader-inputs-liquid-mask-android" caption="Emulador Android API 36, interface em inglês. Toques e swipes reais via ADB controlam mola/scroll nativos, máscara reversível, resize e descarte pelo AGSL. Velocidade original; sem alegação de desempenho físico." />

## Texturas de vídeo local no iOS

```ts
const efeito = imageEffect(foto, 'ripple', {
  paused: true,
  amplitude: 28,
  video: { src: caminhoLocalAbsolutoMP4, loop: true },
})
efeito.progress = 0.35 // mantém a deformação enquanto o vídeo continua

efeito.pauseVideo()
efeito.playVideo()
efeito.setVideo({ src: outroCaminhoLocalAbsoluto, paused: true })
efeito.setVideo(null) // restaura a textura da imagem sem encerrar o efeito
```

A Image precisa de uma imagem raster carregada como pôster/fallback. Este primeiro backend aceita vídeo local sem proteção, decodificado pelo AVFoundation e sem áudio; os testes usam MP4 H.264 SDR em 640×360. Streaming, DRM, câmera, sincronização de áudio, garantias HDR e vídeo Android/Web ficam fora do contrato. Vídeo não pode ser destino de dissolve. Falhas de decodificação mantêm os últimos pixels disponíveis e aparecem em `diagnostics.videoStatus`; caminhos locais inexistentes são rejeitados sem substituir um vídeo ativo.

AVPlayer fornece o relógio; AVPlayerItemVideoOutput entrega frames ao cache de texturas Metal, sem copiar pixels pelo JavaScript. A pausa do vídeo é independente da timeline do efeito. O frame pausado sobrevive ao resize; a troca de origem libera o player/output anterior. Background suspende vídeo e renderização respeitando pausas explícitas. Stop/unload libera player, output, cache, bindings e texturas. Frames de origem e superfícies de saída têm limite individual de 4.194.304 pixels; o decoder usa memória adicional.

Após stop, os diagnósticos mantêm os últimos contadores/status, com bytes atuais de textura zerados. `loop` tem padrão `true` e `paused` do vídeo tem padrão `false`.

`diagnostics.videoFrames` conta frames consumidos; `videoTime` informa segundos do player; `nativeParameterWrites` conta escritas nativas com mudança de valor; `resizeCount` conta atualizações da superfície. No iOS, `renderCpuMs` acumula CPU do desenho/encoding e `renderGpuMs` acumula duração GPU de command buffers concluídos; não medem latência de apresentação. No Android, os dois últimos contadores são indisponíveis (zero). Bytes de textura excluem pools do decoder, drawables e outros recursos do app; o pico de vídeo é uma estimativa conservadora dos frames em voo. O [relatório de validação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/shader-textures.md) inclui instrumentação, memória do processo e limites do ambiente.

<Clip name="shader-video-ios" caption="Simulador de iPhone 17 Pro, iOS 26.2, interface em inglês. Toques reais mostram vídeo Big Buck Bunny decodificado através de ripple pausado, pausa/retomada do vídeo, resize, troca de origem e restauração do pôster. Velocidade original. O aceite em simulador foi autorizado; não é filmagem de aparelho físico." />
