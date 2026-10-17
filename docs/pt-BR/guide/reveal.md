# Revelação circular

Mostre o conteúdo a partir de um ponto ou o oculte com o efeito inverso:

<Clip name="reveal" caption="Revelação e ocultação circulares." />

```ts
import { reveal, conceal } from '@rafaelaugusto/jolt'

await reveal(details, { from: { x: 40, y: 40 }, duration: 500 })
await conceal(details, { to: { x: 40, y: 40 }, duration: 500 })
```

As duas funções aceitam uma view ou uma ref que contenha uma. No iOS, uma máscara temporária de `CAShapeLayer` anima seu caminho circular no Core Animation, sem trabalho JavaScript por frame. O círculo cresce até cobrir todos os cantos, inclusive quando o ponto de origem fica fora da view.

## Opções

| Opção                | Padrão | Significado                                                                                   |
| -------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `from` em `reveal()` | Centro | Origem do círculo, com `x` e `y` finitos em DIPs a partir do canto superior esquerdo do alvo. |
| `to` em `conceal()`  | Centro | Ponto para o qual o círculo se contrai, nas mesmas coordenadas.                               |
| `duration`           | `400`  | Milissegundos finitos, maiores ou iguais a zero. Zero muda a visibilidade imediatamente.      |

A curva é ease-in-out. Ao interromper uma revelação ou ocultação em andamento, omitir o ponto mantém o centro do círculo atual. Por enquanto, essas funções oferecem máscaras circulares; wipes e outras formas não estão incluídos.

## Visibilidade e layout

`reveal()` torna o alvo visível atrás da máscara que se expande. `conceal()` termina com `view.visibility = 'hidden'`, preservando o espaço no layout e impedindo novos toques. Ocultar um alvo que já esteja escondido ou colapsado preserva sua visibilidade.

A máscara não redimensiona nem reposiciona a view. Máscaras existentes, incluindo clip paths e bordas arredondadas não uniformes do Core, ficam dentro da máscara temporária e são restauradas depois. Opacidade e transforms são preservados.

Uma view descarregada espera o carregamento, uma janela e dimensões maiores que zero. Revelar um alvo colapsado primeiro muda sua visibilidade para `hidden`, permitindo a medição. Prefira começar com `hidden` quando o espaço já deve estar reservado.

Se o estado do app também controla `visibility`, mantenha-o sincronizado com o efeito. Durante a animação, a máscara recorta apenas a renderização; a área retangular de toque só deixa de responder quando a ocultação termina. Sombras desenhadas fora da própria camada da view não entram no recorte circular.

## Interrupção e limpeza

O resultado tem `finished`, `stop()` e `then()`, como `animate()`:

```ts
const opening = reveal(details, { duration: 800 })
// Uma ação posterior pode inverter a partir do círculo que está na tela.
const closing = conceal(details)

await opening // false: substituída
await closing // true se chegou ao estado oculto
```

A conclusão nativa resolve com `true`. Parar, substituir, descarregar ou cancelar nativamente resolve com `false`. Opções inválidas lançam um erro antes de substituir o efeito ativo. Use o handle retornado; `stop(view)` controla as animações de `animate()`.

`animation.stop()` remove a máscara temporária e restaura a visibilidade anterior à cadeia de revelações e ocultações interrompidas. Ele não deixa uma máscara parcial congelada. Uma mudança externa de visibilidade cancela a animação, preservando o novo valor definido pelo app.

Mudar dimensões, view nativa, fundo ou estilo de recorte cancela o efeito e restaura a visibilidade anterior. Inicie outro efeito depois que a alteração de layout/estilo terminar. Descarregar cancela sem repetir ao carregar novamente. Conclusão e cancelamento removem animação nativa, máscara, listeners e observador de Reduzir Movimento. Guarde o handle e pare-o quando o componente responsável for desmontado.

Use views separadas como wrappers ao combinar este efeito com outro que gerencie máscaras ativamente, como `shimmer()`.

## Reduzir Movimento e plataformas

Com Reduzir Movimento ativado, a visibilidade final é aplicada imediatamente e o resultado é `true`. Ativar a preferência durante a animação também conclui o efeito imediatamente, sem repetir caso ela seja desativada depois.

Esta implementação é **somente para iOS**. No Android, as chamadas resolvem com `false` sem alterar a view.
