# Status da versão e limites {#ainda-nao}

**A 0.1.0-rc.2 está disponível.** Seus recursos já foram entregues nas combinações documentadas em cada guia. O escopo de funcionalidades da 0.1.0 está congelado; a validação para a versão estável continua em andamento.

A RC.2 inclui correções de âncoras de scroll, navegação iOS após background e press/composição em camadas, além de molas nativas no ponteiro e evidências do ciclo de vida da galeria no Android. As medições de capacidade de bindings e camadas continuam na [#242](https://github.com/rafaelaugustos/jolt/issues/242).

## Disponível na RC.2 {#available-in-rc-1}

- [Navegação compartilhada](./shared-navigation), [gestos compartilhados](./shared-gestures), [retorno à célula atual](./return-targets) e [galeria conectada](./gallery), nas combinações documentadas de Frame/ListView/imagens estáticas.
- [Composição nativa de gestos](./gestures): pan, pinch e rotação, além da transferência de gesto compatível com o Core ScrollView vertical. As [restrições de arraste](./drag) e o [zoom de fotos](./photo-zoom) têm seus próprios contratos de interação.
- [Composição de scroll](./scroll-header) com o adaptador de Core ListView e [sensores de rotação/gravidade](./device-sensors) alimentando valores de movimento nativos.
- [Dimensões reais](./size), [mudanças de layout](./layout), [valores de movimento](./motion-values), [progresso observável](./playback) e [controles conjuntos de timeline](./sequences).
- [Propriedades nativas externas](./native-properties), incluindo [luzes/materiais do SceneKit](./scene-lighting), [FOV da câmera](./scene-camera) e [ambiente/parâmetros de shaders](./scene-shaders), pelo plugin nativo opcional.
- [Gravidade](./gravity), [física de círculos com vínculos](./physics-attachments), [desenho e transformação de vetores](./shapes), [desfoque animado](./blur) e [Liquid Glass](./glass), com o suporte e as alternativas por plataforma documentados.

## Limites atuais {#current-limits}

- `animateSize()` suporta StackLayout/GridLayout, inclusive dentro de ScrollView, e executa medição/layout em JavaScript a cada quadro. Distribuição flex, células recicladas e elementos compartilhados ficam fora dessa API.
- `drag()` não oferece composição genérica de gestos com vários dedos. Use [`gestures()`](./gestures) para pan/pinch/rotação, ou [zoom de fotos](./photo-zoom) para seu controlador específico de pinch, pan e fechamento. O adaptador de transferência de gesto suporta Core ScrollView vertical; outras combinações de listas/contêineres precisam de adaptadores e validação nativa próprios.
- Adaptadores de propriedades externas exigem `@rafaelaugusto/jolt-native`. Os adaptadores incluídos de câmera, luzes e materiais do SceneKit são exclusivos do iOS; não há adaptador incluído de renderização 3D para Android. As unidades das câmeras de MapKit e MapLibre são distintas.
- O FOV da câmera SceneKit suporta projeção em perspectiva automática no iOS. Escala ortográfica, matrizes de projeção personalizadas e controles arbitrários de lente ficam fora desse adaptador.
- Timelines pausam e retomam seus participantes, mas não oferecem controle arbitrário do progresso agregado de callbacks ou efeitos executados uma única vez.
- A reprodução nativa tem [formas de execução](./how-it-works) específicas por API. Escritas de propriedades nativas não isolam um renderizador do JavaScript na thread principal. Layout, assinaturas opcionais, entrada e ciclo de vida mantêm seus custos documentados em JavaScript.

## Da RC à 0.1.0 {#da-rc-a-0-1-0}

As issues de aceitação abertas abaixo tratam de APIs já entregues. Antes da versão estável, valide as combinações suportadas em aparelhos físicos iOS e Android:

- **Galeria ([#117](https://github.com/rafaelaugustos/jolt/issues/117)):** zoom/retorno interrompido, alvos reciclados ou excluídos, rotação, acessibilidade e navegação repetida sem overlays retidos.
- **Composição de scroll ([#116](https://github.com/rafaelaugustos/jolt/issues/116)):** reversão/inércia, mudanças tardias de layout, preservação de âncora e limpeza com o adaptador suportado de Core ListView.
- **Sensores ([#114](https://github.com/rafaelaugustos/jolt/issues/114)):** hardware real de rotação/gravidade, mapeamento de orientação, custo de amostragem e limpeza das assinaturas. Entradas de simulador validam o processamento, não a aquisição dos sensores físicos.
- Mantenha os testes gerais, de iOS e Android e seus controles negativos passando no commit da versão. Verifique a instalação dos pacotes correspondentes e uma recompilação nativa limpa; resolva as regressões que bloqueiam a versão antes de marcar a estável.

A regularidade dos quadros, a resposta à entrada e a memória retida ainda precisam de evidência em aparelhos físicos. Consulte os relatórios de [galeria](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md), [scroll](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md) e [sensores](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md) para ver as evidências coletadas e as verificações restantes. Gravações de simulador/emulador não concluem a aceitação em aparelhos físicos.

## Depois da 0.1.0 {#after-0-1-0}

As próximas RCs focam em correção, compatibilidade, acessibilidade, limpeza do ciclo de vida e documentação. Novas capacidades ficam para depois da 0.1.0: outros adaptadores de frameworks, shaders arbitrários de views, mais tipos de sensores, juntas físicas entre corpos e navegação modal genérica.

O [projeto comparativo](https://github.com/rafaelaugustos/jolt/issues/65) é separado da entrega do escopo atualmente suportado. As [issues de funcionalidades mais amplas](https://github.com/rafaelaugustos/jolt/issues) não expandem as combinações suportadas pela versão estável nem alteram as alternativas por plataforma e os custos de JavaScript documentados.
