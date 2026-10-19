# Feedback tátil

Adicione um impacto quando a animação chegar ao destino:

<Clip name="haptics-ios" caption="Animações de chegada e bounce no simulador iOS. O vídeo não reproduz feedback tátil; para senti-lo é necessário um iPhone físico compatível." />

```ts
animate(card, { y: 0 }, { type: 'spring', haptic: 'light' })
```

Escolha `light`, `medium` ou `heavy`. O feedback precisa ser ativado na chamada e funciona **só no iOS** por enquanto; o Android ignora a opção. É preciso um aparelho físico compatível para senti-lo. O simulador executa a animação, mas não reproduz a sensação.

## Chegada

Uma mola dispara o feedback na mesma chegada visual que avança uma sequência, antes de terminar de se estabilizar. Um tween dispara no fim. Com várias propriedades, o Jolt espera a última chegada e gera um impacto por view. Delays, configurações por propriedade e stagger entram nessa conta.

```ts
animate(
  card,
  { x: 160, scale: 1.1 },
  {
    type: 'spring',
    duration: 500,
    haptic: 'medium',
  },
)
```

Repetições finitas disparam uma vez, no fim da última repetição. Animações infinitas não têm chegada final e não geram feedback. Animações vazias, mudanças com duração zero e keyframes sem movimento também ficam em silêncio.

## Impactos durante o movimento

Use `times` para marcar impactos específicos. São pontos crescentes maiores que `0` e no máximo `1`, ao longo da animação finita completa, depois do delay inicial. Com configurações por propriedade, o intervalo começa no menor delay entre as propriedades em movimento e termina quando a última propriedade acaba. Repetições finitas fazem parte desse intervalo; os pontos não se repetem automaticamente.

O preset `bounce` toca o chão em 60% e 100%:

```ts
animate(button, 'bounce', {
  haptic: { style: 'light', times: [0.6, 1] },
})
```

Os pontos acompanham a duração calculada da animação, sem exigir um timer em milissegundos no app. Eles substituem o impacto padrão de chegada.

## Cancelamento e tempo

`animation.stop()`, `stop(view)` e interrupções cancelam o feedback pendente. Substituir ou parar qualquer propriedade cancela os impactos restantes daquela animação, mesmo que outras propriedades continuem animando. Animações independentes na mesma view mantêm seu próprio feedback.

Descarregar a view cancela seus impactos pendentes de vez. O feedback também é ignorado se a view nativa foi substituída, está fora de uma janela ou o app está inativo. Uma nova animação pode agendar novos impactos quando a view voltar.

O Jolt prepara o `UIImpactFeedbackGenerator` quando a animação começa e novamente pouco antes de um impacto distante. Usa timers pontuais do motor, sem callback JavaScript por frame. A sincronização é aproximada: o JavaScript compartilha a thread de UI no NativeScript, e uma thread ocupada pode atrasar um impacto. Impactos com mais de 100 ms de atraso são descartados. O iOS e as configurações do aparelho determinam se um impacto solicitado será sentido.

Presets customizados podem incluir `haptic` na transição. Passe `haptic: false` para desativá-lo em uma chamada:

```ts
animate(card, 'myPreset', { haptic: false })
```
