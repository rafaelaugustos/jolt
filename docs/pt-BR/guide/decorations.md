# Cantos, bordas e sombras

Bordas uniformes usam `animate()` no iOS e no Android:

<Clip name="decorations" caption="Raio, borda e sombra mudando juntos." />

```ts
card.borderRadius = 8
card.borderWidth = 2
card.borderColor = '#b6ee64'

animate(card, { borderRadius: 40, borderWidth: 6 }, { duration: 800 })
```

As dimensões são números em DIPs. Arrays, `null`, transições por propriedade, springs, atrasos, repetições, stagger, sequências e parada seletiva funcionam normalmente. O padrão é um tween de 300 ms. Springs podem ultrapassar o destino; raios, espessuras e elevação são limitados a zero, e a opacidade da sombra a 0–1. Valores explícitos fora desses limites são rejeitados.

```ts
animate(card, { borderRadius: 0, rotate: 12 }, 'bouncy')
stop(card, ['borderRadius']) // a rotação continua
```

Uma substituição começa no valor visível. Parar grava esse valor no modelo e resolve com `false`. Descarregar a view ou alterar sua decoração externamente cancela a reprodução nativa. `relative: true` soma dimensões e parâmetros da sombra aos valores iniciais.

## Geometria e layout

As espessuras, os raios e as cores das quatro bordas devem ser uniformes no início. Clip paths e cantos squircle são rejeitados. Cantos individuais, espessuras por lado e morphing de formas arbitrárias não são suportados. A validação acontece antes de `animate()` alterar qualquer alvo.

`borderRadius` anima o contorno do background; o recorte do conteúdo nativo segue o estilo final do Core. No iOS, o raio é limitado à metade do menor lado, e a sombra acompanha a mesma curva amostrada.

`borderWidth` anima o traço visual. O NativeScript calcula o layout do texto e dos filhos com a espessura final imediatamente; padding e medição do conteúdo não são animados por frame. Para manter o conteúdo fixo, anime a borda numa view decorativa separada.

## Sombras no iOS

Configure uma `boxShadow` externa do NativeScript e anime seus parâmetros:

```ts
card.boxShadow = '0 4 8 rgba(0, 0, 0, 0.2)'
animate(
  card,
  {
    borderRadius: 40,
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffsetX: -8,
    shadowOffsetY: 20,
  },
  { duration: 1000 },
)
```

| Propriedade                      | Significado                                                                 |
| -------------------------------- | --------------------------------------------------------------------------- |
| `shadowOpacity`                  | Alpha de 0 a 1                                                              |
| `shadowRadius`                   | Raio nativo do blur em DIPs; **metade** do `blurRadius` CSS do NativeScript |
| `shadowOffsetX`, `shadowOffsetY` | Deslocamentos positivos ou negativos em DIPs                                |

O Jolt anima a camada de sombra do Core. Mudar o raio também anima o contorno da sombra e seu recorte interno. Uma sombra com opacidade zero continua apagada após um redraw do Core. A cor e o spread permanecem iguais. Animar os parâmetros exige exatamente uma sombra externa já configurada; listas de sombras, inset, spread e cor da sombra não são interpolados.

## Sombras no Android

O Android oferece sombras por elevação:

```ts
animate(
  card,
  {
    borderRadius: 40,
    elevation: 24,
    translationZ: 8,
  },
  { duration: 1000 },
)
```

`elevation` grava `androidElevation` no NativeScript. `translationZ` grava o deslocamento Z nativo; mudanças de estado do controle podem substituí-lo depois da reprodução. Ambos usam DIPs. O Jolt suspende o animador de estados enquanto controla Z e depois o restaura. A aparência depende da iluminação do Android, do contorno do background e do recorte do container pai.

Use sombras de elevação ao animar o raio no Android. O Core guarda a geometria da `boxShadow` CSS em cache; por isso, `borderRadius` numa view com essa sombra é rejeitado. Os parâmetros de sombra do iOS lançam erro no Android; `elevation` e `translationZ` lançam erro no iOS. Escolha as propriedades conforme a plataforma.

Quando raio e espessura terminam em zero, o Jolt mantém um drawable do Core durante a reprodução e depois restaura o background final.

Raio e espessura redesenham o drawable existente do Core em Java nativo, preservando imagem, gradiente e cor. Não há JavaScript por frame, mas o desenho usa a UI thread; [bloqueá-la com JavaScript](./android-performance) pode causar travamentos. O helper depende dos campos nativos do Core: versões incompatíveis pulam a reprodução com `false` e mantêm o modelo final. Recompile o Android depois de instalar ou atualizar o Jolt.
