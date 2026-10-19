# Efeitos de imagem

`imageEffect()` aplica ripple, distorção por toque e dissolve em uma `Image` do NativeScript. Recompile o aplicativo nativo depois da instalação. O alvo deve ser uma imagem raster carregada; árvores de views, SVG, vídeo e imagens animadas ficam fora deste contrato.

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

Unload, ocultação, troca da origem/stretch/tint e mudança de tamanho encerram o efeito e liberam recursos. Antes do início, ele espera imagem carregada e layout positivo. Background pausa e resume respeitando a pausa do usuário. Mudanças do ajuste de acessibilidade são observadas no iOS; após mudar `configure()`, recrie efeitos contínuos.

`diagnostics` informa backend, quadros, bytes atuais e de pico das texturas próprias, tempo de preparação em milissegundos e maior intervalo observado entre desenhos. Esses dados servem a diagnóstico, não substituem um profiler GPU. Depois de encerrar, bytes próprios retornam a zero; a plataforma pode liberar alocações GPU de forma assíncrona. O limite de pixels é uma proteção conservadora de alocação, não uma garantia de desempenho medida.

Mudar padding, largura das bordas ou raios dos cantos também encerra o efeito para evitar geometria antiga. Bordas e fundos ficam fora da textura deformada.

O laboratório de imagens da [demo](./demo) inclui origem por toque, arraste nativo, pausa, reverse, scrub, restauração, quatro modos de stretch, bordas arredondadas e redução de movimento. A imagem horizontal se dissolve em uma imagem vertical com canto transparente.
