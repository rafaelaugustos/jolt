# Instalación {#install}

```sh
npm install @rafaelaugusto/jolt@next
```

La **versión candidata 0.1.0-rc.4** se publica con la etiqueta `next`. El alcance de 0.1.0 está congelado mientras se valida la compatibilidad y se prepara la versión estable. Requiere `@nativescript/core` 8.9 o posterior. Es independiente del framework: recibe una vista o un elemento que la contiene, por lo que funciona con NativeScript-Vue, Angular, Svelte o NativeScript sin framework. Las aplicaciones NativeScript-Vue también pueden importar `@rafaelaugusto/jolt/vue` para usar [directivas y un componente de transición](./vue).

Jolt incluye código auxiliar nativo en iOS y Android. Vuelve a compilar la aplicación nativa después de instalar o actualizar Jolt; una actualización de JavaScript por sí sola no puede instalar código nativo.

La versión candidata actual es **0.1.0-rc.4**. Para fijar esa versión, usa `npm install @rafaelaugusto/jolt@0.1.0-rc.4`. Si utilizas [adaptadores de propiedades nativas externas](./native-properties), instala también `@rafaelaugusto/jolt-native@0.1.0-rc.4` y vuelve a compilar la aplicación nativa.

## Candidato Web experimental {#experimental-web-candidate}

El checkout ofrece la entrada experimental `@rafaelaugusto/jolt/web`. **No está incluida en la versión 0.1.0-rc.4 publicada**; valida un candidato empaquetado localmente antes de integrarlo en Mavis u otra aplicación. Este trabajo no implica una publicación en npm.

```sh
# En este repositorio:
npm ci
npm run build
npm pack
# En la aplicación Web, instala el tarball generado:
npm install /absolute/path/to/rafaelaugusto-jolt-0.1.0-rc.4.tgz
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

La API Web es experimental: expone una factory por documento, controles finitos y tipos, sin registro de drivers, diagnósticos internos ni referencias portátiles de componentes. No exporta `/core`, rutas internas ni `/web/vue`. La API del navegador requiere tipos DOM; sus declaraciones no requieren globals nativos. Las coordenadas usan píxeles CSS, la rotación usa grados y la escala usa factores. Consulta [reproducción Web finita](./web-runtime) para capacidades, limpieza y límites del control de CSS.

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
