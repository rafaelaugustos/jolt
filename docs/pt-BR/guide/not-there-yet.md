# Status da versão e limites {#ainda-nao}

A RC.11.1 adiciona [recursos retidos e desenhos com ciclo de vida Vue, prioridades de comportamentos, partes 2D articuladas, texto com gradiente e eventos nomeados em timelines](./native-composition). As APIs nativas incluem interrupção, movimento reduzido e controle de ciclo de vida nos usos documentados.

**Versão atual: 0.1.0-rc.11.1.** Inclui [adapters para frameworks nativos](./frameworks), [fontes adicionais de sensores](./device-sensors#vector-sources), [correções de teclado mobile](./mobile-web), [scroll Web relativo ao elemento](./web-support#element-range), [entradas de shaders e vídeo local no iOS](./image-effects) e [melhorias de playback Android](./android-performance). [Instale os pacotes na mesma versão](./install) e recompile os apps nativos. As APIs Web continuam experimentais.

**Novidades da RC.10:** [gradientes, loading e texto Web](./web-effects), [partículas, blur, formas e efeitos de imagem](./web-surfaces), [teclado, sheets, navegação, física e ícones](./web-platforms), [gravidade, haptics, sensores, glass e retorno à miniatura por chave](./web-parity), além de [headers no Core ScrollView nativo](./scroll-header#retained-scrollview) e [reordenação de linhas montadas](./reorder#retained-rows). Recompile apps nativos. A adoção no Mavis permanece separada.

**Novidades da RC.9:** [gestos Web, zoom, scroll/refresh coordenado e reorder](./web-gestures), além de [canais nativos de pintura retida e composição de bindings](./live-springs#extended-live-paint). Recompile apps nativos após atualizar.

**Novidades da RC.8:** [orquestração Web e desenho SVG](./web-orchestration), [montagem Vue/Nuxt, identidade dos itens e scroll horizontal](./web-collections) e [retomada da substituição nativa pausada](./motion-controllers#paused-replacement).

**Também na RC.7:** [escopos, ponteiro/viewport e configuração contínua no Vue](./web-lifecycle), além de [geometria de overlays, elementos compartilhados, receitas e diagnóstico](./web-interactions). A adoção no Mavis permanece separada.

**Desde a RC.7:** [cores, bordas, pintura contínua, tamanho real, FLIP e cenas com seek](./web-visual) ampliam este runtime. As APIs Web continuam experimentais; a paridade completa segue na [#236](https://github.com/rafaelaugustos/jolt/issues/236).

**A 0.1.0-rc.11.1 está disponível.** Os recursos nativos mantêm seus limites documentados enquanto a validação para a estável continua. As entradas Web são experimentais; publicá-las não conclui a integração Mavis nem estabelece paridade de todas as APIs entre native e Web.

A RC.6 inclui [movimento contínuo na Web](./web-dynamic), com valores, followers e drag/snap, além de [mapeamentos numéricos, atualização de geometria e scroll vertical](./web-support). As APIs Web continuam experimentais.

A RC.6 também adiciona [bindings nativos de cor/raio](./live-springs), [cenas com seek](./sequences), [tamanho em Flexbox compatível](./size) e [molas entre corpos](./physics-attachments). Recompile apps nativos após atualizar.

A RC.5 adiciona [playback Web experimental](./web-runtime), [press composto](./web-press) e o [adapter Vue DOM](./web-vue), corrige retomada após background e remoção de layers no Android e entrega [pull-to-refresh nativo](./scroll-header#pull-to-refresh) e correções de foco dos leitores no scroll/galeria. O Mavis concluiu a migração inicial de press/reveal e a prova de animação compartilhada da aplicação; a adoção dos recursos da RC.6 segue nas [issues de integração](https://github.com/getcortexlabs/mavis-ui/issues/137).

A RC.4 compõe as janelas de camadas em nós nativos, retoma shapes, gradientes e blur do Android do tempo em que estavam pausados, posiciona o bottom sheet pelos insets de safe area do host e oferece só as ações do handle que um stop pode executar. A RC.3 adicionou `interactiveModal()` no iOS, keyframes numéricos do Android em uma única chamada nativa, formas criadas antes de a view carregar e refs de componente como alvos.

A [auditoria de bindings/camadas](./motion-values#binding-measurements) inclui preparação/reprodução em iPhone e Android físicos, início da resposta a entradas automáticas e retenção em montagens/desmontagens repetidas. Os custos altos das janelas de composição, as falhas dos contadores aproximados de alocação e a falta de telemetria térmica no Android continuam explícitos nas evidências. Os resultados orientam os cenários medidos; não garantem capacidade universal nem frames apresentados. Desde a RC.4, as composições em janela tocam em compositores nativos sem submissões de boundary; o custo restante é o início síncrono de lotes grandes de keyframes, medido na mesma auditoria.

## Disponível na RC.11 {#available-in-rc-1}

- [Playback Web finito](./web-runtime), [press](./web-press) e [lifecycle Vue DOM](./web-vue) experimentais, com peers nativos/framework opcionais e importação segura em SSR.
- [Navegação compartilhada](./shared-navigation), [gestos compartilhados](./shared-gestures), [retorno à célula atual](./return-targets) e [galeria conectada](./gallery), nas combinações documentadas de Frame/ListView/imagens estáticas.
- [Composição nativa de gestos](./gestures): pan, pinch e rotação, além da transferência de gesto compatível com o Core ScrollView vertical. As [restrições de arraste](./drag) e o [zoom de fotos](./photo-zoom) têm seus próprios contratos de interação.
- [Composição de scroll](./scroll-header) com Core ListView e [linhas montadas no Core ScrollView](./scroll-header#retained-scrollview), além de [sensores de rotação/gravidade](./device-sensors) alimentando valores de movimento nativos.
- [Dimensões reais](./size), [mudanças de layout](./layout), [valores de movimento](./motion-values), [progresso observável](./playback) e [controles conjuntos de timeline](./sequences).
- [Propriedades nativas externas](./native-properties), incluindo [luzes/materiais do SceneKit](./scene-lighting), [FOV da câmera](./scene-camera) e [ambiente/parâmetros de shaders](./scene-shaders), pelo plugin nativo opcional.
- [Gravidade](./gravity), [física de círculos com vínculos](./physics-attachments), [desenho e transformação de vetores](./shapes), [desfoque animado](./blur) e [Liquid Glass](./glass), com o suporte e as alternativas por plataforma documentados.

## Limites atuais {#current-limits}

- As APIs Web continuam experimentais. Conteúdo de snapshots, coordenadas, disponibilidade de hardware e alternativas por navegador mantêm limites explícitos. Os [adapters para frameworks nativos](./frameworks) estão na RC.11; referências portáteis estáveis continuam em outra frente.
- `animateSize()` suporta StackLayout/GridLayout e filhos diretos de FlexboxLayout row/column sem wrap, inclusive dentro de ScrollView. O filho animado no eixo principal exige `flexGrow=0` e `flexShrink=0`; a alocação do pai e o stretch transversal continuam determinantes. Medição/layout executa JavaScript por frame. Células recicladas e elementos compartilhados permanecem fora.
- `drag()` não oferece composição genérica de gestos com vários dedos. Use [`gestures()`](./gestures) para pan/pinch/rotação, ou [zoom de fotos](./photo-zoom) para seu controlador específico de pinch, pan e fechamento. O adaptador de transferência de gesto suporta Core ScrollView vertical; outras combinações de listas/contêineres precisam de adaptadores e validação nativa próprios.
- Adaptadores de propriedades externas exigem `@rafaelaugusto/jolt-native`. Os adaptadores incluídos de câmera, luzes e materiais do SceneKit são exclusivos do iOS; não há adaptador incluído de renderização 3D para Android. As unidades das câmeras de MapKit e MapLibre são distintas.
- O FOV da câmera SceneKit suporta projeção em perspectiva automática no iOS. Escala ortográfica, matrizes de projeção personalizadas e controles arbitrários de lente ficam fora desse adaptador.
- `seekableTimeline()` permite seek em cenas declarativas finitas de views/valores numéricos. Callbacks, haptics, followers contínuos e efeitos arbitrários de execução única ficam fora; timelines imperativas mantêm seus controles de participantes.
- A reprodução nativa tem [formas de execução](./how-it-works) específicas por API. Escritas de propriedades nativas não isolam um renderizador do JavaScript na thread principal. Layout, assinaturas opcionais, entrada e ciclo de vida mantêm seus custos documentados em JavaScript.

## Da RC à 0.1.0 {#da-rc-a-0-1-0}

As issues de aceitação abertas abaixo tratam de APIs já entregues. Antes da versão estável, valide as combinações suportadas em aparelhos físicos iOS e Android:

- **Galeria ([#117](https://github.com/rafaelaugustos/jolt/issues/117)):** zoom/retorno interrompido, alvos reciclados ou excluídos, rotação, acessibilidade e navegação repetida sem overlays retidos.
- **Composição de scroll ([#116](https://github.com/rafaelaugustos/jolt/issues/116)):** reversão/inércia, mudanças tardias de layout, preservação de âncora e limpeza com o adaptador suportado de Core ListView.
- Mantenha os testes gerais, de iOS e Android e seus controles negativos passando no commit da versão. Verifique a instalação dos pacotes correspondentes e uma recompilação nativa limpa; resolva as regressões que bloqueiam a versão antes de marcar a estável.

O aceite físico inicial de rotação/gravidade está documentado na [#114](https://github.com/rafaelaugustos/jolt/issues/114) e no [relatório de sensores](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md). Aceleração, aceleração linear, giroscópio e campo magnético estão na RC.11; [o aceite em simulador/emulador](./device-sensors#vector-sources) não comprova precisão nem custo em aparelhos físicos.

A aceitação da galeria e do scroll ainda depende das verificações físicas restantes de regularidade dos quadros, resposta à entrada, memória e acessibilidade. Consulte os relatórios de [galeria](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md) e [scroll](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md). Gravações de simulador/emulador não concluem a aceitação em aparelhos físicos.

## Depois da 0.1.0 {#after-0-1-0}

As próximas RCs focam em correção, compatibilidade, acessibilidade, ciclo de vida e documentação. Frentes futuras incluem shaders de views arbitrárias, outros tipos de juntas físicas e suporte modal mais amplo entre plataformas. Os adapters nativos e as fontes vetoriais de sensores documentados já estão na RC.11.

O [projeto comparativo](https://github.com/rafaelaugustos/jolt/issues/65) é separado da entrega do escopo atualmente suportado. As [issues de funcionalidades mais amplas](https://github.com/rafaelaugustos/jolt/issues) não expandem as combinações suportadas pela versão estável nem alteram as alternativas por plataforma e os custos de JavaScript documentados.
