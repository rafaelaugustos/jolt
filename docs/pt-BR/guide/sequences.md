# Sequências e timelines

Sem uma posição, cada passo começa quando o anterior parece pronto:

<Clip name="timeline" caption="Passos sobrepostos e passos em ordem." />

```ts
await sequence([
  [logo, 'popIn'],
  [[title, subtitle], 'fadeInUp', { stagger: 80 }],
  () => animate(button, 'fadeIn'),
])
```

Cada tupla recebe os mesmos argumentos de `animate()`, mais `at` nas opções. Um callback pode iniciar e retornar uma animação. Springs contam como chegada quando ficam perto do alvo, antes de terminar de assentar.

## Sobreposição e posições fixas

```ts
sequence([
  [logo, 'popIn'],
  [title, 'fadeInUp', { at: '-150' }],
  [buttons, 'fadeIn', { at: '<', stagger: 50 }],
  [footer, 'fadeIn', { at: 900 }],
])
```

| `at`     | Quando o passo começa                      |
| -------- | ------------------------------------------ |
| omitido  | Na chegada do passo anterior               |
| `'-150'` | 150 ms antes dessa chegada                 |
| `'+100'` | 100 ms depois dessa chegada                |
| `'<'`    | Junto com a ativação do passo anterior     |
| `900`    | Aos 900 ms a partir da origem da sequência |

As posições usam milissegundos de animação. Um número é uma posição absoluta não negativa; um deslocamento relativo é uma string decimal com sinal. Posições absolutas independem dos passos anteriores e podem aparecer fora da ordem cronológica. Um passo sem posição continua seguindo o **passo anterior na lista**, não a animação que terminar por último.

`'<'` se refere à ativação antes do `delay` do passo. Esse delay e os delays por propriedade continuam valendo. Por exemplo, dois passos com o mesmo início e delays de 200 e 50 ms começam a se mover com 150 ms de diferença.

O primeiro passo usa a origem da sequência como referência: `'<'`, `'-150'` e `0` começam imediatamente; `'+100'` espera 100 ms. Um deslocamento negativo que antecederia a ativação do predecessor fica limitado a essa ativação. O agendador não volta a animação para recuperar um início que já passou.

Para combinar um spring nomeado com uma posição, use sua forma de objeto:

```ts
import { sequence, springs } from '@rafaelaugusto/jolt'

sequence([
  [card, 'popIn'],
  [title, 'fadeInUp', { ...springs.bouncy, at: '-100' }],
])
```

## Chegada e carregamento

Deslocamentos negativos usam a previsão de chegada das tracks reais, incluindo delay inicial, timing por propriedade, repetições e a última view do stagger. Um alvo ainda não carregado espera ter suas tracks antes de fornecer uma previsão. Ativações absolutas continuam independentes; seus alvos ainda precisam carregar para iniciar a reprodução nativa.

Um callback que retorna `animate()` ou `decay()` também fornece uma previsão. Pausar, continuar ou alterar o progresso desse handle reagenda um seguidor negativo pendente. Depois que um seguidor começa, mudanças posteriores não o desfazem nem repetem.

Um efeito arbitrário, animação personalizada ou sequência aninhada não expõe previsão. Ele pode anteceder um passo sem posição, um deslocamento positivo ou `'<'`; um deslocamento negativo depois dele rejeita `finished` com erro de configuração e cancela o restante da sequência. Uma animação infinita não tem previsão finita; seus seguidores relativos esperam até ela ser interrompida. Posições absolutas ainda podem iniciar outros passos.

Deslocamentos positivos seguem a **chegada real**. Se o passo anterior for interrompido antes da previsão, a espera extra começa nessa interrupção. Um seguidor negativo pendente também avança quando seu predecessor é interrompido, sem manter um prazo que deixou de valer.

## Valores iniciais e propriedade

Views posteriores assumem o primeiro keyframe absoluto quando a sequência é criada, ficando escondidas até sua vez. A preparação mantém a ordem da lista: o primeiro passo listado que toca uma propriedade fornece seu estado inicial, mesmo com posições absolutas fora da ordem cronológica. Keyframes relativos e `null` leem o valor atual quando o passo é ativado.

Passos sobrepostos na mesma propriedade usam as [regras de interrupção](./interrupting): a ativação posterior assume a partir do valor e da velocidade na tela. Um primeiro keyframe explícito continua definindo um início explícito. Propriedades e views diferentes permanecem independentes.

## Conclusão e limpeza

A sequência chega quando **todos** os passos foram iniciados e chegaram. Sua promise `finished` espera todas as animações iniciadas terminarem de assentar, incluindo passos sobrepostos mais longos. Ela resolve com `false` se algum passo foi interrompido ou parado. Isso inclui sobreposição intencional na mesma propriedade.

`stop()` cancela ativações futuras e para todos os passos ativos ou ainda assentando. Chame-o quando o dono da timeline sair da tela:

```ts
const animation = sequence(steps)
onUnmounted(() => animation.stop())
```

O handle retornado mantém o ciclo de vida básico de `Animation`; pausa e progresso da timeline inteira não são expostos. Posições inválidas lançam erro antes de iniciar ou aplicar keyframes. Erros ao criar um callback ou passo adiado rejeitam `finished` depois de cancelar o restante; o cancelamento da reprodução em si resolve com `false`.

## Timing nativo

No Android, os timers de posição e o relógio absoluto da timeline acompanham a **escala de duração do animador** do sistema. Com animações desativadas, passos posicionados avançam sem esperar pelas durações solicitadas. O iOS usa seu relógio de animação.

O JavaScript executa quando um passo é ativado, não a cada frame. Uma thread JS bloqueada pode atrasar uma ativação; esta API não inicia novos passos criados em JS enquanto ele estiver indisponível. Depois que um passo começa, sua reprodução nativa e os limites da plataforma continuam valendo.

O playground compara sobreposição, chegadas sequenciais e tempos fixos usando a mesma entrada.
