# Acompanhar o teclado

Mova um campo de mensagem, um botão ou uma barra de ferramentas junto com o teclado virtual:

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

## Android

A partir do Android 11, o sistema informa o progresso do teclado a cada frame por meio de `WindowInsetsAnimation`. O Jolt instala um callback nativo na view, então o trabalho por frame roda em Java e nada passa pelo JavaScript enquanto o teclado se move. O callback mede a view antes e depois do layout feito para o teclado, por isso funciona com `adjustResize` (a view já fica acima do teclado pelo layout e só o movimento é suavizado) e com `adjustPan` e `adjustNothing` (a view é deslocada pela sobreposição). O JavaScript é chamado uma vez quando o movimento começa e uma vez quando ele se acomoda.

A activity do app precisa ter `android:windowSoftInputMode` definido, como o template do NativeScript já faz com `adjustResize`, para a janela receber os insets do teclado. Recompile o app Android depois de atualizar para incluir a classe nativa.

Abaixo do Android 11 a chamada não faz nada e retorna uma limpeza vazia; o comportamento de redimensionamento da plataforma continua.

## Limpeza

O retorno remove o efeito:

```ts
const release = followKeyboard(composer)
release() // para de acompanhar e zera a translação aplicada
```

Descarregar a view também libera o efeito, então uma tela que sai não mantém um observador. Ative de novo ao reutilizar uma view descarregada. Chamar a limpeza duas vezes é inofensivo.
