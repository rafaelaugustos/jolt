# Ainda não

- [Transições reais de width/height/auto](./size) estão disponíveis para StackLayout/GridLayout, inclusive dentro de ScrollView. Executam layout em JS por frame; distribuição flex, células recicladas e shared elements ficam fora dessa API.

- [Animação de layout](./layout), [drag com limites](./drag), [motion values](./motion-values), [progresso observável](./playback) e [controle conjunto de timelines](./sequences) estão disponíveis. Os contratos de execução nativa e ciclo de vida variam; consulte os guias.
- [Navegação compartilhada](./shared-navigation), [gestos compartilhados](./shared-gestures), [retorno à célula atual](./return-targets) e a [galeria conectada](./gallery) estão disponíveis na rc.1 nas combinações documentadas de Frame/ListView/imagens estáticas. A validação física da galeria continua na [#117](https://github.com/rafaelaugustos/jolt/issues/117).
- A composição geral de gestos com vários dedos está fora de `drag()`; [photo zoom](./photo-zoom) oferece seu próprio controlador de pinch, pan e dispensa.
- [Adaptadores de propriedades externas](./native-properties) exigem um plugin nativo opcional. A pose de câmera e os [adaptadores de luz/material sólido](./scene-lighting) usam SceneKit no iOS; não há adaptador de renderer 3D Android incluído. MapKit e MapLibre usam unidades de câmera distintas.
- O [FOV da câmera SceneKit](./scene-camera) está disponível para câmeras automáticas em perspectiva no iOS. Escala ortográfica e controles arbitrários de lente ficam fora desse adaptador.
- Timelines pausam e retomam seus participantes, mas não oferecem scrub agregado arbitrário de callbacks ou efeitos pontuais. Escritas nativas não isolam um renderer do JavaScript na thread principal.

As [issues](https://github.com/rafaelaugustos/jolt/issues) acompanham as próximas funcionalidades e integrações.

## Da RC à 0.1.0

O escopo documentado da rc.1 está congelado para a 0.1.0. As próximas candidatas se concentram em correção, compatibilidade, acessibilidade, limpeza do ciclo de vida e documentação. Novas funcionalidades ficam para depois da 0.1.0; as issues mais amplas não expandem as combinações suportadas pela estável.

Antes de aceitar a versão estável:

- Validar a galeria suportada em iOS e Android físicos: interrupção de zoom/retorno, alvos reciclados ou removidos, rotação, acessibilidade e navegação repetida sem overlays retidos ([#117](https://github.com/rafaelaugustos/jolt/issues/117)).
- Validar a composição de scroll com Core ListView em aparelhos físicos, incluindo inversão/fling, mudanças tardias de layout, preservação de âncora e limpeza ([#116](https://github.com/rafaelaugustos/jolt/issues/116)).
- Validar sensores reais de rotação/gravidade, mapeamento de orientação, custo de coleta e limpeza de assinaturas em um iPhone e um Android físicos ([#114](https://github.com/rafaelaugustos/jolt/issues/114)). Entradas simuladas validam o processamento, não o hardware.
- Manter as regressões gerais, iOS e Android e seus controles negativos verdes no commit do release; conferir instalação dos pacotes correspondentes e recompilação nativa limpa. Registrar e resolver regressões bloqueadoras antes da tag estável.

Cadência de frames, resposta à entrada e memória retida ainda precisam de evidência em aparelhos físicos. O [projeto de comparação](https://github.com/rafaelaugustos/jolt/issues/65) é separado da entrega deste escopo suportado. Novos adaptadores de frameworks, shaders arbitrários em views, tipos de sensores, vínculos entre corpos físicos e navegação modal geral ficam para depois. Os fallbacks de plataforma e custos de JavaScript por frame continuam documentados; a RC não amplia esses contratos.
