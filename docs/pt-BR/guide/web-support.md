# Mapeamentos, geometria e scroll na Web {#web-support}

Disponível desde a RC.8: [montagem Vue/Nuxt, entradas por identidade e scroll horizontal LTR/RTL](./web-collections).

**Desde a RC.7:** [cores, bordas, pintura contínua, tamanho real, FLIP e cenas com seek](./web-visual) ampliam este runtime. As APIs Web continuam experimentais; a paridade completa segue na [#236](https://github.com/rafaelaugustos/jolt/issues/236).

Desde a **0.1.0-rc.6**, `@rafaelaugusto/jolt/web` inclui mapeamentos numéricos, atualização de geometria e scroll vertical (#302–#304). As APIs continuam experimentais. APIs nativas e adapters mantêm seus contratos; a adoção pelo Mavis é separada.

<Clip name="web-support-chromium" caption="Chromium desktop, interface em inglês, velocidade original: slider, teclado, press e roda reais demonstram mapeamentos numéricos, mudança do tamanho do rótulo sem reiniciar o movimento, reversão do scroll e descarte. Gravação do navegador; não mede desempenho físico ou do compositor." />

## Mapeamentos numéricos {#mappings}

```ts
const motion = createWebRuntime(document)
const input = motion.motionValue(0)
const mapped = input.to([0, 100], [0, 200])
const follower = motion.springValue(mapped)
const binding = motion.bind(card, {
  x: follower,
  scale: input.to([0, 100], [1, 1.2]),
  opacity: input.to([0, 100], [0.4, 1]),
})
motion.press(card)
input.set(50) // Escala da aplicação 1.1; o press padrão multiplica por 0.96.
```

`.to(input, output, { clamp: true })` aceita 2–1024 pares numéricos finitos. A entrada deve ser estritamente crescente ou decrescente, sem pontos duplicados. A saída pode mudar de direção. Clamp é o padrão; `{ clamp: false }` extrapola os segmentos das extremidades. A configuração é copiada. Transformações por callback, grafos com múltiplas entradas e ciclos permanecem fora. A RC.7 também aceita [mapeamentos com saída de cor](./web-visual#paint). Uma cadeia admite até 32 níveis de mapeamentos/followers.

Mapeamentos oferecem `get()`, `getVelocity()`, `subscribe()`, `dispose()` e outro `.to()`, mas não `set()`. A velocidade multiplica a velocidade da origem pela inclinação do segmento. Com clamp, extremidades e valores externos têm velocidade zero; nos pontos internos usa-se a derivada à esquerda na ordem crescente da entrada. Intervalos inválidos e overflow são rejeitados. Todos os valores pertencem ao mesmo runtime.

Mapeamentos sem consumidores são lidos sob demanda. Dependências ativas usam o scheduler existente, sem um loop próprio por mapeamento. Um valor derivado pode alimentar uma spring ou outro mapeamento. Descartá-lo encerra seus descendentes e bindings, preservando irmãos e origem. Descartar a origem encerra todos os descendentes. O descarte de um binding mantém o último valor; `release()` restaura os estilos originalmente controlados.

## Geometria sem reiniciar playback {#geometry}

```ts
motion.set(card, { scale: 1.1 }) // Primeiro, declare a superfície já montada.
const geometry = motion.observeGeometry(card)
// Ou, depois de alterar tamanho / transform-origin 2D de forma síncrona:
motion.refresh(card)
// Cleanup: geometry.dispose(); motion.release(card)
```

`refresh()` aceita a nova caixa e o `transform-origin` 2D calculado. O navegador aplica o pivô ao mesmo efeito: não substitui canais, cria keyframes, reinicia relógios nem sinaliza conclusão. Posição/velocidade lógicas, progresso pausado, tracks finitas, bindings e o multiplicador de press continuam. Mudar o pivô pode deslocar pixels; isto não é FLIP, interpolação de tamanho ou trava de posição visual.

`observeGeometry()` compartilha um ResizeObserver por superfície. O navegador agrupa mudanças de tamanho por layout responsivo, rótulos e métricas de fontes. Alterar somente a origem, sem resize, exige `refresh()`. Descarte cada observação; release/desmontagem encerra todas. Handles antigos não afetam uma nova superfície. Uma atualização automática inválida libera a superfície e reporta erro; falhar no refresh explícito não substitui ownership.

O baseline CSS continua fixo. Troca de classe, escritores externos de transform/opacity, transforms CSS individuais, origem 3D, transitions e `display: none/contents/inline` exigem release/recriação. O alvo precisa estar montado e controlado. Drag continua cancelando com scroll/resize; esta API não amplia seu contrato de coordenadas.

## Scroll vertical {#scroll}

```ts
const linked = motion.scrollLinked(
  scroller,
  card,
  {
    y: [0, -60],
    scale: [1, 0.9],
    opacity: [1, 0.4],
  },
  { range: [0, 400] },
)
// linked.execution: 'scroll-timeline' | 'scheduler' | 'released'
// linked.refresh(); linked.dispose()

const scroll = motion.scrollValue(scroller) // Sem argumento: Document do runtime.
const progress = scroll.to([0, 400], [0, 1])
// Observar/vincular progress usa o scheduler; também pode alimentar springValue().
// scroll.refresh(); scroll.dispose()
```

A origem é um HTMLElement montado ou o Document do runtime. O valor readonly usa pixels CSS verticais, limitados à extensão disponível. A velocidade é amostrada, não uma trajetória analítica do navegador, e expira após 100 ms sem mudança. `range` deve crescer entre 0 e 1e9 pixels; o playback limita as extremidades e reverte ao voltar o scroll. Arrays numéricos explícitos aceitam x/y/rotate/scale/scaleX/scaleY/opacity. `times` opcional cresce estritamente de 0 a 1 e tem o tamanho de cada array. Conteúdo sem rolagem fica no início.

O modo automático usa [ScrollTimeline](https://www.w3.org/TR/scroll-animations-1/) com intervalos em pixels quando suportado. `{ execution: 'scheduler' }` força o fallback. A superfície elegível combina canais de um único link com contribuições estáticas/pausadas. Movimento finito ativo, inclusive transições de press, bindings genéricos ou links independentes exigem composição temporária pelo scheduler naquela superfície. Quando estabilizam, o playback elegível volta à timeline. Ownership e intervalos mantêm a semântica; outras superfícies preservam seu caminho. Assinar um valor de scroll separado não força o efeito visual nativo ao JavaScript.

Eventos de scroll/resize/texto/fontes invalidam medidas; não há medição contínua nem frames ociosos. Os observers cobrem origem, filhos diretos, mutações de conteúdo/texto e conclusão de fontes. Overflow profundo sem resize observado exige `refresh()`. `linked.refresh()` também valida a geometria do alvo. Movimento reduzido fixa canais espaciais no último keyframe e mantém opacity ligada ao scroll; desativá-lo restaura o mapeamento. O fallback oculto retoma do offset atual, sem simular a rolagem perdida.

Descartar/substituir o último canal ou desmontar origem/alvo libera listeners, valores e observers do link. Substituição parcial preserva os demais canais; descarte antigo não sobrescreve a animação nova. `scrollValue()` tem vida independente e precisa de descarte. Normalização horizontal/RTL, fluxo reverso, escrita vertical, ViewTimeline, pinning, headers virtualizados e handoff entre scrolls ficam fora. Não equivale a `scrollHeader()` nem garante execução fora da thread principal.

## Referências nativas e verificação {#verification}

Os demos revisados abaixo mostram mapeamentos e composição de scroll nativos existentes. A implementação nativa não mudou; não são gravações do backend Web ou da integração Mavis.

<Clip name="descending-values-ios" caption="Demo existente no simulador iOS, velocidade original: mapeamentos descendentes/em cadeia acompanham gestos reais na sheet. Referência nativa, não gravação em aparelho físico." />
<Clip name="scroll-values-android" caption="Demo existente no emulador Android, velocidade original: rolagem real controla translação, escala, opacidade e progresso do header. Referência nativa." />

Execute `npm run web:support:typecheck` e `npm run web:support:test`. A suíte verifica CSS real em Chromium, Firefox e WebKit, modo automático/fallback, press, geometria, lifecycle, frames ociosos, teclado/roda e toque via Chromium. Testes de tempo oculto controlam o sinal de visibilidade/scheduler, sem medir background físico. Consumidores empacotados Web/Vue/SSR/nativos e suítes existentes continuam obrigatórios. Veja o [relatório](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-support.md).

## Scroll relativo a um elemento {#element-range}

Pendente para a próxima release. Substitua o cálculo manual da faixa e a recriação do vínculo por uma seção de referência:

```ts
const linked = motion.scrollLinked(
  document,
  ribbon,
  { x: [0, -220] },
  {
    range: { element: section, start: 'start end', end: 'end start' },
  },
)
// The defaults allow: range: { element: section }
// Cleanup: linked.dispose() — useWebMotion scopes own this automatically.
```

O padrão é `start end` → `end start`: começa quando a seção entra na viewport e termina quando sai. Cada alinhamento indica uma borda do elemento e uma borda da viewport; `center` também é aceito. A faixa inicial pode ser negativa para uma seção já visível. Faixas horizontais respeitam a direção LTR/RTL da origem.

Mudanças de tamanho, texto, fontes, inserção de filhos e estilos/classes relevantes atualizam o mesmo vínculo com observadores agrupados. Não há loop de frames em repouso. `linked.refresh()` também refaz a medida; descartar o vínculo, escopo ou runtime remove os observadores. Se a referência for desmontada ou ficar inválida, o vínculo é liberado e um erro é informado.

Use uma seção sem transformação nem posição sticky como referência e anime um filho ou outro elemento. A referência deve permanecer dentro da origem escolhida, sem atravessar outro contêiner de scroll. Ancestrais transformados/fixed/sticky, zoom e transições animadas de layout ficam fora deste contrato. Para mudanças em stylesheet/CSSOM sem alteração observável de caixa ou DOM, chame `linked.refresh()`. Faixas numéricas mantêm o comportamento anterior.

<Clip name="web-element-range-chromium" caption="Chromium desktop · interface em inglês, velocidade original. Scroll e cliques reais mostram entrada/saída da seção, inserção acima dela, redimensionamento, diagnóstico de geometria e recuperação com observeGeometry. Gravação do navegador; a referência nativa acima mostra composição por scroll com sua própria API." />

## Diagnóstico de conflitos da superfície {#surface-diagnostics}

Conflitos de propriedade agora informam `WebSurfaceConflictError`, um seletor do elemento e entradas `changes` com `property`, `previous` e `current`. Esses campos guardam strings, sem reter nós DOM. Uma mudança de origem causada pelo tamanho inclui as dimensões anteriores/atuais e orienta usar `observeGeometry()` antes do layout ou `refresh()` após uma mudança síncrona. Escritas externas de estilo continuam exigindo liberação/recriação; o diagnóstico não as aceita silenciosamente.
