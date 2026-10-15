# Texto

Revele um título letra por letra, ou uma palavra de cada vez:

```ts
import { animateText } from '@rafaelaugusto/jolt'

await animateText(title)
await animateText(title, { by: 'word', stagger: 100 })
```

O alvo deve ser uma `Label` do NativeScript, ou um template ref / `ElementRef` que contenha uma. O TextKit calcula o layout do texto inteiro antes de o Jolt separar os glifos em layers temporárias com imagens. Espaços, quebras de linha, alinhamento e estilos do texto formatado ficam no lugar. Caracteres compostos, como letras acentuadas e emoji unidos, continuam juntos; letras que compartilham uma ligatura animam juntas.

Cada parte aparece com fade e se move até sua linha de base original. O Core Animation toca o efeito sem callbacks JavaScript por frame. A Label original mantém seu layout e seu elemento de acessibilidade, com o texto acessível completo durante toda a animação. As layers temporárias não criam elementos acessíveis.

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

Unload, troca da view nativa, mudanças no texto/estilo ou redimensionamento dos bounds cancelam a reprodução e removem as layers temporárias. Mudanças do app no texto e no rótulo acessível são preservadas. Reduzir Movimento pula a entrada; ativá-lo durante a reprodução restaura o texto inteiro imediatamente e resolve com `true`.

## Escopo

iOS por enquanto. No Android, a chamada resolve com `false` e mantém a Label intacta.

O efeito foi pensado para títulos e trechos curtos. Labels com texto truncado, anexos embutidos ou redução automática da fonte mantêm o texto original e resolvem com `false`. O mesmo vale acima de 256 partes ou quando as imagens ultrapassariam quatro milhões de pixels (cerca de 16 MB em RGBA). Texto vazio conclui imediatamente. Mudanças de Dynamic Type que afetam o layout cancelam a entrada; a Label normal passa a usar o layout atualizado.
