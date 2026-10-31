# Instalación {#install}

```sh
npm install @rafaelaugusto/jolt@next
```

La **versión candidata 0.1.0-rc.3** se publica con la etiqueta `next`. El alcance de 0.1.0 está congelado mientras se valida la compatibilidad y se prepara la versión estable. Requiere `@nativescript/core` 8.9 o posterior. Es independiente del framework: recibe una vista o un elemento que la contiene, por lo que funciona con NativeScript-Vue, Angular, Svelte o NativeScript sin framework. Las aplicaciones NativeScript-Vue también pueden importar `@rafaelaugusto/jolt/vue` para usar [directivas y un componente de transición](./vue).

Jolt incluye código auxiliar nativo en iOS y Android. Vuelve a compilar la aplicación nativa después de instalar o actualizar Jolt; una actualización de JavaScript por sí sola no puede instalar código nativo.

La versión candidata actual es **0.1.0-rc.3**. Para fijar esa versión, usa `npm install @rafaelaugusto/jolt@0.1.0-rc.3`. Si utilizas [adaptadores de propiedades nativas externas](./native-properties), instala también `@rafaelaugusto/jolt-native@0.1.0-rc.3` y vuelve a compilar la aplicación nativa.

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
