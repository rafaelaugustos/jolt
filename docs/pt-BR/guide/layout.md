# Mudanças de layout

`animateLayout(container)` anima a próxima mudança de layout dos filhos diretos de um container. Uma linha nova abre espaço, remover um card fecha a lacuna e reorganizar views existentes move cada uma até sua nova posição. Adicionado na beta.9.

<Clip name="layout-ios" caption="Inserção, remoção, reorganização e expansão de cards nativos no simulador iOS." />

```ts
import { animateLayout } from '@rafaelaugusto/jolt'

animateLayout(list, () => rows.value.splice(1, 0, newRow))
animateLayout(list, () => rows.value.reverse(), 'snappy')
animateLayout(list, () => {
  expanded.value = !expanded.value
})
```

Use keys estáveis nos filhos Vue. A API acompanha **instâncias de views**, não IDs de dados. Funciona em containers comuns, como StackLayout, GridLayout e WrapLayout. Linhas recicladas de ListView/CollectionView precisam de integração específica de animação de itens e ficam fora desta API.

## Capturar, mudar, animar

Com callback, o Jolt captura a geometria atual, executa a mutação de forma síncrona, solicita layout e aplica as transformações inversas antes do próximo desenho. A atualização de DOM enfileirada pelo Vue pode ocorrer entre a mutação e esse layout.

Sem callback, altere o layout logo depois da chamada:

```ts
const animation = animateLayout(list, { duration: 350, ease: 'easeOut' })
rows.value.push(newRow)
await animation
```

Cada chamada cobre um layout; não instala um observador permanente. Busque ou aguarde os dados **antes** da chamada. Callbacks assíncronos são rejeitados. Mesmo sem mudanças, a API solicita um layout e conclui sem depender de um timer fixo. Um container descarregado ou com `collapse` executa a mutação imediatamente e conclui sem guardar trabalho para uma carga futura.

Só os filhos diretos são acompanhados. Para mover os vizinhos de um container que cresce, chame `animateLayout` no pai dele. Containers internos podem receber suas próprias chamadas. Views removidas saem imediatamente; as restantes animam até fechar o espaço. A API não retém views removidas para animar uma saída.

## Tamanho e conteúdo

Para mudanças reais de largura/altura, tamanho intrínseco `auto` e reorganização contínua de texto, use [`animateSize()`](./size). O layout por frame e o contrato de cancelamento são diferentes desta API de FLIP.

O padrão `size: 'scale'` escala das dimensões anteriores para as novas, respeitando translação, escala e origem existentes. O layout calcula o tamanho final uma vez. Texto, cantos e conteúdo ficam temporariamente esticados; isso não é uma redistribuição contínua do texto.

Use `size: false` para aplicar o tamanho novo imediatamente e animar apenas as mudanças de posição:

```ts
animateLayout(
  list,
  () => {
    expanded.value = !expanded.value
  },
  {
    size: false,
    duration: 300,
  },
)
```

Views com dimensões zero/não finitas ou `collapse` não são medidas. Um filho que passa a ter dimensões válidas é considerado novo. Mudanças de origem ou rotação na mesma mutação, e filhos com rotação 3D nos eixos X/Y, não recebem a inversão de translação/escala; anime essas transformações explicitamente. Transformações dos ancestrais ficam fora desse cálculo local de layout.

## Opções

O terceiro argumento (ou segundo, sem callback) aceita `'smooth'`, `'snappy'`, `'bouncy'` ou um objeto `LayoutOptions`:

| Opção                        | Comportamento                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Configuração de tween/spring | `duration`, `ease`, `times`, `type`, `bounce`, `stiffness`, `damping`, `mass`, `velocity`, `delay`; mesmas unidades de `animate()` |
| `size`                       | `'scale'` (padrão) ou `false`                                                                                                      |
| `enter`                      | `true` (padrão) faz os filhos novos aparecerem de zero até a opacidade configurada; `false` os mostra imediatamente                |

As opções se aplicam igualmente aos filhos. Duração e atraso precisam ser finitos e não negativos; stiffness/mass positivos, damping não negativo e bounce entre -1 e 1. Um spring baseado em duração exige valor positivo; use tween de duração zero para resultado imediato. Repetições, frames relativos, overrides por propriedade e stagger não são opções de layout. Opções inválidas são rejeitadas antes da mutação ou do cancelamento de um pedido anterior.

O `timeScale` global afeta a reprodução. Reduced Motion aplica a geometria final imediatamente e mantém a entrada opcional por opacidade, seguindo o comportamento padrão do Jolt.

## Interrupção e propriedade das animações

Uma segunda chamada antes do layout substitui o pedido pendente. Durante a reprodução, uma mudança nova lê a posição visível da animação anterior no próximo layout e inicia as novas tracks antes de cancelar os handles antigos. As translações/escalas definidas pelo app continuam sendo os valores de repouso; não são forçadas para zero/um.

Uma animação explícita iniciada depois da captura mantém o controle de suas propriedades. O efeito de layout controla `x`, `y`, `scaleX` e `scaleY` conforme necessário, além da opacidade dos filhos que entram. Propriedades independentes continuam normalmente.

O retorno é um `Animation` com `finished`, `stop()` e suporte a `await`. A conclusão resolve `true`; substituição ou cancelamento resolve `false`. **Parar elimina os deslocamentos temporários e deixa os elementos no layout final**, em vez de mantê-los entre posições. A limpeza preserva animações mais recentes e não desfaz a mutação dos dados. Esse handle agregado não expõe pause ou scrub.

Unload nativo e suspensão do app cancelam o pedido/reprodução e removem os listeners. Use um scope para acompanhar o componente:

```ts
const scope = motionScope() // ou useMotionScope() no setup do Vue
const animation = scope.animateLayout(list, () => rows.value.reverse())
// scope.reset(), scope.suspend() e scope.dispose() cancelam o layout sob seu controle.
```

Exceções da mutação são relançadas de forma síncrona após a limpeza. Erros inesperados na preparação da reprodução nativa rejeitam `finished` depois de parar o trabalho que já começou.

## Desenho e geometria de toque

O Jolt lê os limites nativos sem transformação, em DIPs relativos ao pai. No Android, inicia a reprodução em um listener de pre-draw usado uma vez. No iOS, aguarda o método de layout do container NativeScript terminar e aplica a inversão antes do desenho. Medição e inversão passam uma vez pelo JavaScript; as curvas são reproduzidas nativamente.

As tracks de layout selecionam automaticamente o [driver de geometria interativa](./interaction-surface) no iOS para manter os controles clicáveis na posição visível. Só as novas tracks recebem essa seleção; animações independentes já em andamento não são migradas. Ancestrais animados fora da operação ainda precisam de sua própria superfície de interação. A reprodução iOS usa a thread de UI nativa, portanto JavaScript pesado na thread principal pode atrasá-la. A integração também corrige o indicador de transformação em cache do NativeScript durante a atribuição de frames; os hooks são locais às instâncias afetadas e removidos ao concluir/cancelar.

Abra **Layout changes** no playground, ou use `--layout-lab` no iOS / `--es layout-lab true` no Android. A demo inclui inserção/remoção, reorganização, expansão, reprodução lenta, política de tamanho, stop, Reduced Motion e unmount/remount. O [relatório de validação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/layout-lifecycle.md) detalha os testes nativos e de toques pelo SO.
