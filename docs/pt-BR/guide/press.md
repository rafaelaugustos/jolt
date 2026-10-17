# Press

```ts
const remove = press(button) // escala para 0.96 enquanto pressionado
press(card, { scale: 0.97, opacity: 0.8 })
press(tile, { scale: 0.9, rotate: -4 }, 'bouncy')
```

<Clip name="press" caption="Três efeitos de press no Android." />

Anima até os valores dados enquanto um dedo está na tela, e de volta para onde a view estava quando ele levanta, ou quando o toque é cancelado por um scroll que assume. Views com `isEnabled` em `false` não reagem. Retorna uma função que remove o efeito.
