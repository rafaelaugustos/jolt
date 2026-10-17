# Efeitos de SF Symbols

`symbolEffect()` toca os efeitos nativos da Apple em uma `Image`. Use um SF Symbol como fonte, por exemplo `sys://bell.fill`.

<Clip name="symbols" caption="Bounce, pulse e replace em SF Symbols." />

```ts
import { symbolEffect } from '@rafaelaugusto/jolt'

symbolEffect(bell, 'bounce')
symbolEffect(heart, 'pulse')
symbolEffect(wifi, 'variableColor')
symbolEffect(favorite, { replace: 'sys://heart.fill' })
```

O alvo é uma única `Image` do NativeScript, ou um ref que contenha uma. O UIKit toca a animação sem trabalho em JavaScript por frame. Essa API é separada dos presets de transformação do `animate()`.

## Efeitos e opções

| Efeito                      | Comportamento                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `bounce`                    | Faz o símbolo saltar uma vez.                                                          |
| `pulse`                     | Pulsa a opacidade uma vez.                                                             |
| `variableColor`             | Anima as camadas do símbolo, como as barras de `wifi`. O resultado depende do símbolo. |
| `scale`                     | Escala o símbolo e mantém o efeito até ser parado.                                     |
| `{ replace: 'sys://nome' }` | Faz a transição para outro símbolo e atualiza `src` e `imageSource` da Image.          |

`speed` é um multiplicador positivo do tempo da Apple, não uma duração em milissegundos. Bounce, pulse e variable color aceitam `repeat: true` para continuar tocando. Scale e replacement não repetem.

```ts
const loading = symbolEffect(wifi, 'variableColor', { repeat: true, speed: 0.8 })
loading.stop()

const selected = symbolEffect(star, 'scale')
selected.stop() // remove a escala mantida
```

## Conclusão e limpeza

O retorno tem `finished`, `stop()` e `then()`, como as outras animações do Jolt:

```ts
const completed = await symbolEffect(bell, 'bounce')

await sequence([
  () => symbolEffect(favorite, { replace: 'sys://heart.fill' }),
  () => animate(card, 'popIn'),
])
```

Efeitos finitos resolvem com `true` quando o UIKit informa que terminaram. Efeitos parados, substituídos ou ignorados resolvem com `false`. Scale e efeitos em repetição ficam pendentes até serem parados. Parar uma troca mantém o ícone de destino.

Uma nova chamada de `symbolEffect()` na mesma Image cancela a anterior. Descarregar a view ou mudar sua fonte também cancela o efeito. Chamadas feitas antes da view ou da imagem carregar esperam por ela. Para parar um efeito de símbolo, use o retorno da chamada; `stop(view)` controla as propriedades tocadas por `animate()`.

A troca carrega o novo símbolo de forma síncrona, preservando `loadMode`, tint e configuração do símbolo. Se `src` estiver ligado ao estado da aplicação, mantenha esse estado atualizado também, para uma renderização futura não restaurar o ícone anterior. Evite controlar a mesma Image com `iosSymbolEffect` enquanto o Jolt estiver tocando um efeito.

## Compatibilidade

Os efeitos exigem **iOS 17+**. Em versões anteriores do iOS, efeitos decorativos são ignorados e a troca atualiza o ícone imediatamente. Um símbolo indisponível mantém o ícone atual e resolve com `false`.

Com Reduzir Movimento ativado no início da animação, os efeitos decorativos são ignorados e a troca é imediata. No Android, todas as chamadas resolvem com `false` sem alterar a Image, incluindo troca. Um bitmap não toca efeitos de símbolo; trocá-lo por um símbolo é imediato.

Veja as definições dos efeitos na documentação do framework [Symbols](https://developer.apple.com/documentation/symbols?language=objc) da Apple.
