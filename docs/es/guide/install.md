# Instalación {#install}

```sh
npm install @rafaelaugusto/jolt@next
```

RC.6 incluye [movimiento continuo Web](./web-dynamic), con valores, followers y drag/snap, además de [mapeos numéricos, geometría y scroll vertical](./web-support). Las APIs Web siguen experimentales.

La **versión candidata 0.1.0-rc.17** se publica con la etiqueta `next`. El alcance nativo de 0.1.0 está congelado mientras se valida la compatibilidad y se prepara la versión estable. Los consumidores NativeScript requieren `@nativescript/core` 8.9 o posterior. Es independiente del framework: recibe una vista o un elemento que la contiene, por lo que funciona con NativeScript-Vue, Angular, Svelte o NativeScript sin framework. Las aplicaciones NativeScript-Vue también pueden importar `@rafaelaugusto/jolt/vue` para usar [directivas y un componente de transición](./vue).

Jolt incluye código auxiliar nativo en iOS y Android. Vuelve a compilar la aplicación nativa después de instalar o actualizar Jolt; una actualización de JavaScript por sí sola no puede instalar código nativo.

La versión candidata actual es **0.1.0-rc.17**. Para fijar esa versión, usa `npm install @rafaelaugusto/jolt@0.1.0-rc.17`. Si utilizas [adaptadores de propiedades nativas externas](./native-properties), instala también `@rafaelaugusto/jolt-native@0.1.0-rc.17` y vuelve a compilar la aplicación nativa.

## Entradas Web experimentales {#experimental-web-candidate}

Desde **0.1.0-rc.5**, el paquete incluye las entradas experimentales `/web` y `/web/vue`. Instala directamente la candidata publicada; añade Vue solo para el adapter Vue DOM. La raíz y `/vue` siguen siendo entradas nativas.

```sh
npm install @rafaelaugusto/jolt@0.1.0-rc.17
# Solo para el adapter Vue DOM opcional:
npm install vue@^3.5.0
```

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

// Importar es seguro en SSR. Crea el contexto después del montaje en el navegador.
const motion = createWebRuntime(document)
const animation = motion.animate(card, { x: 120, opacity: 1 }, 'snappy')
await animation.finished
motion.dispose() // libera al terminar la aplicación o desmontar el componente
```

| Import                        | Plataforma y dependencias                                                  |
| ----------------------------- | -------------------------------------------------------------------------- |
| `@rafaelaugusto/jolt`         | NativeScript; requiere `@nativescript/core >=8.9.0`.                       |
| `@rafaelaugusto/jolt/native`  | Adapters de propiedades nativas; requiere NativeScript.                    |
| `@rafaelaugusto/jolt/vue`     | NativeScript-Vue; también requiere `nativescript-vue >=3.0.0`.             |
| `@rafaelaugusto/jolt/web`     | Runtime DOM imperativo; no requiere instalar NativeScript, Vue ni React.   |
| `@rafaelaugusto/jolt/web/vue` | Adapter Vue DOM opcional; requiere `vue ^3.5.0`. Ver [Vue Web](./web-vue). |

NativeScript y NativeScript-Vue son peers opcionales del paquete para evitar su instalación en consumidores Web. Siguen siendo obligatorios para las entradas nativas correspondientes. Los peers ausentes producen errores de resolución que nombran `@nativescript/core` o `nativescript-vue`; instala esa dependencia en la aplicación nativa. La aplicación Web debe importar `/web`, también durante SSR. La raíz y `/vue` no cambian de plataforma automáticamente.

La API Web es experimental: expone un runtime por documento con reproducción finita, movimiento continuo, scroll y tipos, sin registro de drivers, diagnósticos internos ni referencias portátiles de componentes. No exporta `/core`, rutas internas ni `/web/react`. La API del navegador requiere tipos DOM; sus declaraciones no requieren globals nativos. Las coordenadas usan píxeles CSS, la rotación usa grados y la escala usa factores. Consulta [reproducción Web finita](./web-runtime) para capacidades, limpieza y límites del control de CSS.

Los [checks del paquete instalado](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/package-consumers.md) cubren Vite en desarrollo/producción, SSR, tipos NodeNext/Bundler y las entradas nativas existentes. La entrada Vue Web opcional tiene su propio consumidor del tarball, con tipos, SSR directo/Vite, entrada/salida y pulsación reales en desarrollo y producción.

## ProMotion en iOS {#promotion-on-ios}

En iOS 15 y posteriores, Jolt solicita hasta 120 Hz para sus animaciones nativas, limitadas por la pantalla de vista. Para permitir velocidades superiores a 60 Hz en un iPhone, agregue esto dentro de la raíz `<dict>` de `App_Resources/iOS/Info.plist` y reconstruya la aplicación:

```xml
<key>CADisableMinimumFrameDurationOnPhone</key>
<true/>
```

Es una preferencia, no una frecuencia fija. iOS puede elegir una frecuencia menor por consumo energético, temperatura o accesibilidad. Las versiones anteriores de iOS mantienen su comportamiento, y las pantallas de 60 Hz reciben una preferencia de 60 Hz. Consulta la [guía ProMotion de Apple](https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays).

Las muestras de la curva y los fotogramas de pantalla son conceptos distintos: Core Animation interpola las muestras de Jolt a la frecuencia que elija la pantalla. No hacen falta más muestras solo para renderizar a 120 Hz.

## Primera animación {#first-animation}

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { animate } from '@rafaelaugusto/jolt'

const card = ref()
const open = () => animate(card.value, 'popIn')
</script>

<template>
  <GridLayout ref="card" @tap="open" />
</template>
```

## La aplicación de demostración {#the-demo-app}

El repositorio incluye una aplicación NativeScript-Vue en [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) con cada ajuste preestablecido, los tres resortes en una bola que puedes interrumpir, escalonar, presionar efectos, bucles y una secuencia en el lanzamiento.

Con el [CLI NativeScript](https://docs.nativescript.org/setup/) instalado:

```sh
npm install
npm run dev        # builds Jolt in watch mode

cd demo
npm install
ns run ios         # or: ns run android
```

## Compatibilidad de versiones de frameworks {#framework-versions}

**Incluido en RC.17.** Los peers opcionales admiten Solid `^1.9.18 || ^2.0.0` y Svelte `^4.2.20 || ^5.0.0`. Son rangos de instalación: un framework sin usar no debe impedir instalar Jolt para una aplicación NativeScript imperativa. El soporte de bindings se distingue abajo.

| Consumidor                            | Combinación probada                                                                                                | Entrada compatible                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Solid Native 2, API imperativa        | Solid 2.0.0, renderer community 2.0.1, DOMiNATIVE 0.1.3, universal/compiler 2.0.0, NativeScript 9.1.3; Node 22.12+ | `@rafaelaugusto/jolt` y subentradas nativas; el componente posee la destrucción       |
| Svelte Native estable, API imperativa | Svelte 4.2.20, renderer community 1.0.32, NativeScript 8.9.9                                                       | `@rafaelaugusto/jolt` y subentradas nativas                                           |
| Svelte 4 sin renderer                 | Svelte 4.2.20 y NativeScript 9.1.3                                                                                 | La instalación imperativa normal también pasa                                         |
| Bindings nativos                      | Solid 1.9.18; Svelte 4.2.20                                                                                        | `/solid` conserva el ciclo de vida de Solid 1; `/svelte` conserva sus actions nativas |
| Bindings Web                          | Solid 1.9.18; Svelte 5.57.3                                                                                        | `/web/solid` y `/web/svelte`; el rango del paquete no amplía esta matriz probada      |

Solid 2 cambia el contrato de efectos. `/solid` y `/web/solid` rechazan ese runtime antes de crear recursos, indicando la API imperativa nativa o Web. Esta corrección no porta los bindings Solid. Svelte Native 1.0.32 fija Core 8.9.9; la compatibilidad con Core 9 pertenece al renderer, separada de los peers de Jolt.

Las fixtures empaquetadas usan resolución npm normal, verifican los tipos imperativos y generan bundles de producción iOS/Android sin bindings Jolt no utilizados. No establecen aceptación de runtime de los nuevos renderers. Las grabaciones existentes conservan sus versiones y plataformas originales. Consulta el [informe del paquete](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-peers.md).

Las aplicaciones que permanecen en RC.16 mantienen sus overrides puntuales existentes. RC.17 incluye la corrección. En Mavis, la aplicación raíz posee los overrides `solid-js` y `svelte` dentro de `@rafaelaugusto/jolt`; elimina solo esos mapeos tras actualizar a una versión verificada que incluya [#517](https://github.com/rafaelaugustos/jolt/issues/517). El override separado de Svelte Native/Core no se resuelve aquí. Un override no valida bindings incompatibles; las fixtures no usan `--force` ni `--legacy-peer-deps`.
