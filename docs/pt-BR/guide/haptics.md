# Feedback tátil

Adicione um impacto quando a animação chegar ao destino:

<Clip name="haptics-ios" caption="Animações de chegada e bounce no simulador iOS. O vídeo não reproduz feedback tátil; para senti-lo é necessário um iPhone físico compatível." />

<Clip name="haptics-android" caption="Chegadas de molas, bounce, stagger e controles de reprodução em um emulador Android 15. Flashes brancos indicam pedidos nativos de feedback, não comprovam vibração. O vídeo não reproduz a sensação tátil." />

<Clip name="haptics-android-device" caption="Toques reais em um ASUS_Z017DC físico, Android 8.0, escala do Animator em 1 e feedback de toque ativado. Flashes brancos marcam pedidos na view nativa; a gravação não reproduz a sensação tátil." />

```ts
animate(card, { y: 0 }, { type: 'spring', haptic: 'light' })
```

Escolha `light`, `medium` ou `heavy`. O feedback precisa ser ativado na chamada e funciona no **iOS e no Android**. É preciso um aparelho físico compatível para senti-lo. Um simulador/emulador permite verificar os pedidos e seus tempos, mas não comprova a sensação. As configurações e o hardware decidem se o pedido será sentido; os estilos não são intensidades calibradas entre aparelhos.

## Comportamento no Android

O Jolt chama [`View.performHapticFeedback()`](https://developer.android.com/develop/ui/views/haptics/haptic-feedback) sem flags que ignorem configurações e sem exigir a permissão `VIBRATE`. Respeita `hapticFeedbackEnabled` da view e a preferência de feedback de toque do sistema. Um pedido recusado não é repetido com uma vibração mais forte.

| Estilo   | Mapeamento no Android    | Alternativa em versões anteriores |
| -------- | ------------------------ | --------------------------------- |
| `light`  | `CLOCK_TICK`, API 21+    | `KEYBOARD_TAP`                    |
| `medium` | `CONTEXT_CLICK`, API 23+ | `KEYBOARD_TAP`                    |
| `heavy`  | `LONG_PRESS`             | Mesmo efeito                      |

Nas versões modernas do Android, um retorno `true` da API pode confirmar o envio assíncrono mesmo quando o sistema suprime o pedido depois. Isso não comprova vibração.

São categorias de feedback da plataforma, não formas de onda personalizadas. Fabricantes podem fazer duas categorias parecerem semelhantes. Haptics não exige o pacote opcional de adaptadores nativos.

As [notas de validação nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/haptics.md) registram configurações, instantes dos pedidos e a diferença entre confirmação de envio pela plataforma e feedback sentido.

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

`pause()` segura os impactos pendentes, e `play()` agenda o tempo restante. Isso também vale para animações controladas por `timeline()`. Seek descarta os pontos atravessados; voltar o progresso não repete impactos já consumidos. São eventos que acontecem uma vez, não uma forma de onda reversível.

No iOS, o Jolt prepara o `UIImpactFeedbackGenerator` quando a animação começa e novamente pouco antes de um impacto distante. No Android, marcadores nativos pontuais acompanham a escala de duração dos animadores, e o pedido de impacto passa pelo JavaScript no instante agendado. O agendador de haptics não usa callback JavaScript por frame. A demo observa o progresso separadamente para mostrar a porcentagem.

A sincronização é aproximada: o JavaScript compartilha a thread de UI no NativeScript, e uma thread ocupada pode atrasar um pedido. Impactos com mais de 100 ms de atraso **no tempo da animação** são descartados. Um pedido aceito no instante correto ainda não garante que o feedback físico seja sentido.

## Configurações de movimento

A câmera lenta do Jolt e a escala de duração dos animadores Android alteram os tempos dos impactos junto com a reprodução. A escala **0** do Android desativa os impactos mesmo quando `configure({ reducedMotion: 'never' })` mantém uma animação lógica. Mudar a escala para zero também silencia os pedidos pendentes.

Transformações que vão diretamente ao destino por movimento reduzido não geram impactos. Animações de opacidade/cor que continuam rodando podem manter o feedback solicitado explicitamente, exceto quando os animadores Android estão desativados. `haptic: false` sempre desativa o feedback daquela chamada.

Presets customizados podem incluir `haptic` na transição. Passe `haptic: false` para desativá-lo em uma chamada:

```ts
animate(card, 'myPreset', { haptic: false })
```
