# Sequências e timelines

## Controle conjunto

`timeline(steps)` aceita as mesmas tuplas de views e posições de `sequence()`, além de tuplas de motion values e fábricas com controle de reprodução:

```ts
const scene = timeline([
  [car, { path: route, orient: true }, { duration: 8000, ease: 'linear' }],
  [pulse, 1, { duration: 1000, repeat: 7, repeatType: 'reverse', at: '<' }],
  { at: 0, run: () => imageEffect(image, 'ripple', { duration: 8000 }) },
  [checkpoint, 'fadeIn', { at: 4000 }],
])
scene.pause()
scene.play()
await scene.finished
```

<Clip name="controlled-playback-ios" caption="Um controle pausa movimentos ativos, ripple e um checkpoint futuro, e retoma o tempo restante de todos. Simulador iOS, em tempo real." />
<Clip name="controlled-playback-android" caption="Pausa e retomada conjunta da timeline com entrada real no emulador Android, em tempo real." />

A pausa congela participantes ativos e lançamentos futuros, incluindo intervalos e sobreposições. A retomada continua da mesma posição, sem reiniciar efeitos nem contar o tempo de relógio durante a pausa. Os dois comandos são idempotentes. Stop cancela o trabalho ativo e pendente, resolve `finished` com false e é definitivo. Um scope pode criar `scope.timeline(steps)` ou adotar o handle retornado.

Participantes precisam de `pause()`, `play()` e `paused`, além do ciclo de vida de animação. Animações de views, motion values, timelines aninhadas, efeitos de imagem e [propriedades nativas externas](./native-properties) oferecem isso. Funções de limpeza como `shimmer()` e animações básicas como `animateText()` não oferecem. Um callback que retorna um participante incompatível rejeita `finished` e limpa o trabalho já iniciado e pendente. A fábrica roda na ativação, portanto suas capacidades só podem ser inspecionadas quando retorna. Efeitos colaterais externos são responsabilidade do autor da fábrica.

| Participante                               | Pausa/retomada conjunta    | Duração                                          |
| ------------------------------------------ | -------------------------- | ------------------------------------------------ |
| View/path `animate()` e `decay()`          | Sim                        | Finita ou infinita                               |
| `animate(motionValue)` e camadas escalares | Sim                        | Finita ou infinita                               |
| `imageEffect()`                            | Sim                        | Finita; distortion infinita                      |
| Adaptador nativo `.animate()`              | Sim                        | Finita ou infinita                               |
| Timeline aninhada                          | Sim                        | Pode ser desconhecida até ativar todos os passos |
| Factory personalizada                      | Exige contrato de playback | Opcional; sem ela não há progresso agregado      |
| `animateText()` e funções de limpeza       | Não; use `sequence()`      | Não aplicável                                    |

A timeline não oferece um setter genérico de seek: callbacks, haptics e efeitos guiados por toque não podem ser rebobinados juntos com segurança. `duration` fica `undefined` até todos os passos estarem ativos, prontos e declararem duração; depois é o maior término agendado, ou Infinity para trabalho infinito. `playbackProgress(scene)` funciona quando essa duração é finita. Observe a trilha principal finita quando a composição também contiver efeitos infinitos ou ainda não planejados. Retorne handles novos nas fábricas: adotar handles já em execução não rebobina nem realinha seu passado.

O pai retoma somente os filhos que ele pausou. Um filho pausado independentemente permanece pausado; handles parados/concluídos continuam encerrados. Seek ou atrasos manuais em filhos podem invalidar o término calculado; controle a cena pelo pai ao usar progresso agregado. Interrupções mantêm as regras de chegada/posse da sequência e tornam a conclusão final false.

Tracks nativos continuam com reprodução nativa. JavaScript roda nas ativações e nos comandos; se estiver bloqueado, pode atrasar uma nova fábrica. Isso não promete execução nativa de callbacks arbitrários. O aplicativo pode pausar no background e retomar explicitamente, como na demo.

## Reprodução sequencial

Sem uma posição, cada passo começa quando o anterior parece pronto:

<Clip name="timeline" caption="Passos sobrepostos e passos em ordem." />

```ts
await sequence([
  [logo, 'popIn'],
  [[title, subtitle], 'fadeInUp', { stagger: 80 }],
  () => animate(button, 'fadeIn'),
])
```

Cada tupla recebe os mesmos argumentos de `animate()`, mais `at` nas opções. Um callback pode iniciar e retornar uma animação. Springs contam como chegada quando ficam perto do alvo, antes de terminar de assentar.

## Sobreposição e posições fixas

```ts
sequence([
  [logo, 'popIn'],
  [title, 'fadeInUp', { at: '-150' }],
  [buttons, 'fadeIn', { at: '<', stagger: 50 }],
  [footer, 'fadeIn', { at: 900 }],
])
```

| `at`     | Quando o passo começa                      |
| -------- | ------------------------------------------ |
| omitido  | Na chegada do passo anterior               |
| `'-150'` | 150 ms antes dessa chegada                 |
| `'+100'` | 100 ms depois dessa chegada                |
| `'<'`    | Junto com a ativação do passo anterior     |
| `900`    | Aos 900 ms a partir da origem da sequência |

As posições usam milissegundos de animação. Um número é uma posição absoluta não negativa; um deslocamento relativo é uma string decimal com sinal. Posições absolutas independem dos passos anteriores e podem aparecer fora da ordem cronológica. Um passo sem posição continua seguindo o **passo anterior na lista**, não a animação que terminar por último.

`'<'` se refere à ativação antes do `delay` do passo. Esse delay e os delays por propriedade continuam valendo. Por exemplo, dois passos com o mesmo início e delays de 200 e 50 ms começam a se mover com 150 ms de diferença.

O primeiro passo usa a origem da sequência como referência: `'<'`, `'-150'` e `0` começam imediatamente; `'+100'` espera 100 ms. Um deslocamento negativo que antecederia a ativação do predecessor fica limitado a essa ativação. O agendador não volta a animação para recuperar um início que já passou.

Para combinar um spring nomeado com uma posição, use sua forma de objeto:

```ts
import { sequence, springs } from '@rafaelaugusto/jolt'

sequence([
  [card, 'popIn'],
  [title, 'fadeInUp', { ...springs.bouncy, at: '-100' }],
])
```

## Chegada e carregamento

Deslocamentos negativos usam a previsão de chegada das tracks reais, incluindo delay inicial, timing por propriedade, repetições e a última view do stagger. Um alvo ainda não carregado espera ter suas tracks antes de fornecer uma previsão. Ativações absolutas continuam independentes; seus alvos ainda precisam carregar para iniciar a reprodução nativa.

Um callback que retorna `animate()` ou `decay()` também fornece uma previsão. Pausar, continuar ou alterar o progresso desse handle reagenda um seguidor negativo pendente. Depois que um seguidor começa, mudanças posteriores não o desfazem nem repetem.

Um efeito arbitrário, animação personalizada ou sequência aninhada não expõe previsão. Ele pode anteceder um passo sem posição, um deslocamento positivo ou `'<'`; um deslocamento negativo depois dele rejeita `finished` com erro de configuração e cancela o restante da sequência. Uma animação infinita não tem previsão finita; seus seguidores relativos esperam até ela ser interrompida. Posições absolutas ainda podem iniciar outros passos.

Deslocamentos positivos seguem a **chegada real**. Se o passo anterior for interrompido antes da previsão, a espera extra começa nessa interrupção. Um seguidor negativo pendente também avança quando seu predecessor é interrompido, sem manter um prazo que deixou de valer.

## Valores iniciais e propriedade

Views posteriores assumem o primeiro keyframe absoluto quando a sequência é criada, ficando escondidas até sua vez. A preparação mantém a ordem da lista: o primeiro passo listado que toca uma propriedade fornece seu estado inicial, mesmo com posições absolutas fora da ordem cronológica. Keyframes relativos e `null` leem o valor atual quando o passo é ativado.

Passos sobrepostos na mesma propriedade usam as [regras de interrupção](./interrupting): a ativação posterior assume a partir do valor e da velocidade na tela. Um primeiro keyframe explícito continua definindo um início explícito. Propriedades e views diferentes permanecem independentes.

## Conclusão e limpeza

A sequência chega quando **todos** os passos foram iniciados e chegaram. Sua promise `finished` espera todas as animações iniciadas terminarem de assentar, incluindo passos sobrepostos mais longos. Ela resolve com `false` se algum passo foi interrompido ou parado. Isso inclui sobreposição intencional na mesma propriedade.

`stop()` cancela ativações futuras e para todos os passos ativos ou ainda assentando. Chame-o quando o dono da timeline sair da tela:

```ts
const animation = sequence(steps)
onUnmounted(() => animation.stop())
```

O handle retornado mantém o ciclo de vida básico de `Animation`; pausa e progresso da timeline inteira não são expostos. Posições inválidas lançam erro antes de iniciar ou aplicar keyframes. Erros ao criar um callback ou passo adiado rejeitam `finished` depois de cancelar o restante; o cancelamento da reprodução em si resolve com `false`.

## Timing nativo

No Android, os timers de posição e o relógio absoluto da timeline acompanham a **escala de duração do animador** do sistema. Com animações desativadas, passos posicionados avançam sem esperar pelas durações solicitadas. O iOS usa seu relógio de animação.

O JavaScript executa quando um passo é ativado, não a cada frame. Uma thread JS bloqueada pode atrasar uma ativação; esta API não inicia novos passos criados em JS enquanto ele estiver indisponível. Depois que um passo começa, sua reprodução nativa e os limites da plataforma continuam valendo.

O playground compara sobreposição, chegadas sequenciais e tempos fixos usando a mesma entrada.

## RC.6: cenas finitas com seek {#seekable-scenes}

`seekableTimeline()` acrescenta um contrato declarativo explícito desde **0.1.0-rc.6**. `timeline()` e `sequence()` mantêm o comportamento de callbacks.

```ts
const scene = seekableTimeline(
  [
    {
      target: card,
      keyframes: { x: [0, 160] },
      transition: { duration: 1600, ease: 'linear' },
    },
    {
      target: card,
      at: 400,
      keyframes: { scale: [1, 1.5], opacity: [0.4, 1] },
      transition: { duration: 800 },
    },
    { value: progress, keyframes: [0, 1], transition: { duration: 1600 } },
  ],
  { paused: true },
)
scene.progress = 0.6
scene.progress = 1
scene.progress = 0.2
scene.play()
```

| Participante                                           | Contrato                                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| View nativa carregada                                  | Keyframes numéricos explícitos e finitos de transforms/opacity; aceita layers nomeados.   |
| `motionValue()` numérico                               | Canal base; bindings existentes seguem o mesmo tempo da cena.                             |
| `{ at, steps }` aninhado                               | Expandido na preparação; posições absolutas em milissegundos dentro da cena que o contém. |
| Callbacks, followers ao vivo, gestos, haptics, handles | Rejeitados antes da troca de propriedade. Use a API de timeline existente.                |

Cada alvo/propriedade/layer tem um track. Coloque movimentos sucessivos nos keyframes; canais duplicados são rejeitados, inclusive entre cenas aninhadas. Não há handles de filhos independentes. Frames null/valor atual, paths, pintura/decorações, receitas relativas, stagger e layers de valores ficam fora desse primeiro conjunto. Transições aceitam easing predefinido/cubic-bezier e springs/tweens/gravity finitos; easing por callback e delays aleatórios entre repetições são rejeitados. Limites: 256 canais, 16 níveis, 100 repetições, dez minutos sem timeScale por track e 100.000 amostras por canal compilado.

Todos os tracks são validados e compilados antes de assumir propriedade. Tracks atrasados mantêm o primeiro valor explícito; tracks curtos mantêm o valor final até o fim da cena. Repetições finitas são expandidas para execução nativa; o reinício de um loop ocupa no máximo um milionésimo do intervalo da cena, evitando intervalos float vazios. O playback comum dispensa coordenador JavaScript por frame. O timeScale global e o relógio de animator do Android são respeitados.

Seek preserva pausa/play. Trabalho mais novo da aplicação mantém seus canais: um seek da cena antiga não os recupera. Os outros canais continuam e a conclusão agregada é false após interrupção. O fim pausado aceita retorno; uma cena concluída/parada é terminal. Background pausa e retoma automaticamente uma cena que estava tocando; pausa explícita continua pausada. Unload de uma view encerra a cena; reload exige outro handle. Redução de movimento é lida na compilação: tracks espaciais vão ao destino, opacidade conserva o tempo. Uma falha de construção interrompe o trabalho recém-criado pela cena.

<Clip name="seekable-scene-ios" caption="Simulador iOS, interface em inglês: interação real com slider percorre posição, escala/opacidade sobrepostas e um valor de progresso vinculado, incluindo retorno a partir do fim pausado." />
<Clip name="seekable-scene-android" caption="Emulador Android, interface em inglês: gestos reais por ADB e controles de playback exercitam a mesma cena finita. Tempo original, sem medição em aparelho físico." />

[Validação nativa e reprodução](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-capabilities.md).
