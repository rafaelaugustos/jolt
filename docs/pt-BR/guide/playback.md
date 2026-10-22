# Pausar, retomar e controlar o progresso

## Observando a reprodução

`playbackProgress(animation)` expõe o relógio de uma animação finita existente como [valor derivado](./motion-values) somente para leitura. Oferece `get()`, `to()` e `subscribe()` e pode alimentar alvos nativos com `bind()`. Dispensa timer no aplicativo e uma segunda animação:

```ts
const drive = animate(car, { path: route }, { duration: 8000, ease: 'linear' })
const progress = playbackProgress(drive)
const releaseBar = bind(bar, { scaleX: progress })
const releaseNumber = progress.subscribe((p) => {
  remainingMeters.value = Math.ceil(routeMeters * (1 - p))
})
drive.pause() // congela o carro, a ligação e o valor observado
drive.play()
// Ao destruir: releaseBar(); releaseNumber(); drive.stop()
```

A fórmula de distância supõe um caminho com velocidade constante, como na demo. Progresso de reprodução representa tempo da timeline, não posição com easing nem distância geográfica. Com easing, pausas no caminho ou coordenadas geográficas, mapeie o progresso pela função de parâmetro/comprimento real da rota.

<Clip name="controlled-playback-ios" caption="Distância observável e barra seguem o carro; uma timeline pausa carro, pulso, ripple e checkpoint atrasado. Simulador iOS, em tempo real." />
<Clip name="controlled-playback-android" caption="O mesmo progresso e controle conjunto no emulador Android. Reprodução nativa real com toques reais." />

O valor segue o mesmo relógio nativo, incluindo delays, stagger, repeat/reverse, câmera lenta e a escala de animação Android. Seek o atualiza sem mudar o estado pausado/em reprodução. Antes do carregamento, lê zero ou um progresso explicitamente solicitado e ainda pendente. Conclusão lê um; cancelamento mantém a posição parada. Uma animação instantânea concluída lê um. Animações infinitas e timelines cuja duração ainda é desconhecida rejeitam progresso normalizado.

Ligações nativas compilam tracks sem quadros de observação JavaScript. Assinantes ativam a fonte JavaScript compartilhada dos motion values: callbacks só rodam quando JavaScript pode executar, agrupam mudanças e recebem o valor atual depois de um bloqueio. O valor final fica legível antes de `finished` resolver, mas a notificação final pode chegar no quadro seguinte, depois da promise. Cancele a assinatura quando terminar; scopes podem gerenciá-la. Uma fonte pausada ou encerrada não mantém observação contínua.

`animate(motionValue, ...)` agora também retorna `PlaybackAnimation`. Os controles afetam somente aquele canal: pausar a base não pausa uma camada aditiva independente. Use [`timeline()`](./sequences#controle-conjunto) para controlá-los juntos. Parar uma camada ativa continua removendo sua contribuição; pausar a preserva.

## Controles individuais

`animate()` e `decay()` retornam uma `PlaybackAnimation`. Pause, escolha o progresso e continue:

<Clip name="playback" caption="Play e pause numa timeline em andamento." />

```ts
const animation = animate(card, 'flipInY')
animation.pause()
animation.progress = 0.4
animation.play()
```

`pause()` congela apenas as propriedades que essa animação controla. Outras animações na mesma view, efeitos nos filhos e animações nativas dos controles continuam. `play()` retoma da posição atual. Repetir essas chamadas não muda o resultado.

## Progresso

`progress` vai de 0 a 1 na **timeline finita inteira**, incluindo atrasos iniciais, atrasos por propriedade, repetições, repetições reversas e stagger. `duration` informa a duração em milissegundos; `paused` indica se está pausada.

```ts
const animation = animate(
  cards,
  { x: [0, 100], opacity: [0, 1] },
  { duration: 1000, stagger: 200 },
)
animation.pause()
animation.progress = 0.5
```

Com dois cards, a timeline dura 1200 ms. Em 50%, o primeiro está em 60% do movimento e o segundo em 40%. Propriedades com durações diferentes usam a mesma faixa de tempo.

Alterar o progresso preserva o estado de pausa ou reprodução. Pausada, a animação pode chegar a 1 e voltar sem encerrar. Em reprodução, continua da nova posição e termina normalmente. Valores fora de 0–1, `NaN` e infinitos lançam erro antes de mudar a reprodução.

Loops infinitos podem pausar e continuar, mas não têm `progress` finito: ler ou definir essa propriedade lança erro. Antes de a view carregar, a duração finita é informada como 0; um progresso solicitado fica guardado até as tracks estarem prontas. Um grupo espera todos os alvos para aplicar esse progresso.

## Gestos e sliders

Crie e pause a animação uma vez. Atualize o progresso nos eventos de entrada:

```ts
const animation = animate(card, { rotateY: [0, 180] }, { duration: 1000 })
animation.pause()

slider.on('valueChange', ({ value }) => {
  animation.progress = value / 100 // slider de 0 a 100
})

// Continua do frame escolhido.
animation.play()
```

O Jolt não usa um loop de frames em JS para manter a pausa ou continuar. O scrub acontece quando você altera o progresso. O playground inclui Play, Pause, Stop e slider, com um pulso independente para mostrar que as outras animações continuam.

## Interrupção e ciclo de vida

Pausar mantém `finished` pendente. `stop()` congela a posição atual e resolve com `false`; descarregar a view também encerra e libera os recursos nativos. Uma substituição lê a posição controlada. Uma track pausada transmite velocidade zero; depois de retomar, transmite a velocidade da curva original nessa posição.

Propriedades mais curtas e views com stagger podem voltar enquanto a animação que as contém estiver ativa. O scrub não retoma uma propriedade assumida por outra animação ou alterada depois de terminar. Animações concluídas ou paradas são terminais: os controles não as reiniciam. Crie outra para repetir.

Objetos de sequência mantêm o ciclo de vida básico de `Animation`. Para controlar uma etapa, guarde a `PlaybackAnimation` retornada por `animate()` ou `decay()`. Pausar antes da chegada segura a próxima etapa; uma chegada já ocorrida não pode ser desfeita. Efeitos como `animateText()`, `reveal()` e `symbolEffect()` mantêm seus próprios controles e não oferecem progresso genérico.

Os haptics aguardam a pausa e retomam nos pontos restantes. Um seek pula silenciosamente os pontos cruzados; voltar não repete feedback já consumido.

## Tempo nativo

No iOS, cada `CAAnimation` tem sua velocidade e seu offset de tempo. O relógio da layer permanece intacto, inclusive nas camadas de cores e sombras do Core. Substituir uma cópia de CA durante um comando não encerra a promise por um callback antigo.

No Android, pausa e retomada usam os animadores existentes. O seek reposiciona os keyframes, incluindo fases de atraso e repetição. Animações ativas compartilham um marcador nativo de tempo para respeitar a velocidade de animação do sistema. O Jolt remove esse marcador quando todos pausam e cria outro ao retomar, evitando a correção tardia do relógio pausado do Android; ele é liberado quando o último proprietário termina. Nenhum marcador chama JavaScript por frame. A [limitação da UI thread](./android-performance) continua valendo.

Se o aplicativo pausar explicitamente antes de ir para segundo plano, as views preservam essa pausa durante o descarregamento temporário que o NativeScript faz no iOS. A retomada continua explícita. Um descarregamento de navegação em primeiro plano continua cancelando a animação.
