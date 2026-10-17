# Texto

Revele um título letra por letra, ou uma palavra de cada vez:

<div class="clips">
<Clip name="text-ios" caption="Entradas por letra e por palavra no iOS." />
<Clip name="text-android" caption="As mesmas entradas no Android." />
</div>

```ts
import { animateText } from '@rafaelaugusto/jolt'

await animateText(title)
await animateText(title, { by: 'word', stagger: 100 })
```

O alvo deve ser uma `Label` do NativeScript, ou um template ref / `ElementRef` que contenha uma. Espaços, quebras de linha, alinhamento e estilos do texto formatado ficam no lugar. Caracteres compostos, como letras acentuadas e emoji unidos, continuam juntos.

Cada parte aparece com fade e se move até sua linha de base original. A Label original mantém seu layout e seu elemento de acessibilidade, com o texto acessível completo durante toda a animação, e nada roda em JavaScript a cada frame.

- **iOS:** o TextKit calcula o layout do texto inteiro antes de o Jolt separar os glifos em layers temporárias com imagens, que o Core Animation reproduz. Letras que compartilham uma ligatura animam juntas. As layers temporárias não criam elementos acessíveis.
- **Android:** spans que só afetam o desenho aplicam fade e deslocamento a cada parte, com um único animator nativo. A TextView mantém seu texto, quebras de linha, truncamento e os spans do texto formatado; nada é medido de novo.

## Opções

| Opção      | Padrão     | Significado                                                                    |
| ---------- | ---------- | ------------------------------------------------------------------------------ |
| `by`       | `'letter'` | `'letter'` ou `'word'`; a pontuação acompanha sua palavra no modo por palavra. |
| `duration` | `400`      | Milissegundos por parte.                                                       |
| `stagger`  | `35`       | Milissegundos entre as partes, na ordem do texto.                              |
| `delay`    | `0`        | Milissegundos antes da primeira parte.                                         |
| `y`        | `12`       | Deslocamento vertical inicial em DIPs; valores negativos entram por cima.      |

O tempo total é `delay + duration + (partes - 1) * stagger`. Espaços não adicionam passos no modo por letra. Duração zero revela o texto inteiro imediatamente, inclusive quando um delay foi pedido.

## Parada e mudanças

```ts
const entrance = animateText(title, { by: 'word', y: 18 })
entrance.stop()

await sequence([() => animateText(title), () => animate(button, 'fadeIn')])
```

Retorna uma `Animation`: você pode usar `await`, ler `finished` ou chamar `stop()`. A conclusão nativa resolve com `true`. Parar restaura o texto inteiro e resolve com `false`. Iniciar outro `animateText()` na mesma Label cancela a entrada anterior e recomeça.

Unload, troca da view nativa ou mudanças no texto/estilo cancelam a reprodução e restauram o texto inteiro; no iOS, redimensionar os bounds também. Mudanças do app no texto e no rótulo acessível são preservadas. Reduzir Movimento no iOS e Remover animações no Android (animators desativados) pulam a entrada; ativar Reduzir Movimento durante a reprodução restaura o texto inteiro imediatamente e resolve com `true`.

## Escopo

O efeito foi pensado para títulos e trechos curtos. Acima de 256 partes, a Label mantém o texto original e resolve com `false`. Texto vazio conclui imediatamente.

No iOS, Labels com texto truncado, anexos embutidos ou redução automática da fonte mantêm o texto original e resolvem com `false`. O mesmo vale quando as imagens ultrapassariam quatro milhões de pixels (cerca de 16 MB em RGBA). Mudanças de Dynamic Type que afetam o layout cancelam a entrada; a Label normal passa a usar o layout atualizado.

No Android, reconstrua o app depois de atualizar para incluir a classe nativa; sem ela, a chamada resolve com `false` e mantém o texto. Texto truncado é animado como aparece na tela, e letras dos dois lados de uma divisão perdem a ligatura enquanto a entrada toca.
