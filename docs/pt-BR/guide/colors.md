# Cores

Cores de fundo, borda e texto usam `animate()` no iOS e no Android:

<Clip name="colors" caption="Cores de fundo e texto interpoladas em OKLab." />

```ts
animate(
  card,
  {
    backgroundColor: '#263b27',
    borderColor: '#b6ee64',
    color: '#d5ff91',
  },
  { duration: 800 },
)
```

Use uma string de cor do NativeScript ou um objeto `Color`. Arrays definem keyframes; `null` representa a cor visível quando a animação começa:

```ts
animate(
  card,
  {
    backgroundColor: [null, '#38273f', '#21394a'],
  },
  { duration: 1800, times: [0, 0.3, 1] },
)
```

Por padrão, cores usam um tween de 300 ms. Transições por propriedade, springs, delays, repetições e stagger funcionam como nas demais propriedades. O progresso de um spring fica limitado à primeira e à última cor; cores não herdam velocidade escalar. Os valores de cor continuam absolutos com `relative: true`.

## Interpolação

O Jolt calcula as cores intermediárias em OKLab com alfa pré-multiplicado, limita o resultado ao gamut sRGB e entrega as amostras ao animador nativo. Isso evita o meio escuro da interpolação RGB entre cores saturadas e impede que uma cor transparente acrescente seu tom invisível à transição. Não há JavaScript por frame.

Transforms e cores podem rodar juntos. Uma nova animação assume a partir da cor na tela. Para parar uma cor enquanto o restante continua:

```ts
stop(card, ['backgroundColor'])
```

Parar salva a cor visível no modelo do NativeScript e resolve a animação com `false`. Ao terminar normalmente, a cor final permanece no modelo. Mudar a cor diretamente ou descarregar a view cancela a reprodução nativa daquela propriedade.

## Bordas e fundos

`borderColor` exige a mesma cor inicial nas quatro bordas. Espessuras e raios dos cantos podem ser diferentes. Gradientes, imagens, clip paths e sombras são preservados; seus parâmetros não são interpolados. Uma cor de fundo atrás de um gradiente opaco continua coberta por ele. No iOS, o Core rasteriza imagens de fundo junto com a cor: a reprodução de cor de fundo nessas views é ignorada com `false`, mantendo a imagem e a cor final do modelo.

O iOS anima a camada de fundo ou borda existente. O Android usa um pequeno alvo Java de `ObjectAnimator` que atualiza o drawable do Core sem substituir a geometria nem a imagem. Ele acompanha a troca do drawable pelo Core durante a animação. A compatibilidade depende dos campos nativos do drawable do Core; se estiverem indisponíveis, a reprodução é ignorada e a cor final do modelo é mantida. Recompile o app Android após instalar ou atualizar o Jolt para incluir o alvo nativo.

## Texto

No iOS, `color` suporta Label e Button. O Jolt desenha uma máscara alfa do UILabel uma vez e anima uma camada sólida através dela, preservando quebra de linha, fontes e posição dos caracteres. Spans e strings formatadas com cor explícita mantêm essa cor. Texto e acessibilidade continuam no label nativo original. Editar o texto, mudar seu layout ou estilo cancela a reprodução e restaura o texto atual do modelo. Iniciar `animateText()` também libera uma máscara de cor de texto ativa.

Emoji colorido e algumas faixas de símbolos, anexos, sombras de texto e máscaras acima de quatro milhões de pixels são ignorados no iOS: a cor final é aplicada ao modelo e `finished` resolve com `false`. A animação de cor não suporta TextField e TextView no iOS. Não há fallback que anime uma captura de todo o controle.

No Android, `color` suporta controles TextBase e usa o setter de cor de texto nativo. Cores explícitas dos spans formatados são preservadas pelo Android.
