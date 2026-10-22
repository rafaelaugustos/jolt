# Acompanhar o teclado

Mova um campo de mensagem, um botão ou uma barra de ferramentas junto com o teclado virtual:

<Clip name="keyboard" caption="O composer acompanhando o teclado no Android." />

```ts
import { followKeyboard } from '@rafaelaugusto/jolt'

const release = followKeyboard(composer)
followKeyboard(sendButton, { offset: 12 })
```

Quando o teclado aparece, a view sobe exatamente a distância que ficaria coberta, na velocidade e na curva do próprio teclado. Quando o teclado muda de altura, a view acompanha. Quando ele some, a view volta ao lugar. Uma view que o teclado não alcança fica onde está.

O alvo é uma view ou qualquer coisa que contenha uma, como em `animate()`. Ative o efeito antes de o teclado aparecer; ele reage às mudanças do teclado e não lê a posição atual por conta própria.

## Offset

`offset` mantém DIPs extras entre a borda inferior da view e o teclado:

```ts
followKeyboard(composer, { offset: 8 })
```

O padrão é zero, então a view termina encostada no topo do teclado.

## O que se move

O efeito é dono do `translateY` da view. Ele grava a propriedade do NativeScript, então o valor que o app lê e o valor de onde o Jolt começa a próxima animação são o que está na tela. Qualquer animação do Jolt em `y` é parada na posição atual antes de o teclado assumir, para que as duas nunca briguem. Outras propriedades e outras views ficam intactas.

A posição da view sem translação é medida quando o teclado se move. Mudanças de layout com o teclado aberto não são acompanhadas; a próxima mudança do teclado mede de novo.

## iOS

O Jolt observa `UIKeyboardWillChangeFrameNotification`, que cobre aparecer, sumir, mudar de altura e os layouts dividido e flutuante do iPad. A notificação traz o frame final, a duração e a curva do teclado. O frame é convertido para a janela da view, e a view se move dentro de uma animação de `UIView` com essa duração e essa curva, ficando presa à borda do teclado durante todo o movimento. A curva é um valor privado que só existe deslocado para dentro das opções de animação; o Jolt faz isso por você.

Teclados físicos e mudanças com duração zero aplicam a nova posição imediatamente.

<Clip name="keyboard-ios" caption="No simulador iOS, o composer sobe com o teclado e volta quando ele fecha, enquanto onKeyboard() encolhe o selo na própria mola do teclado. Velocidade real." />

## Android

A partir do Android 11, o sistema informa o progresso do teclado a cada frame por meio de `WindowInsetsAnimation`. O Jolt instala um callback nativo na view, então o trabalho por frame roda em Java e nada passa pelo JavaScript enquanto o teclado se move. O callback mede a view antes e depois do layout feito para o teclado, por isso funciona com `adjustResize` (a view já fica acima do teclado pelo layout e só o movimento é suavizado) e com `adjustPan` e `adjustNothing` (a view é deslocada pela sobreposição). O JavaScript é chamado uma vez quando o movimento começa e uma vez quando ele se acomoda.

A activity do app precisa ter `android:windowSoftInputMode` definido, como o template do NativeScript já faz com `adjustResize`, para a janela receber os insets do teclado. Recompile o app Android depois de atualizar para incluir a classe nativa.

Do Android 7 ao 10 não existe progresso a cada frame. Nessas versões, o Jolt lê o teclado pelo frame visível da janela a cada layout. Quando um layout feito para o teclado move a view, o Jolt a devolve para onde estava e a anima até o lugar dela acima do teclado, no tempo de costume do teclado: cerca de 150 ms, desacelerando ao abrir e acelerando ao fechar, como medido num emulador com Android 9. Isso cobre o `adjustResize`, em que o layout já sobe a view, e o `adjustPan` e o `adjustNothing`, em que a view é deslocada pela sobreposição. A animação é uma animação nativa comum do Jolt, iniciada uma vez por mudança.

<Clip name="keyboard-android-9" caption="Num emulador com Android 9, o composer sobe de onde o layout o colocou até ficar acima do teclado e volta quando ele fecha, enquanto onKeyboard() informa 297 DIPs e os 150 ms medidos. Velocidade real." />

## Estado do teclado

Muitas vezes a tela precisa reagir de outros jeitos: compactar um cabeçalho, mover uma ilustração, abrir espaço no fim de uma rolagem. `onKeyboard()` informa quanto da janela o teclado cobre e como ele chega lá:

```ts
import { animate, onKeyboard } from '@rafaelaugusto/jolt'

const off = onKeyboard(({ visible, height, duration, transition }) => {
  animate(header, { scale: visible ? 0.8 : 1 }, transition)
})
```

<Clip name="keyboard-state-android" caption="No emulador Android, onKeyboard() informa 336 DIPs e os 285 ms do teclado, e o selo encolhe na própria curva do teclado enquanto o composer o acompanha. Velocidade real." />

| Campo        | Significado                                                                             |
| ------------ | --------------------------------------------------------------------------------------- |
| `visible`    | um teclado encaixado cobre parte da janela                                              |
| `height`     | DIPs da janela cobertos, a partir da borda inferior; zero quando escondido ou flutuante |
| `duration`   | milissegundos que o teclado leva para chegar; zero quando muda de uma vez               |
| `transition` | o timing do próprio teclado, pronto para o `animate()`, para outras views acompanharem  |

O callback roda quando a altura coberta muda: ao abrir, ao fechar, ao trocar para um teclado mais alto. Um teclado flutuante ou desencaixado no iPad não cobre nada e informa `visible: false`. Todos os listeners compartilham um único observador, removido com a última limpeza.

No iOS o teclado se move numa mola que o Core Animation toca criticamente amortecida em 500 ms; `transition` é essa mola (`stiffness: 1000`, `mass: 3`). O iOS só avisa das mudanças do teclado quando elas acontecem, então um teclado que já estava aberto quando o primeiro listener se inscreveu aparece na próxima mudança. No Android 11 ou mais novo, um callback nativo na janela lê a duração do teclado e amostra o interpolador dele, então `transition` segue a mesma curva. Um teclado já aberto é conhecido desde o início. Do Android 7 ao 10, a altura vem do frame visível da janela, `duration` é 150 e `transition` é um `quadOut` de 150 ms quando o teclado abre e um `quadIn` quando ele fecha, o tempo medido num emulador com Android 9; a altura inclui a barra de navegação abaixo do teclado, como no Android 11.

No Vue, [`useKeyboard()`](./vue#teclado) devolve um ref que fica atualizado até o componente desmontar.

## Limpeza

O retorno remove o efeito:

```ts
const release = followKeyboard(composer)
release() // para de acompanhar e zera a translação aplicada
```

Descarregar a view também libera o efeito, então uma tela que sai não mantém um observador. Ative de novo ao reutilizar uma view descarregada. Chamar a limpeza duas vezes é inofensivo.
