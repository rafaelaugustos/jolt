# Instalação

```sh
npm install @rafaelaugusto/jolt@next
```

A **candidata a release 0.1.0-rc.4** é publicada sob a tag `next`. O escopo de funcionalidades da 0.1.0 está congelado enquanto continuam as validações de compatibilidade e de release. Requer `@nativescript/core` 8.9 ou mais novo. Não depende de framework: recebe uma view, ou um elemento que contém uma, então funciona com NativeScript-Vue, Angular, Svelte ou NativeScript puro. Apps NativeScript-Vue também podem importar `@rafaelaugusto/jolt/vue` para [diretivas e um componente de transição](./vue).

O Jolt inclui helpers nativos no iOS e no Android. Recompile o app nativo após instalar ou atualizar o Jolt; uma atualização só de JavaScript não instala código nativo.

A candidata atual é **0.1.0-rc.4**. Para fixá-la, use `npm install @rafaelaugusto/jolt@0.1.0-rc.4`. Para [adaptadores de propriedades nativas externas](./native-properties), instale também `@rafaelaugusto/jolt-native@0.1.0-rc.4` e recompile o aplicativo nativo.

## Candidato Web experimental {#experimental-web-candidate}

O checkout agora oferece a entrada experimental `@rafaelaugusto/jolt/web`. Ela **não está incluída na versão 0.1.0-rc.4 publicada**; valide um candidato empacotado localmente antes de integrar ao Mavis ou a outro app. Este trabalho de empacotamento não implica publicação no npm.

```sh
# Neste repositório:
npm ci
npm run build
npm pack
# No app Web, instale o tarball gerado:
npm install /absolute/path/to/rafaelaugusto-jolt-0.1.0-rc.4.tgz
```

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

// O import é seguro em SSR. Crie o contexto após a montagem no navegador.
const motion = createWebRuntime(document)
const animation = motion.animate(card, { x: 120, opacity: 1 }, 'snappy')
await animation.finished
motion.dispose() // libere ao encerrar a aplicação ou desmontar o componente
```

| Import                       | Plataforma e dependências                                              |
| ---------------------------- | ---------------------------------------------------------------------- |
| `@rafaelaugusto/jolt`        | NativeScript; exige `@nativescript/core >=8.9.0`.                      |
| `@rafaelaugusto/jolt/native` | Adapters de propriedades nativas; exige NativeScript.                  |
| `@rafaelaugusto/jolt/vue`    | NativeScript-Vue; também exige `nativescript-vue >=3.0.0`.             |
| `@rafaelaugusto/jolt/web`    | Runtime DOM imperativo; não exige instalar NativeScript, Vue ou React. |

NativeScript e NativeScript-Vue são peers opcionais no pacote para que o consumidor Web não os instale. Continuam obrigatórios nas respectivas entradas nativas. Peers ausentes geram erros de resolução citando `@nativescript/core` ou `nativescript-vue`; instale a dependência indicada no app nativo. O app Web deve importar `/web`, inclusive em SSR. A raiz e `/vue` não trocam de plataforma automaticamente.

A API Web é experimental: expõe uma factory por documento, controles finitos e tipos, sem registro de drivers, diagnósticos internos ou referências portáteis de componentes. `/core`, caminhos internos e `/web/vue` não são exportados. A API browser exige tipos DOM; suas declarações alcançáveis não exigem globals nativos. Coordenadas usam pixels CSS, rotação usa graus e escala usa fatores. Veja [playback Web finito](./web-runtime) para capacidades, cleanup e limites de controle do CSS.

Os [checks do pacote instalado](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/package-consumers.md) cobrem Vite em desenvolvimento/produção, SSR, tipos NodeNext/Bundler e as entradas nativas existentes. O futuro adapter Vue Web precisará de seu próprio consumidor do pacote.

## ProMotion no iOS

No iOS 15 ou mais novo, o Jolt solicita até 120 Hz para suas animações nativas, respeitando o limite da tela da view. Para permitir taxas acima de 60 Hz no iPhone, adicione isto dentro do `<dict>` principal de `App_Resources/iOS/Info.plist` e recompile o app:

```xml
<key>CADisableMinimumFrameDurationOnPhone</key>
<true/>
```

É uma preferência, não uma taxa fixa. O iOS pode escolher uma taxa menor por economia de energia, temperatura ou ajustes de acessibilidade. Versões anteriores do iOS mantêm o comportamento existente, e telas de 60 Hz recebem uma preferência de 60 Hz. Veja o [guia de ProMotion da Apple](https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays).

Amostras da curva e frames da tela são coisas diferentes: o Core Animation interpola entre as amostras do Jolt na taxa escolhida pela tela. Renderizar a 120 Hz, por si só, não exige mais amostras.

## Primeira animação

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

## O app de demonstração

O repositório traz um app NativeScript-Vue em [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) com todos os presets, os três springs numa bola que você pode interromper, stagger, efeitos de press, loops e uma sequência na abertura.

Com o [NativeScript CLI](https://docs.nativescript.org/setup/) instalado:

```sh
npm install
npm run dev        # compila o Jolt em modo watch

cd demo
npm install
ns run ios         # ou: ns run android
```
