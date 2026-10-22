# Ainda não

- [Animação de layout](./layout), [drag com limites](./drag), [motion values](./motion-values), [progresso observável](./playback) e [controle conjunto de timelines](./sequences) estão disponíveis. Os contratos de execução nativa e ciclo de vida variam; consulte os guias.
- Transições de elementos compartilhados entre telas continuam planejadas ([#24](https://github.com/rafaelaugustos/jolt/issues/24)).
- A composição geral de gestos com vários dedos está fora de `drag()`; [photo zoom](./photo-zoom) oferece seu próprio controlador de pinch, pan e dispensa.
- [Adaptadores de propriedades externas](./native-properties) exigem um plugin nativo opcional. A câmera 3D de referência usa SceneKit no iOS; não há adaptador de renderer 3D Android incluído. MapKit e MapLibre usam unidades de câmera distintas.
- Timelines pausam e retomam seus participantes, mas não oferecem scrub agregado arbitrário de callbacks ou efeitos pontuais. Escritas nativas não isolam um renderer do JavaScript na thread principal.

As [issues](https://github.com/rafaelaugustos/jolt/issues) acompanham as próximas funcionalidades e integrações.
