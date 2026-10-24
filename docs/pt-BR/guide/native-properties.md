# Propriedades nativas externas

Veja [ambiente e parâmetros de shader](./scene-shaders) para os adaptadores de iluminação e uniforms previstos para a beta.17.

Anime coordenadas de mapas, câmeras, luzes e materiais de cor sólida SceneKit sem criar um laço por quadro em JavaScript. A entrada opcional `@rafaelaugusto/jolt/native` oferece registro de propriedades, reprodução nativa compilada e adaptadores de referência. Importar a entrada principal JavaScript não inicializa esse registro nem carrega um SDK de mapas.

<Clip name="native-map-ios" caption="Annotation e câmera MapKit, pausadas e retomadas juntas no simulador iOS. Escritas nativas das propriedades, em tempo real." />
<Clip name="native-map-android" caption="Marcador e câmera MapLibre 11.8.0 no emulador Android. O SDK é dependência da demo; escritas nativas das propriedades, em tempo real." />
<Clip name="native-camera-ios" caption="Uma câmera SceneKit real muda posição e orientação, pausa e continua no simulador iOS. Este adaptador é exclusivo do iOS." />

## Instalação opcional

O registro e os adaptadores de mapas e pose de câmera estão disponíveis desde o Jolt **0.1.0-beta.13**. [Luzes e materiais SceneKit](./scene-lighting) exigem **0.1.0-beta.14** ou mais recente. Use o core e o pacote nativo opcional na mesma versão.

Instale `@rafaelaugusto/jolt-native` junto com o Jolt e recompile o aplicativo nativo. O registro JavaScript fica na entrada `/native`; os fontes compilados e os frameworks MapKit/SceneKit ficam exclusivamente nesse plugin opcional. Apps com somente o pacote principal não incluem esses helpers. A ausência do plugin produz um erro explícito ao criar uma propriedade.

```sh
npm install @rafaelaugusto/jolt @rafaelaugusto/jolt-native
```

MapLibre continua sendo uma dependência separada do app Android. A demo usa um plugin local de desenvolvimento para fixar o SDK 11.8.0; `npm install` em `demo` instala os dois plugins locais.

## Usando um adaptador

```ts
import { timeline } from '@rafaelaugusto/jolt'
import { mapKitCoordinate, mapKitCamera } from '@rafaelaugusto/jolt/native'

const marker = mapKitCoordinate(annotation)
const camera = mapKitCamera(mapView)
const scene = timeline([
  {
    at: 0,
    run: () =>
      marker.animate(
        { latitude: 37.78, longitude: -122.415 },
        { duration: 4000, ease: 'linear' },
      ),
  },
  {
    at: 0,
    run: () =>
      camera.animate(
        {
          latitude: 37.78,
          longitude: -122.415,
          altitude: 1300,
          pitch: 45,
          heading: 50,
        },
        { duration: 4000, ease: 'sineInOut' },
      ),
  },
])
scene.pause()
scene.play()
// Antes de destruir/substituir os alvos nativos:
scene.stop()
marker.dispose()
camera.dispose()
```

Cada propriedade oferece `get()`, `set(value)`, `animate(to, transition)`, `bind(value, map)`, `stop()` e `dispose()`. `animate()` retorna `PlaybackAnimation`, com pausa, retomada, progresso finito e conclusão. Wrappers do mesmo objeto e propriedade compartilham a posse da animação. Parar ou descartar um wrapper antigo não para o trabalho de um wrapper mais recente. O descarte é definitivo e deve acontecer antes da destruição do alvo pelo SDK.

```ts
const release = marker.bind(progress, (p) => ({
  latitude: 37.772 + p * 0.008,
  longitude: -122.423 + p * 0.008,
}))
// progress pode ser um motion value ou playbackProgress(animation).
// map roda na preparação das amostras, não em cada quadro nativo.
release()
```

O mapeamento deve ser puro, sem efeitos colaterais nem leituras de estado externo variável. O Jolt o amostra na configuração e nas mudanças da origem, com até 60 amostras por segundo, limitadas a 6000 intervalos uniformes mais os keyframes existentes. Mudanças da origem recompilam a ligação nativa. Eventos de gestos e reconstruções das janelas de composição mantêm os [limites dos motion values](./motion-values); entradas JavaScript arbitrárias não se tornam fontes nativas.

## Alvos e unidades

| Adaptador            | Alvo                                   | Valor                                                        | Plataforma |
| -------------------- | -------------------------------------- | ------------------------------------------------------------ | ---------- |
| `mapKitCoordinate`   | `MKAnnotation` com coordenada gravável | `{ latitude, longitude }`, graus                             | iOS        |
| `mapKitCamera`       | `MKMapView`                            | Coordenada, `altitude` em metros, `pitch`/`heading` em graus | iOS        |
| `mapLibreCoordinate` | `Marker` do MapLibre                   | `{ latitude, longitude }`, graus                             | Android    |
| `mapLibreCamera`     | `MapLibreMap`                          | Coordenada, nível `zoom`, `tilt`/`bearing` em graus          | Android    |
| `sceneKitPose`       | `SCNNode`, incluindo o nó da câmera    | `{ position: [x,y,z], orientation: [x,y,z,w] }`              | iOS        |

Para zoom de câmera em perspectiva, use [`sceneKitFieldOfView(camera)`](./scene-camera): ângulo de uma `SCNCamera` entre 1–179 graus, com playback nativo e binding a motion values. Esse adaptador exige versões correspondentes do core/plugin **0.1.0-beta.15** ou mais recentes e recompilação nativa.

Os cinco [adaptadores de aparência SceneKit](./scene-lighting#propriedades-e-unidades) aceitam `SCNLight` ou `SCNMaterial`: `sceneKitLightIntensity`, `sceneKitLightColor`, `sceneKitMaterialTransparency`, `sceneKitMaterialDiffuse` e `sceneKitMaterialEmission`. Todos são exclusivos do iOS; o guia inclui demo nativa e migração do loop JS por frame.

O pacote mantém NativeScript 8.9+ como mínimo; as demos de referência são verificadas com NativeScript 9.1, iOS 26 e Android 16. MapLibre é opcional e deve ser adicionado ao aplicativo; a demo fixa `org.maplibre.gl:android-sdk:11.8.0`. Isso não representa suporte automático a todas as versões ou plugins de mapas. SceneKit não tem adaptador Android. Um renderer Android compilado pode implementar o mesmo contrato.

Coordenadas interpolam latitude linearmente e usam a menor diferença de longitude, inclusive ao cruzar ±180°. É uma aproximação local, não uma geodésica nem uma promessa de velocidade constante sobre o solo. Orientações do mapa usam o menor ângulo. Altitude MapKit e zoom MapLibre têm unidades distintas. Pitch MapKit aceita 0–80°; tilt MapLibre, 0–60°; zoom, 0–24. O SDK pode impor limites adicionais. MapLibre limita a latitude à projeção Mercator. Coordenada e estado da câmera são atualizados como valores compostos.

Poses SceneKit usam o caminho mais curto entre quaternions unitários e normalização nativa entre amostras. A posição usa unidades da cena. Na interrupção, o adaptador lê o [nó de apresentação](https://developer.apple.com/documentation/scenekit/scnnode/presentation); escritas desativam ações implícitas. Remova constraints/actions concorrentes das propriedades controladas pelo Jolt. MapKit usa [`setCamera(..., animated: false)`](<https://developer.apple.com/documentation/mapkit/mkmapview/setcamera(_:animated:)>); MapLibre usa uma atualização imediata, evitando uma segunda curva do SDK. Pare a propriedade antes de devolver o controle ao gesto do usuário ou a outro controlador do renderer.

## Registrando uma propriedade

```ts
const reveal = registerNativeProperty<number>({
  name: 'acme.chart/reveal',
  units: ['fração'],
  platforms: ['ios', 'android'],
  encode: (n) => [n],
  decode: (components) => components[0],
  create: (chart) => createCompiledChartSink(chart),
})
const amount = reveal(nativeChart)
amount.animate(1, 'snappy')
```

O plugin fornece `createCompiledChartSink`. Implemente `JoltPropertySink` em Objective-C/Swift ou `org.rafaelaugusto.jolt.PropertySink` em Java/Kotlin. Os métodos nativos `read()`/`write()` usam vetores numéricos finitos correspondentes a `units`; o sink guarda uma referência fraca e informa se o alvo ainda existe. Escritas compostas devem ser atômicas. As fábricas escalares incluídas aceitam um key path numérico Objective-C ou getter/setter JavaBean float/double. O registro rejeita nomes duplicados, plataformas indisponíveis, vetores inválidos e implementações de sink geradas por JavaScript. `validate` e `interpolate` personalizados rodam ao preparar as amostras.

O player escreve na thread principal/UI nativa. Um renderer com outra fila deve encaminhar as escritas com segurança no sink compilado e definir a sincronização das leituras de apresentação; não deve chamar um setter JavaScript por quadro. Não existe fallback JavaScript implícito. Os helpers nativos são distribuídos separadamente em `@rafaelaugusto/jolt-native`; as dependências dos SDKs continuam opcionais.

Adaptadores espaciais declaram `spatial: true` e aplicam o destino imediatamente com movimento reduzido. Propriedades escalares genéricas mantêm a duração. Não há camadas aditivas diretamente no adaptador; quando fizer sentido, ligue um [motion value escalar com camadas](./motion-values#camadas-em-um-valor). Uma pose quaternion não herda a soma de escalares.

## Validação e descarte

**Run native checks** na demo exercita a view compilada de exemplo com a propriedade `reveal`, incluindo tween, mola, pausa/seek/retomada, valores compartilhados, camadas, observação de progresso, timeline, interrupção e descarte nas duas plataformas. Confere a quantidade de players nativos e que ligações nativas não solicitam quadros de observação JavaScript. Testes unitários cobrem registro, amostragem composta, ângulos e quaternions. Autores de plugins devem repetir os cenários com seu próprio sink e SDK, incluindo destruição do SDK e background/foreground.

Use `scope.add(property.animate(...))` e `scope.use(() => property.bind(...))` para gerenciar os recursos. Descarte a propriedade quando o alvo for realmente destruído. Callbacks de `subscribe()` continuam em JavaScript. Escritas nativas usam a thread UI, então JavaScript na thread principal pode atrasá-las; veja [desempenho Android](./android-performance). Reprodução nativa não promete isolamento de uma thread UI ocupada.

O exemplo compilado está em `demo/native-fixture`, e a suíte reutilizável em `benchmarks/playback-adapters.ts`. Ela também verifica escopo, invalidação do alvo, movimento lento e amostragem durante JavaScript ocupado.

Para migrar de `value.subscribe(n => nativeTarget.setValue(n))`, registre o sink nativo e use `property.bind(value, n => n)`. Guarde e chame a função de liberação no mesmo ponto do antigo unsubscribe.

O wrapper preserva a identidade do alvo até `dispose()`, que também libera sua referência JavaScript. O sink nativo usa referência fraca. Descarte antes de destruir o objeto no SDK; não use coleta de lixo como substituto do ciclo de vida explícito.
