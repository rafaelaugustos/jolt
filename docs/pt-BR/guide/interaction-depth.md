# Drop, cues e profundidade

Disponível em `0.1.0-rc.12`. As seis capacidades têm contratos nativos e Web explícitos. Destrua o scope ao desmontar; importe as entradas Web opcionais sem acessar o DOM durante SSR e crie o runtime após montar.

O Android antigo serve para compatibilidade. A pedido do mantenedor, novas medições físicas de desempenho ficam para um celular mais recente; estes vídeos e dados exploratórios não comprovam vantagem de CPU/PSS.

## Drop zones

`dropZones(view, options)` no nativo e `runtime.dropZones(element, options)` na Web coordenam alvos dentro do aplicativo. Os scopes expõem a mesma operação. Declare `targets` com `id`, `target`, `priority` e `accept` síncrono; `onDrop` pode retornar um recurso com `stop`/`dispose` ou uma função de limpeza. `drag: { snap: [0] }` mantém o retorno quando o alvo rejeita.

O teste padrão usa o centro da origem; `hitTest: 'overlap'` exige interseção positiva entre retângulos. Maior prioridade vence, seguida da ordem de declaração. A rejeição do primeiro alvo não tenta os demais. A geometria e a aceitação são verificadas na soltura. `request(id)` oferece a ação para botão/teclado sem exigir interseção, mas respeita disponibilidade e aceitação. Não muda dados nem move elementos entre containers.

O efeito aceito termina ao concluir, cancelar, pegar novamente, pausar, remover o alvo ou destruir. `refresh()` acompanha mudanças de layout da aplicação. Nativo usa DIPs na mesma janela; Web usa pixels CSS no mesmo documento. São limites retangulares, sem teste de oclusão/pixels ou importação de arquivos. Valem as restrições do drag com ancestrais transformados. O ScrollView do demo deixa de disputar o gesto; foco, anúncios e alternativa acessível pertencem à aplicação.

<Clip :autoplay="false" name="interaction-drop-ios" caption="Simulador iOS 26.2: reprodução nativa com interação real via XCTest. Rejeição, aceitação, alternativa por botão e remount." />
<Clip :autoplay="false" name="interaction-drop-android" caption="ASUS ZenFone 3 físico, Android 8: reprodução nativa com toques reais via ADB. Rejeição, aceitação, alternativa por botão e remount." />
<Clip :autoplay="false" name="interaction-drop-web" caption="Chromium: interação real no navegador; o inspector usa WebGL por software. Rejeição, aceitação, alternativa por botão e remount." />

### Inserção ordenada

Um quadro que reordena cards dentro de colunas precisa de mais do que soltar sobre uma coluna: uma alça que inicia o arrasto, a posição do card enquanto ele se move, colunas fáceis de acertar mesmo quando curtas e um card que continua sob o ponteiro enquanto o quadro abre um espaço. A Web e o NativeScript compartilham o mesmo contrato:

```ts
const drop = scope.dropZones(card, {
  targets: [
    { id: 'todo', target: todo, padding: { bottom: 60 } },
    { id: 'done', target: done, padding: { bottom: 60 } },
  ],
  drag: { handle: grip, snap: [0] },
  // Coloque o espaço antes do primeiro card cujo ponto médio fica abaixo do centro do card.
  onMove: ({ id, bounds }) => showGap(id, bounds.y + bounds.height / 2),
  onLeave: () => hideGap(),
  onDrop: ({ id }) => moveCard(id),
})
```

**Alça.** `drag.handle`, aceito também por `drag()`, recebe a entrada de um elemento dentro da origem na Web (pode ser um `<button>`, que mantém o próprio tratamento de teclado) ou de uma view descendente no NativeScript. Só a alça inicia o arrasto, e a origem se move. Na Web, só a alça recebe `touch-action` e captura de ponteiro, então o resto da origem mantém cliques, controles e rolagem por toque; elementos interativos dentro da alça continuam sem iniciar arrasto, e um clique na alça logo após um arrasto é suprimido. No NativeScript, só a alça recebe o reconhecedor de pan, então o resto da origem mantém seus toques e uma ScrollView ao redor pode receber o gesto. Uma alça fora da origem, ou a própria origem, lança `TypeError` antes de qualquer mudança de entrada. Uma alça que sai da origem, fica desabilitada ou inerte cancela o contato.

**Posição durante o movimento.** `onMove({ id, source, bounds, method: 'drag' })` é chamado a cada movimento do arrasto, depois do teste de acerto: `id` é o alvo sob a origem ou `undefined`, e `bounds` é uma cópia dos limites visuais da origem nas coordenadas dos alvos. A aplicação posiciona o ponto de inserção sem listeners de ponteiro próprios. `request()`, `refresh()` e a soltura não relatam movimento, e nada é relatado depois de cancelamento, pausa, suspensão ou descarte. O NativeScript também relata a primeira amostra do pan. Um erro lançado em `onMove` cancela o arrasto, como nos outros callbacks.

**Padding de acerto.** O `padding` de um alvo amplia sua área de acerto com um número ou por borda (`{ top, right, bottom, left }`): pixels CSS na Web, DIPs no NativeScript. Cada borda deve ser finita e de 0 a 1.000; outros valores lançam `RangeError` ao criar as drop zones. `center` e `overlap` usam o retângulo ampliado, e um alvo com limites vazios continua sem acerto. O padding é invisível; desenhe-o quando o usuário precisar vê-lo. O `dropHits(source, target, policy, padding)` exportado aplica a mesma regra.

**Atravessando contêineres.** A origem precisa continuar visível enquanto se move, e os layouts do NativeScript cortam os filhos por padrão. No iOS, defina `clipToBounds = false` nos contêineres que a origem atravessa, senão ela some de vista. No Android `clipToBounds` não tem efeito: chame `setClipChildren(false)` nesses `ViewGroup`s e nos pais deles, porque o Android trata uma origem cortada por um ancestral como oculta e a Jolt então cancela o arrasto. Views desenhadas depois cobrem a origem, então desenhe por último o contêiner que a contém, como faz o board do demo. Na Web, suba a origem com `z-index` quando um conteúdo posterior a cobriria.

**Reancoragem.** Durante o arrasto, cada movimento e cada `refresh()` comparam o centro de layout da origem (o centro visual sem a translação do arrasto) com o do início do arrasto e compensam a translação pela diferença. Um espaço inserido acima do card o mantém sob o ponteiro. A Web atualiza sozinha depois de inserções e remoções no DOM e das mudanças de atributo que o Jolt observa; o NativeScript, depois do `layoutChanged` da origem, emitido quando o frame dela muda dentro do pai. Mudanças feitas só por estilo na Web e deslocamentos de um ancestral no NativeScript são compensados no movimento seguinte; chame `refresh()` logo depois delas para evitar um salto de um frame. Só os eixos arrastados são compensados, os `bounds` do arrasto continuam limitando a translação, e escalar a origem em torno de um ponto que não é o centro durante o arrasto conta como mudança de layout. As amostras de velocidade acompanham a translação, então a reancoragem não vira um arremesso.

**Soltura, cancelamento e movimento reduzido.** Nas duas plataformas, o drop é decidido pela entrada final antes de o movimento de retorno começar. O cancelamento (`cancel()`, pausa, documento oculto, perda de foco da janela ou rolagem na Web, suspensão do aplicativo no NativeScript) congela a origem onde está, interrompe os relatórios de movimento e chama `onLeave` para o alvo sob a origem, para a aplicação remover o espaço; layout alterado depois disso não é compensado. O movimento reduzido mantém o acompanhamento direto; uma soltura rejeitada ou fora de alvos retorna sem animação. Mantenha movimentos por teclado em controles da aplicação, como a alça do demo faz com as setas e `request()`.

<Clip :autoplay="false" name="interaction-depth-drop-web" caption="Chromium: mouse e teclado reais. O corpo do card mantém botão e rolagem, a alça (um botão) arrasta, um espaço se abre acima do card enquanto ele segue sob o ponteiro, soltar abaixo da coluna Done curta acerta o padding de 60 px, o alvo bloqueado rejeita e uma seta devolve o card." />
<Clip :autoplay="false" name="interaction-depth-drop-ios" caption="Simulador iOS: toques reais via XCTest no quadro nativo. Só a alça de 36 DIP arrasta, o espaço acima do card o reancora, a coluna Done com padding aceita, o alvo bloqueado rejeita e o movimento reduzido retorna na hora. Não é gravação em aparelho físico." />
<Clip :autoplay="false" name="interaction-depth-drop-android" caption="Emulador Android: toques reais via ADB no mesmo quadro nativo: arrasto só pela alça, reancoragem com o espaço, aceitação com padding, rejeição e movimento reduzido. Não é gravação em aparelho físico." />

## Áudio opcional e eventos na timeline

Importe `audioCue` de `@rafaelaugusto/jolt/audio` no nativo e de `@rafaelaugusto/jolt/web/audio` na Web. Nativo: `scope.resource(() => audioCue('~/assets/cue.wav'))`. Web: `scope.add(audioCue(document, '/cue.wav'))`. Arquivos nativos são locais; URLs Web precisam ser da mesma origem ou blobs locais. Aguarde `ready` e inicie por uma ação do usuário. Falha retorna `false`, chama `onError` e não impede a animação visual.

Uma cue possui uma voz. `sound.play()` substitui a anterior; `voice.play()` apenas retoma uma voz não concluída. Pause preserva tempo, stop cancela e rebobina, mute altera volume sem parar o relógio. Background/visibilidade suspendem; uma pausa manual continua pausada na volta. Dispose libera player e listeners. AVAudioPlayer, MediaPlayer e HTMLAudioElement mantêm o relógio sem um loop de áudio por frame do Jolt.

Web: `scope.withTimelineCues(motion, [{ name: 'impact', at: 300, effect: () => sound.play() }])`. Nativo: `scope.add(withTimelineCues(motion, cues))`. Seek cancela efeitos ativos sem disparar no destino; cruzamentos futuros podem disparar novamente. Áudio roda em **velocidade fixa 1, sem seek/progress**. Time scale visual altera apenas os próximos disparos, sem esticar som em andamento. Reduce Motion suprime cues da timeline; chamadas diretas de áudio continuam explícitas. Timers não garantem sincronismo de amostras.

iOS usa categoria ambient por padrão, respeitando a política de silêncio e mistura do sistema. Sessão não ambient existente exige `iosSession: 'application'`. A configuração anterior só é restaurada se ainda pertencer ao módulo; interrupções iOS param a voz. Android usa atributos de sonificação e suspensão do aplicativo, sem solicitar audio focus nem coordenar interrupções globais. Autoplay Web pode falhar. Streaming, gravação, loops e mixer não fazem parte do módulo. **Os vídeos não capturam áudio; a conclusão nativa é verificada separadamente. A chave de silêncio de um iPhone físico ainda não foi validada.**

<Clip :autoplay="false" name="interaction-audio-ios" caption="Simulador iOS 26.2: reprodução nativa com interação real via XCTest. Pause, seek sem disparos, mute e replay. Captura sem áudio; conclusão verificada separadamente." />
<Clip :autoplay="false" name="interaction-audio-android" caption="ASUS ZenFone 3 físico, Android 8: reprodução nativa com toques reais via ADB. Pause, seek sem disparos, mute e replay. Captura sem áudio; conclusão verificada separadamente." />
<Clip :autoplay="false" name="interaction-audio-web" caption="Chromium: interação real no navegador; o inspector usa WebGL por software. Pause, seek sem disparos, mute e replay. Captura sem áudio; conclusão verificada separadamente." />

## Inspector e replay semântico

O inspector nativo ganha `inspector.adapters`; a Web usa a entrada opcional `@rafaelaugusto/jolt/web/inspector`. Exija `development: true`. `adapters.watch(property, id)`, `adapters.activity(activity, id)` e `adapters.label(playback, label)` associam valores, proprietários e atividade. `read()` coleta sob demanda, sem timer nem renderização adicional.

Na Web, `watch(element, id)` lê transform/opacity calculados; `track(playback, id)` registra um handle existente; `control(id, 'pause'|'play'|'seek'|'stop', progress?)` o controla. `tune(settings, apply)` valida a mola e deixa a substituição para o callback da aplicação. `springCode` produz o trecho copiável. Um collector `diagnostics` existente pode ser emprestado sem perder sua propriedade. Limites: 128 recursos explícitos, histórico de 8–2.000 eventos e IDs sem dados pessoais. Alvos destruídos/desanexados desaparecem na leitura.

Eventos mostram início, substituição, binding, pausa, retomada, seek, cancelamento, conclusão e destruição. Valores vêm do adapter; não são automaticamente valores de apresentação. Tempos cobrem **preparação, leitura e escrita em JS**, sem inferir amostragem nativa, GPU ou bytes totais alocados. `updateMs` não mede todo setup da ponte nem trabalho assíncrono do renderer. O exemplo Web usa WebGL por software; Android usa três propriedades de desenho sem shader; iOS usa três uniforms SceneKit e três propriedades de desenho.

`@rafaelaugusto/jolt/web/testing` expõe `recordInteraction`, `parseTrace`, `serializeTrace` e `replayInteraction` com o formato v1 compartilhado. A aplicação fornece adapter, relógio `advanceTo`, entradas, leitura e dispose; operações não suportadas devem lançar erro. Não há captura global, injeção automática de gestos do SO ou determinismo da GPU. O teste reproduz drag horizontal de um ponteiro e seek público de mola duas vezes, inclusive salto de tempo, com o mesmo resultado e zero recursos. Limites: 5.000 eventos, 300 segundos e 2 MB.

Retenha o inspector nativo com `scope.resource(() => inspector)`. Na Web, `scope.add` destrói ferramentas não reproduzíveis ao suspender o scope; use `scope.use` para recriar na retomada e atualize a referência. Isso também vale para áudio ao suspender explicitamente o scope Web; o controle de visibilidade feito pela cue é separado.

<Clip :autoplay="false" name="interaction-inspector-ios" caption="Simulador iOS 26.2: reprodução nativa com interação real via XCTest. Troca de proprietário, inspeção sob demanda e remount; não mede GPU." />
<Clip :autoplay="false" name="interaction-inspector-android" caption="ASUS ZenFone 3 físico, Android 8: reprodução nativa com toques reais via ADB. Troca de proprietário, inspeção sob demanda e remount; não mede GPU." />
<Clip :autoplay="false" name="interaction-inspector-web" caption="Chromium: interação real no navegador; o inspector usa WebGL por software. Troca de proprietário, inspeção sob demanda e remount; não mede GPU." />

<Clip :autoplay="false" name="interaction-tools-web" caption="Chromium: cliques reais pausam e buscam a animação do aplicativo, editam a mola e mostram código copiável. Um trace numérico explícito de mudança de destino é reproduzido duas vezes, validando o destino e zero recursos restantes do replay; não captura entradas do sistema operacional." />
<Clip :autoplay="false" name="motion-inspector-ios" caption="Simulador iOS, inspector nativo existente: toques reais do XCTest inspecionam interrupção, ajustam uma mola, pausam a reprodução e copiam TypeScript. Gravação reutilizada da contraparte nativa; não mede desempenho em aparelho físico." />
<Clip :autoplay="false" name="interaction-replay-ios" caption="Simulador iOS, replay nativo existente: toques e arraste reais do XCTest gravam e reproduzem mola/arraste e detectam um checkpoint propositalmente errado. Contraparte nativa reutilizada; o replay usa tempo lógico." />

## Paths e orientação tangente

`scope.animate(card, { path: 'M0 0 C40 -150 160 90 190 -80', orient: true }, { duration: 2600, ease: 'linear' })` compartilha geometria e uma trilha de progresso entre nativo e Web. As unidades são DIPs/pixels CSS e graus. Pause, seek, repeat, reverse, intervalos de repetição, Reduce Motion e substituição seguem o playback normal; sequences e cenas Web também aceitam paths.

`m` inicial relativo soma a pose atual; `M` absoluto escolhe a origem declarada. Não combine path com x/y explícitos nem orientação tangente com rotate. Trocar para uma mola comum preserva posição/velocidade amostradas; um path descontínuo declarado não promete tangente ou velocidade contínua.

<Clip :autoplay="false" name="interaction-path-ios" caption="Simulador iOS 26.2: reprodução nativa com interação real via XCTest. Path cúbico, orientação tangente, pause, seek e substituição." />
<Clip :autoplay="false" name="interaction-path-android" caption="ASUS ZenFone 3 físico, Android 8: reprodução nativa com toques reais via ADB. Path cúbico, orientação tangente, pause, seek e substituição." />
<Clip :autoplay="false" name="interaction-path-web" caption="Chromium: interação real no navegador; o inspector usa WebGL por software. Path cúbico, orientação tangente, pause, seek e substituição." />

## Rotação em três eixos

Web aceita `rotateX` e `rotateY` em graus. Ordem: transformação 2D inicial, translação, rotateZ, rotateY, rotateX, escala. Para projeção, aplique `container.style.perspective = '700px'` no pai e anime o filho. Não há suporte a baseline projetivo no alvo nem a layout/FLIP 3D. O contrato nativo existente permanece; a projeção não promete pixels idênticos. Pause, seek e substituição preservam os canais independentes.

<Clip :autoplay="false" name="interaction-depth-ios" caption="Simulador iOS 26.2: reprodução nativa com interação real via XCTest. Rotação de eixos, seek e substituição; Web usa perspectiva explícita no pai." />
<Clip :autoplay="false" name="interaction-depth-android" caption="ASUS ZenFone 3 físico, Android 8: reprodução nativa com toques reais via ADB. Rotação de eixos, seek e substituição; Web usa perspectiva explícita no pai." />
<Clip :autoplay="false" name="interaction-depth-web" caption="Chromium: interação real no navegador; o inspector usa WebGL por software. Rotação de eixos, seek e substituição; Web usa perspectiva explícita no pai." />

## Sombras e profundidade

Web oferece `shadowOpacity`, `shadowRadius`, offsets X/Y com sinal e `shadowColor` exclusivo da Web. A superfície possui uma sombra externa CSS, sem spread. Inset, múltiplas sombras e spread diferente de zero falham antes de substituir animações. Comece de `none` ou sombra compatível. Alpha da cor multiplica a opacidade.

`shadowRadius` corresponde à metade do blur CSS, seguindo a convenção numérica do raio iOS. Web usa pixels CSS e nativo usa DIPs. Na Web, raio não fica negativo e opacidade é limitada a 0–1; a validação nativa de valores explícitos inválidos permanece. Substituição parcial preserva os demais canais. Release restaura o estilo inicial, salvo escrita externa; mudanças externas durante a posse continuam sendo conflitos, então libere antes de assumir o estilo.

`elevation`/`translationZ` Android continuam específicos do nativo: não são aliases de sombra CSS ou translateZ. Os vídeos Android mostram profundidade nativa, iOS mostra canais de sombra, Web mostra box-shadow. Não se deduz ganho de CPU/PSS nem equivalência visual exata.

<Clip :autoplay="false" name="interaction-shadow-ios" caption="Simulador iOS 26.2: reprodução nativa com interação real via XCTest. Sombra no iOS/Web; elevation/translationZ nativos no Android." />
<Clip :autoplay="false" name="interaction-shadow-android" caption="ASUS ZenFone 3 físico, Android 8: reprodução nativa com toques reais via ADB. Sombra no iOS/Web; elevation/translationZ nativos no Android." />
<Clip :autoplay="false" name="interaction-shadow-web" caption="Chromium: interação real no navegador; o inspector usa WebGL por software. Sombra no iOS/Web; elevation/translationZ nativos no Android." />

<Clip :autoplay="false" name="interaction-audio-lifecycle-ios" caption="Simulador iOS 26.2: pausa manual preservada no background/foreground e recursos cancelados em remounts. Interação XCTest real; captura sem áudio." />
<Clip :autoplay="false" name="interaction-inspector-lifecycle-ios" caption="Simulador iOS 26.2: pausa manual preservada no background/foreground e recursos cancelados em remounts. Interação XCTest real; captura sem áudio." />
