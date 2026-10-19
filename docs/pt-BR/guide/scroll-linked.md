# Animações ligadas ao scroll

Crie a animação uma vez e deixe um `ScrollView` escolher o frame:

<Clip name="scroll-linked-ios" caption="A rolagem recolhe o cabeçalho, revela o título compacto e depois restaura o estado inicial. Simulador iOS." />

```ts
import { scrollLinked } from '@rafaelaugusto/jolt'

const unlink = scrollLinked(
  scrollView,
  header,
  { y: [0, -60], opacity: [1, 0] },
  { range: [0, 120] },
)
```

No offset 0, o cabeçalho começa em `y: 0`, opacidade 1. Em 60 DIPs chega a `y: -30`, opacidade 0.5. Em 120 DIPs segura o último frame. Voltar o scroll reverte o movimento, inclusive depois de chegar a qualquer extremo. O overscroll fica limitado ao intervalo.

A interpolação é linear, com keyframes igualmente espaçados. Todas as propriedades de [`animate()`](./animating) estão disponíveis, incluindo [cores](./colors) e [decorações](./decorations) dentro dos limites de cada plataforma. Um valor escalar ou `null` captura o valor inicial quando o alvo carrega.

## Intervalo e eixo

`range` é um par de offsets finitos e distintos, em DIPs. Um intervalo decrescente inverte o mapeamento:

```ts
scrollLinked(scrollView, badge, { opacity: [0, 1] }, { range: [120, 0] })
```

O eixo padrão é `y`. Para um ScrollView horizontal, escolha `x`:

```ts
scrollLinked(
  carousel,
  artwork,
  { rotateY: [-15, 15] },
  {
    range: [0, 300],
    axis: 'x',
  },
)
```

Os dois argumentos aceitam views nativas ou wrappers de frameworks, como `animate()`. A origem precisa conter um `ScrollView` do NativeScript; o helper não se conecta a ListView nem a um scroller nativo personalizado. O offset atual é aplicado imediatamente e atualizado no carregamento, sem exigir um novo gesto para refletir uma posição restaurada. Chamadas anteriores ao carregamento do alvo guardam o progresso mais recente.

## Limpeza e interrupção

O retorno é uma função de limpeza idempotente:

```ts
unlink() // remove o vínculo e congela as propriedades no frame atual
```

Descarregar qualquer uma das views também remove o vínculo e libera a animação. Crie outro vínculo ao reutilizar uma tela descarregada. Parar ou substituir todas as propriedades vinculadas também remove o listener. Substituir apenas uma deixa as demais acompanharem o scroll, sem retomar a propriedade substituída. Outras animações e listeners de scroll continuam independentes.

A animação permanece pausada durante todo o vínculo, inclusive no progresso 1. Ela não termina só porque o usuário chegou ao fim do intervalo. Use `animate()` separadamente depois da limpeza se a view precisar continuar se movendo sozinha.

## Timing e custo

Cada evento de scroll define um único valor de `progress` na animação pausada, de forma síncrona. Valores repetidos, incluindo overscroll já limitado, são ignorados. Não há timer, callback por frame, novo cálculo de curva ou chamada a `animate()` a cada evento.

Os drivers ainda reposicionam cada propriedade que possuem: isso não vira uma única chamada à ponte nativa para qualquer quantidade de propriedades. O iOS aplica as cópias pausadas do Core Animation; o Android reposiciona os animadores nativos. A entrega do scroll e a atualização do progresso precisam de JavaScript na thread principal. Não é uma timeline de scroll nativa capaz de seguir a entrada com o JavaScript bloqueado; o [limite da UI thread no Android](./android-performance) continua valendo.

O playground usa o ScrollView principal para mover e apagar o cabeçalho grande enquanto revela um título compacto fixo. Os dois sentidos usam esta API pública.
