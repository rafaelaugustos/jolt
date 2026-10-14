# Interrompendo e parando

Iniciar uma animação numa propriedade que já está animando assume o controle: a nova começa do valor na tela, com a mesma velocidade, então um card pode mudar de ideia no meio do caminho sem pulo. As outras propriedades da animação anterior continuam.

O `animate()` retorna uma animação que você pode esperar com `await`. Ela resolve com `true` quando tocou até o fim, e `false` quando foi parada ou substituída. Nunca rejeita.

```ts
const animation = animate(card, { x: 300 })
animation.stop() // o card fica onde está

stop(card) // para tudo que está rodando no card
```

## Loops e o segundo plano

Repetições infinitas continuam tocando nativamente. No iOS, o Core Animation descarta as animações quando o app vai para o segundo plano; o Jolt as inicia de novo quando ele volta.
