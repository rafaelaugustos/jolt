# Formas: desenhar e transformar

Desenhe um checkmark, revele um anel ou transforme play em barras de pausa. A entrada opcional `@rafaelaugusto/jolt/shapes` desenha uma superfície vetorial sobre uma view NativeScript. O handle de `shape()` segue o mesmo padrão de criação e animação dos gradientes. Esta implementação entra na próxima beta; recompile o Android para incluir o renderizador nativo.

<Clip name="shapes-ios" caption="Simulador iOS: toques reais desenham checkmark, anel e sublinhado, interrompem o morph entre play e pausa, pausam/retomam o desenho e trocam a forma com Reduce Motion. Interface em inglês; velocidade original." />
<Clip name="shapes-android" caption="Emulador Android: os mesmos desenhos e transformações vetoriais por toques reais via ADB, incluindo interrupção, pausa/retomada e Reduce Motion. Interface em inglês e velocidade original; não é uma medição em aparelho físico." />

## Desenhar um caminho

Use uma view vazia dedicada e crie a forma depois do layout nativo. A view fornece tamanho, acessibilidade e entrada; o renderizador não instala gestos nem altera a geometria de toque.

```ts
import { shape } from '@rafaelaugusto/jolt/shapes'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const check = scope.add(
  shape(checkView, {
    d: 'M22 51 L43 71 L79 28',
    viewBox: [0, 0, 100, 100],
    stroke: '#C8E4CF',
    strokeWidth: 5,
    lineCap: 'round',
    strokeEnd: 0,
  }),
)

const drawing = check.animate({ strokeEnd: 1 }, { duration: 900, ease: 'easeInOut' })
drawing.pause()
drawing.progress = 0.5
drawing.play()
// Na desmontagem permanente:
scope.dispose()
```

`viewBox` é `[minX, minY, width, height]`, com dimensões positivas. O caminho mantém a proporção e fica centralizado na view; a espessura usa unidades do viewBox e acompanha essa escala. O desenho é recortado nos limites da view. Redimensionar atualiza esse mapeamento sem reconstruir a animação do caminho.

As opções estáticas são `stroke` (padrão `#202630`), `fill` (transparente), `strokeWidth` (0–1000, padrão 2), `lineCap` (`butt`, `round`, `square`; padrão `round`), `lineJoin` (`miter`, `round`, `bevel`; padrão `round`) e `fillRule` (`nonzero` ou `evenodd`; padrão `nonzero`). Descarte e recrie para alterar estilo ou viewBox. A superfície preserva fundo, transforms e tratamento de toque originais, desenhando sobre o conteúdo existente.

`strokeStart` e `strokeEnd` selecionam frações de 0–1. Quando o início é maior ou igual ao fim, o traço fica vazio; o preenchimento permanece completo. O desenho parcial exige um único subcaminho contínuo. Caminhos compostos aceitam preenchimento, traço completo e morph; use views separadas quando cada contorno precisar de progresso próprio.

## Transformar geometrias compatíveis

```ts
const icon = shape(iconView, {
  d: 'M20 25 L80 50 L20 75 Z',
  viewBox: [0, 0, 100, 100],
  fill: '#F4B992',
  strokeWidth: 0,
})
icon.animate({ d: 'M20 25 L80 25 L50 80 Z' }, 'snappy')
// A troca parte da apresentação nativa, mesmo durante um morph incompleto.
icon.animate({ d: 'M20 25 L80 50 L20 75 Z' }, 'snappy')
```

São aceitos os comandos SVG `M/L/H/V/C/S/Q/T/A/Z`, formas relativas, repetições implícitas e múltiplos subcaminhos. A preparação normaliza abreviações e coordenadas relativas; arcos elípticos viram segmentos Bézier cúbicos de até 90 graus. O morph exige os mesmos comandos normalizados, subcaminhos e quantidade de pontos de controle. Não há correspondência automática de topologias. Arcos com varreduras diferentes podem gerar quantidades diferentes de segmentos e ser incompatíveis.

Um destino incompatível lança erro antes de interromper a animação existente. Use `set({ d: newPath, strokeStart: 0, strokeEnd: 1 })` para trocar a topologia imediatamente. A entrada tem limites de 20.000 caracteres, 256 comandos normalizados e coordenadas de ±1.000.000. Uma animação amostrada admite até 262.144 componentes; combinações excessivas de caminho e curva são rejeitadas antes de substituir a animação atual.

## Reprodução e ciclo de vida

`animate({ d?, strokeStart?, strokeEnd? }, transition?)` recebe um destino e as opções existentes de tween, spring, easing, delay e repetição. Use `set()` seguido de `animate()` para um início e fim explícitos. Uma forma controla uma única animação combinada de geometria e traço; propriedades omitidas ao trocar o destino mantêm a apresentação atual. Camadas aditivas nomeadas e arrays de keyframes de formas não fazem parte desta API.

O handle retornado oferece `finished`, `pause()`, `play()`, `stop()` e `progress` finito. Springs projetam a velocidade vetorial interrompida na direção do novo destino. O traço permanece entre 0–1; a geometria pode ter overshoot. `shape.stop()` segura a apresentação atual; `set()` interrompe e substitui imediatamente. `snapshot()` lê caminho, frações, limites nativos e contagem de animações sob demanda, sem instalar observadores.

Ir para segundo plano pausa o trabalho ativo. Se o NativeScript descarregar a view nesse momento, a superfície nativa é liberada e o programa pausado continua quando ela carrega novamente em primeiro plano. Um unload comum ou substituição da view nativa cancela a reprodução, libera a superfície antiga e restaura a geometria mantida ao carregar. Uma pausa explícita continua pausada. `dispose()` remove permanentemente a forma e seus listeners, podendo ser chamado novamente. Cada view aceita uma única forma por vez.

Reduce Motion aplica novos destinos imediatamente. Ativá-lo durante uma reprodução interrompe o handle (`finished` resolve `false`) e aplica o destino solicitado sem nova animação. Um escopo pode controlar a forma para limpeza ou os handles individuais para suspensão; não compartilhe uma forma entre proprietários independentes.

## Renderização nativa

O iOS usa keyframes explícitos de `CAShapeLayer` para caminho e traço, com um marcador nativo de apresentação para interrupção. A Apple exige estrutura compatível de segmentos e pontos de controle na interpolação. [Documentação de path em CAShapeLayer](https://developer.apple.com/documentation/quartzcore/cashapelayer/path).

O Android usa drawable compilado, `Path`/`PathMeasure` e `ValueAnimator`. Caminhos e buffers são reutilizados; coordenadas e traço mudam em código nativo. O desenho parcial usa `PathMeasure.getSegment()`. [Documentação de PathMeasure](https://developer.android.com/reference/android/graphics/PathMeasure).

JavaScript interpreta a geometria e prepara curvas na criação e nos comandos, depois trata ciclo de vida e conclusão. Não desenha nem atualiza o caminho a cada frame. O desenho Android ainda compartilha a thread de UI com o JavaScript do NativeScript. A API não promete thread de renderização independente ou desempenho em aparelho físico.

O preview **Feito de movimento / Linework**, em quatro idiomas, é o 71º exemplo. Veja [validação e reprodução](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/shapes.md).
