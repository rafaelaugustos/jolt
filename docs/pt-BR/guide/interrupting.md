# Interrompendo e parando

Iniciar uma animação numa propriedade que já está animando assume o controle: a nova começa do valor na tela, com a mesma velocidade, então um card pode mudar de ideia no meio do caminho sem pulo. As outras propriedades da animação anterior continuam.

O `animate()` retorna uma animação que você pode esperar com `await`. Ela resolve com `true` quando tocou até o fim, e `false` quando foi parada ou substituída. Nunca rejeita.

```ts
const animation = animate(card, { x: 300 })
animation.stop() // o card fica onde está

stop(card) // para tudo que está rodando no card
stop(card, ['x', 'scale']) // para a translação em x e os dois eixos de escala
```

As propriedades selecionadas ficam no valor atual; as outras continuam animando. Também dá para parar `scaleX` e `scaleY` separadamente. Um array vazio não para nenhuma propriedade; sem o segundo argumento, todas param. Funciona com arrays de alvos também.

Se parte de uma animação for parada, a promise `finished` resolve com `false` quando as propriedades restantes terminarem.

## Loops e o segundo plano

Repetições infinitas continuam tocando nativamente. No iOS, o Core Animation descarta as animações quando o app vai para o segundo plano; o Jolt as inicia de novo quando ele volta.

Para pausar e escolher o frame de uma animação, veja [pausa e controle de progresso](./playback).
