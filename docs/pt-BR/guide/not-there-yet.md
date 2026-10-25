# Ainda não

- [Transições reais de width/height/auto](./size) estão disponíveis para StackLayout/GridLayout, inclusive dentro de ScrollView. Executam layout em JS por frame; distribuição flex, células recicladas e shared elements ficam fora dessa API.

- [Animação de layout](./layout), [drag com limites](./drag), [motion values](./motion-values), [progresso observável](./playback) e [controle conjunto de timelines](./sequences) estão disponíveis. Os contratos de execução nativa e ciclo de vida variam; consulte os guias.
- [Navegação compartilhada](./shared-navigation) e [gestos compartilhados](./shared-gestures) estão disponíveis neste checkout para a próxima beta em páginas estáveis. Resolução de alvos reciclados/fora da tela e galeria completa continuam na [#24](https://github.com/rafaelaugustos/jolt/issues/24).
- A composição geral de gestos com vários dedos está fora de `drag()`; [photo zoom](./photo-zoom) oferece seu próprio controlador de pinch, pan e dispensa.
- [Adaptadores de propriedades externas](./native-properties) exigem um plugin nativo opcional. A pose de câmera e os [adaptadores de luz/material sólido](./scene-lighting) usam SceneKit no iOS; não há adaptador de renderer 3D Android incluído. MapKit e MapLibre usam unidades de câmera distintas.
- O [FOV da câmera SceneKit](./scene-camera) está disponível para câmeras automáticas em perspectiva no iOS. Escala ortográfica e controles arbitrários de lente ficam fora desse adaptador.
- Timelines pausam e retomam seus participantes, mas não oferecem scrub agregado arbitrário de callbacks ou efeitos pontuais. Escritas nativas não isolam um renderer do JavaScript na thread principal.

As [issues](https://github.com/rafaelaugustos/jolt/issues) acompanham as próximas funcionalidades e integrações.
