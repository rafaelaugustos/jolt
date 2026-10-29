# Press

```ts
const remove = press(button) // escala para 0.96 enquanto pressionado
press(card, { scale: 0.97, opacity: 0.8 })
press(tile, { scale: 0.9, rotate: -4 }, 'bouncy')
```

<Clip name="press" caption="Três efeitos de press no Android." />

Anima até os valores dados enquanto um dedo está na tela, e de volta para onde a view estava quando ele levanta, ou quando o toque é cancelado por um scroll que assume. Views com `isEnabled` em `false` não reagem. Retorna uma função que remove o efeito.

## Press em sua própria camada {#layered-press}

**Corrigido na 0.1.0-rc.2:** use um nome de camada exclusivo quando o press precisar conviver com uma entrada ou outro movimento. As contribuições de translação e rotação voltam a `0`; escala e opacidade voltam a `1`. Soltar ou cancelar o toque restaura a base atual, inclusive com translação diferente de zero ou escala diferente de um. Remover o efeito também limpa a contribuição de um press já estabilizado.

```ts
set(card, { x: 24, scale: 1.5 })
const remove = press(card, { x: 8, scale: 0.88 }, { layer: 'press' })
animate(card, { x: 80 }, 'snappy')
// Ao terminar: remove()
```

Reserve esse nome de camada para o efeito de press. As outras camadas continuam independentes. Sem `layer`, press mantém o comportamento atual de animar a base e retornar aos valores de repouso capturados.

<Clip name="motion-rfc-ios" caption="Simulador iOS 26.2, demo Layers em inglês com a auditoria opcional da RFC: toque real mantido, remoção da shake durante a entrada, soltura preservando a base, duas camadas infinitas e troca de janela de composição. Reprodução nativa na velocidade original; sem medição em aparelho físico." />
<Clip name="motion-rfc-android" caption="Emulador Android 16 / API 36, demo Layers em inglês com a auditoria opcional da RFC: toques reais via ADB exercitam press, camadas independentes e troca de janela. Velocidade original; evidência de correção no emulador." />
