# Desfoque animado

Suavize o fundo enquanto um modal, título ou botão continua nítido. `@rafaelaugusto/jolt/blur` controla um efeito nativo com os mesmos conceitos de transição e reprodução do Jolt. Este checkout adiciona a API para a próxima beta; recompile os dois aplicativos nativos para incluir os helpers.

<Clip name="blur-ios" caption="Simulador iOS: toques reais alternam entre nítido, suave e material completo, interrompem uma animação, pausam/retomam a ida e volta e aplicam Reduzir Movimento. Interface em inglês; velocidade original." />
<Clip name="blur-android" caption="Emulador Android 12+: os mesmos controles animam o desfoque do conteúdo enquanto os controles irmãos continuam nítidos. Interface em inglês e toques reais via ADB; velocidade original, sem medição de desempenho em aparelho físico." />

## Mantenha o primeiro plano nítido

Crie o efeito em uma view dedicada ao fundo/conteúdo após o layout nativo. Coloque o conteúdo do modal e os controles em uma view irmã acima dela, fora da view desfocada.

```ts
import { blur } from '@rafaelaugusto/jolt/blur'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const backdrop = scope.add(
  blur(backgroundView, { amount: 0, radius: 24, style: 'light' }),
)

const reveal = backdrop.animate(1, { duration: 700, ease: 'easeInOut' })
reveal.pause()
reveal.progress = 0.5
reveal.play()

// Um novo comando parte da intensidade atualmente exibida.
backdrop.animate(0, 'smooth')

// No descarte definitivo:
scope.dispose()
```

| Opção    | Significado                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| `amount` | Intensidade inicial entre 0 e 1; padrão 0. Zero deixa o conteúdo nítido.                                    |
| `radius` | Raio máximo no Android em DIPs, de 1 a 64; padrão 24. O raio aplicado é `amount × radius`. Ignorado no iOS. |
| `style`  | Material do iOS: `system` (padrão), `light` ou `dark`. Ignorado no Android.                                 |

As opções permanecem fixas durante a vida do handle; descarte e recrie para alterá-las. Cada alvo aceita um único dono. Valores, opções e transições inválidos lançam erro antes de substituir a reprodução existente.

## Materiais nativos diferentes

O iOS adiciona uma `UIVisualEffectView` sem interação acima do conteúdo. Um `UIViewPropertyAnimator` pausado define a transição entre nítido e material; um display link nativo compilado atualiza `fractionComplete`. O efeito acompanha os limites e o raio dos cantos do alvo. Nenhuma API privada de raio é usada. A tonalidade do material, as configurações de transparência da acessibilidade e o estilo do sistema podem alterar a aparência. Intensidade 0,5 significa metade da transição do material, não um raio gaussiano específico. [View de efeito visual da Apple](https://developer.apple.com/documentation/uikit/uivisualeffectview) e [progresso do animator](https://developer.apple.com/documentation/uikit/uiviewanimating/fractioncomplete).

No Android 12 / API 31 ou posterior, um `ValueAnimator` compilado substitui `RenderEffect.createBlurEffect()` no render node da view. Isso desfoca a própria view e seus descendentes; **não** captura views arbitrárias atrás de uma camada transparente. Use a view que contém o conteúdo a suavizar. As bordas usam `CLAMP`. [RenderEffect no Android](https://developer.android.com/reference/android/graphics/RenderEffect).

Em versões anteriores do Android ou sem aceleração por hardware, o fallback mantém o conteúdo intacto. `snapshot().backend` retorna `none`, `appliedAmount` é 0 e os handles terminam imediatamente. O fallback não altera a opacidade nem bloqueia a entrada.

O handle Android assume uso exclusivo do `RenderEffect` do alvo e o remove no descarte. Não combine com um efeito existente/personalizado na mesma view: o Android não expõe o efeito anterior para restauração. Use um wrapper dedicado. Efeitos em views separadas podem coexistir. Não há garantia de que superfícies específicas de câmera/vídeo participem do desfoque da view.

Desfoque é um efeito visual. Ele não oculta elementos de acessibilidade nem desativa a interação com o conteúdo. O aplicativo continua responsável por foco e entrada ao apresentar um modal. Mantenha a view de efeito do iOS e seus ancestrais com opacidade completa para capturar corretamente o fundo; anime a intensidade do material em vez da opacidade da view.

## Reprodução e ciclo de vida

`animate(amount, transition?)` aceita um destino e as transições tween/spring existentes, atraso e repetição. O `PlaybackAnimation` retornado oferece `finished`, `pause()`, `play()`, `stop()` e `progress` finito. Loops infinitos aceitam pausa/retomada, mas rejeitam progresso. Molas herdam a velocidade interrompida e a saída fica limitada a 0–1. Há uma animação por handle; arrays e camadas aditivas nomeadas não são aceitos.

`set(amount)` aplica um valor imediatamente. `stop()` mantém o valor exibido. Ambos cancelam o handle anterior (`finished` resolve `false`). `dispose()` remove o efeito, a reprodução nativa e os listeners; chamadas repetidas são seguras. Opacidade, transformações e handlers de entrada da view de fundo permanecem intactos.

Ir para segundo plano pausa a reprodução. Se o NativeScript descarregar a view nesse momento, a superfície é liberada e o programa pausado continua após o carregamento em primeiro plano. Um unload comum ou troca da view nativa cancela a reprodução e reaplica o valor mantido no próximo load. Uma pausa explícita é preservada. Um motion scope pode assumir o efeito para descarte ou o handle de reprodução para suspensão.

Reduzir Movimento aplica novos destinos imediatamente. Ativá-lo durante uma animação interrompe o handle e aplica seu destino solicitado. Handles no fallback também terminam imediatamente, incluindo pedidos de repetição infinita.

`snapshot()` lê `amount`, `appliedAmount`, `backend`, `attached`, `nativeAnimations`, `frames`, `width` e `height` sob demanda. Não instala um observador. As contagens incluem relógios nativos pausados; efeitos desconectados informam intensidade aplicada e objetos de reprodução iguais a zero.

JavaScript prepara a curva amostrada e trata comandos, ciclo de vida e conclusão. O código nativo atualiza o efeito a cada frame. Os dois helpers usam a thread da UI; isso não promete outra thread, alocação zero nem reprodução durante bloqueio da UI. O custo depende do tamanho da view, raio e aparelho. Restrinja o efeito à área necessária.

O preview **Foco suave / Lento**, em quatro idiomas, é o 72º exemplo. Veja a [validação nativa e reprodução](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/blur.md).
