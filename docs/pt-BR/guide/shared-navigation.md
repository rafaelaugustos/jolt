# Navegação compartilhada

`sharedNavigation(frame)` conecta **uma imagem estática ou um card simples** entre duas páginas no mesmo Frame do NativeScript. Uma camada nativa anima posição, tamanho e recorte arredondado. Imagens também interpolam o retângulo do conteúdo, inclusive de `aspectFill` para `aspectFit`. O conteúdo dos cards faz crossfade sem esticar o texto.

Disponível desde a **0.1.0-rc.1**. Recompile o aplicativo nativo depois de instalar esta versão. Esta é a primeira entrega da [#24](https://github.com/rafaelaugustos/jolt/issues/24): ida e volta programáticas. Para volta interativa nativa de imagem/cartão no iOS e Android 14+, use [gestos compartilhados](./shared-gestures). Para células recicladas ou fora da tela, adicione um [resolvedor de retorno](./return-targets).

<Clip name="shared-navigation-ios" caption="Simulador iOS 26.2: toques reais via XCTest abrem uma foto e um card de passe diário, depois voltam pelo vue-router-ns. Reprodução nativa do Jolt na velocidade original. Não é medição de desempenho em aparelho físico." />
<Clip name="shared-navigation-pt-ios" caption="Simulador iOS 26.2: a mesma navegação da foto e do card em português, com toques reais via XCTest e velocidade original." />
<Clip name="shared-navigation-android" caption="Emulador Android: toques reais via ADB abrem e retornam da foto e do card pelo vue-router-ns. Reprodução nativa do Jolt na velocidade original. Volta programática, sem prévia interativa ou predictive back." />

## Um controlador por Frame

```ts
import { sharedNavigation } from '@rafaelaugusto/jolt/shared-navigation'

// Mantenha o controlador durante a vida do Frame, não apenas do componente de origem.
const motion = sharedNavigation(frame, {
  transition: 'smooth', // 'snappy', 'bouncy' ou spring/tween finito do Jolt
  navigationTimeout: 3000,
  layoutTimeout: 500,
  maxSnapshotPixels: 8_000_000,
})
```

Use a mesma **`sharedTransitionTag` do Core** na origem e no destino. A identidade pertence à página atual deste Frame; Frames aninhados ficam excluídos. Tags ausentes ou duplicadas pulam a animação e preservam a rota. `sharedTransitionIgnore` exclui uma view.

```vue
<!-- Página de origem -->
<Image
  src="~/images/cove.png"
  sharedTransitionTag="place:42"
  stretch="aspectFill"
  width="170"
  height="210"
  borderRadius="24"
/>
<!-- Página de destino: mesma imagem local decodificada, outra geometria. -->
<Image
  src="~/images/cove.png"
  sharedTransitionTag="place:42"
  stretch="aspectFit"
  width="320"
  height="440"
  borderRadius="10"
/>
```

Carregue as imagens antes de navegar. O modo de imagem exige `Image` do NativeScript, o mesmo `src` ou `ImageSource` nas duas pontas, sem tint, com `aspectFill`/`aspectFit`. Imagens animadas, distorção com fill, imagens remotas ainda carregando e views de GPU usam fallback. Containers simples usam snapshots nativos limitados por orçamento. Ancestrais podem rolar ou ter escala uniforme; rotação, transparência, recorte parcial, elementos fora da tela e janelas diferentes ficam indisponíveis.

## Core Frame e vue-router-ns

O callback é invocado **uma vez**, depois da captura da origem. Repasse a opção `animated: false`: o Frame/router controla a rota, os hooks e o histórico; o Jolt controla a camada compartilhada. Não combine a operação com outra transição de página, `SharedTransition.custom()` do Core ou zoom do UIKit na mesma rota.

```ts
const opening = motion.navigate({
  tag: 'place:42',
  navigate: (options) => frame.navigate({ create: createDetailPage, ...options }),
})
const result = await opening.finished

// A volta resolve a tag atual depois do layout, sem reutilizar view/retângulo antigo.
await motion.navigate({
  tag: 'place:42',
  navigate: () => frame.goBack(), // entrada criada sem animação de página
}).finished
```

O preview declara e exercita **vue-router-ns 0.1.0-rc.2**:

```ts
await motion.navigate({
  tag: 'place:42',
  navigate: (options) => router.push('/places/42', options),
}).finished

await motion.navigate({
  tag: 'place:42',
  navigate: (options) => router.back(options),
}).finished
```

Nesta entrega, use um Frame/janela, push/back comum e conteúdo já disponível. Rotas aninhadas/modais, tabs, troca entre Frames e realização automática de itens de lista ficam fora do contrato. Desative o swipe-back interativo da página ao demonstrar este backend programático; navegação do sistema fora do controlador mantém o comportamento normal do router e cancela uma camada ativa.

## Controle e interrupção

`state` é `idle`, `preparing`, `running` ou `disposed`. Durante uma operação, outro `navigate()` retorna `unavailable` / `busy` **sem chamar seu callback**. Desabilite controles repetidos ou trate esse resultado; pedidos não entram em fila. Esta etapa não oferece retarget contínuo de gesto de volta.

`finished` sempre resolve a operação invocada: `completed`, `unavailable`, `cancelled` ou `failed`, mais `navigated`, `reason` opcional e `error` opcional. Guard rejeitado retorna `failed`; guard resolvido sem mudar a página retorna `unavailable`. Falta de destino, layout inválido e prazos vencidos restauram as views. `cancel()` cancela somente a camada: não desfaz uma rota confirmada nem aborta um guard do router, que ainda pode concluir depois.

Rotação, movimento/unload do destino, outra navegação, suspensão do app, ativação de movimento reduzido e `dispose()` encerram a camada com segurança. Movimento reduzido pula a captura e realiza a mesma rota. A camada nativa fica fora da acessibilidade e dos toques; o foco continua nas páginas reais. A biblioteca não instala nem substitui delegates de navegação ou reconhecedores de gesto do sistema.

A preparação pode chamar JavaScript. A reprodução usa tracks amostradas do Jolt em `CADisplayLink` / `Choreographer`, sem callback JavaScript nem cópia de bitmap por frame. A integração usa as tags e a fronteira de navegação do Frame, em vez do helper de timing de `SharedTransition`, cujo spring/recorte por plataforma não representa este contrato de forma equivalente. **Não** é um adaptador do zoom do UIKit no iOS 18 e não equipara seus parâmetros internos à física do Jolt.

O orçamento combinado padrão é de 8 milhões de pixels (cerca de 32 MB RGBA), com máximo de 32 milhões. As esperas têm prazo e a reprodução nativa tem limite de 30 segundos. Descarte o controlador ao abandonar o Frame; seu unload faz isso automaticamente. Para mudanças dentro da mesma página, use [shared-layout](./shared-layout).

Para imagens/cartões ligados ao gesto nativo de voltar em páginas estáveis, use [gestos compartilhados](./shared-gestures).
