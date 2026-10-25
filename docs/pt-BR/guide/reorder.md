# Reordenar listas

Segure a alça de uma linha, mova pela lista e solte. Os vizinhos abrem espaço enquanto a lista rola perto das bordas. A linha levantada permanece em uma cópia nativa mesmo depois que sua célula original sai da área visível e é reciclada.

Disponível desde a **0.1.0-beta.17**, no pacote principal. Instale `@rafaelaugusto/jolt@0.1.0-beta.18` e recompile o app para incluir as classes de entrada e renderização. Não exige o plugin opcional de propriedades nativas.

<Clip name="reorder-ios" caption="Simulador iOS, entrada real pelo XCTest: arraste entre linhas de alturas diferentes, mova com botões e segure na borda inferior para atravessar células recicladas. Velocidade original; não é uma gravação de aparelho físico." />

<Clip name="reorder-android" caption="Emulador Android, toques reais do sistema: reordenação de um ListView do Core com 200 itens, mantendo a linha sob o dedo enquanto a rolagem nas bordas recicla sua célula original. Velocidade original." />

## Um único movimento confirmado

Importe de `@rafaelaugusto/jolt/reorder`. O primeiro adaptador suporta um **ListView vertical do NativeScript Core, sem seções, com alturas variáveis**. Coloque a lista como único filho direto de um `ReorderSurface`; no Android ele mantém o gesto acima das células recicladas sem substituir o listener de toque do Core. No iOS, o surface é um GridLayout comum.

Registre `ReorderSurface` e `ReorderHandle` uma vez ao iniciar o app Vue:

```ts
import { registerElement } from 'nativescript-vue'
import { ReorderSurface, ReorderHandle } from '@rafaelaugusto/jolt/reorder'

registerElement('ReorderSurface', () => ReorderSurface)
registerElement('ReorderHandle', () => ReorderHandle)
```

No componente, mantenha o array no estado do aplicativo:

```ts
import { ref, onUnmounted } from 'nativescript-vue'
import type { EventData, ListView } from '@nativescript/core'
import { reorder, type Reorder } from '@rafaelaugusto/jolt/reorder'

type Faixa = { id: string; title: string }
const faixas = ref<Faixa[]>(/* suas faixas */ [])
let ordenar: Reorder<string> | undefined

function loaded(event: EventData) {
  ordenar?.dispose()
  ordenar = reorder<Faixa, string>(event.object as ListView, {
    key: (faixa) => faixa.id,
    handle: 'dragHandle',
    onCommit({ key, beforeKey }) {
      const movida = faixas.value.find((faixa) => faixa.id === key)!
      const proxima = faixas.value.filter((faixa) => faixa.id !== key)
      const indice =
        beforeKey === null
          ? proxima.length
          : proxima.findIndex((faixa) => faixa.id === beforeKey)
      proxima.splice(indice, 0, movida)
      faixas.value = proxima
    },
  })
}
onUnmounted(() => ordenar?.dispose())
```

```vue
<ReorderSurface>
  <ListView :items="faixas" @loaded="loaded">
    <template #default="{ item }">
      <GridLayout columns="*,44" padding="12">
        <Label :text="item.title" textWrap="true" />
        <ReorderHandle
          id="dragHandle"
          col="1"
          text="☷"
          :accessibilityLabel="`Reordenar ${item.title}`"
        />
      </GridLayout>
    </template>
  </ListView>
</ReorderSurface>
```

Para definir uma altura por item, dimensione um contêiner interno como no demo; o Core controla a raiz da linha e redefine sua altura no Android quando `rowHeight` é automático. Alturas naturais calculadas pelo texto também funcionam.

As chaves devem ser strings ou números finitos únicos. Elas identificam os dados, não as views recicladas nem suas posições atuais. `onCommit` roda uma vez por soltura que muda a ordem e recebe `{ key, beforeKey, fromIndex, toIndex }`. `beforeKey: null` significa inserir no fim; os índices indicam a posição original e a posição final depois da remoção. O Jolt nunca reorganiza o array do aplicativo durante o movimento do dedo. Aplique a mudança sincronamente para um resultado imediato, ou mantenha a ordem para rejeitá-la.

Após confirmar uma mudança, o adaptador do Core resolve novamente a chave estável, torna a linha visível com rolagem nativa quando necessário (centralizada no iOS se estiver cortada na borda) e devolve o foco à alça. Isso acontece uma vez após a atualização dos dados, inclusive quando as alturas estimadas do iOS mudam.

## Cancelamento e alterações

Substituir `list.items`, ou receber `change` de uma fonte observável, cancela o arraste antes de confirmar um índice antigo. Remover a identidade arrastada informa `removed`; filtrar, substituir, inserir ou mudar conteúdo informa `data-changed`. Para **alterações no próprio array comum**, atualize a lista e chame `ordenar.refresh()`. Chame também ao mudar a geometria das linhas sem mudar os itens. As identidades são verificadas novamente antes de confirmar.

```ts
ordenar.cancel() // mantém a ordem do aplicativo
ordenar.pause() // cancela e desativa a entrada
ordenar.play() // reativa a entrada
ordenar.dispose() // restaura as células e remove entrada/ações nativas
```

Soltar na mesma posição não emite commit. `onStart(key)` e `onCancel({ key, reason })` são callbacks opcionais do ciclo de vida. Os motivos também incluem `cancelled`, `unchanged`, `unloaded`, `disposed`, `disabled` e `geometry-changed`. Sair da página, colocar o app em segundo plano, mudar o tamanho da área visível ou descartar libera a cópia e o trabalho por frame. O controlador sobrevive a unload/reload, conectando-se à nova lista nativa; `dispose()` é definitivo.

## Teclado e acessibilidade

As alças recebem ações nativas de **Subir** e **Descer**. Passe os textos traduzidos em `accessibility: { moveUp, moveDown }`. Um `ReorderHandle` com foco suporta **Option/Alt + ↑/↓**. O controlador também oferece `moveUp(key)`, `moveDown(key)` e `move(key, beforeKey)` para o app expor botões comuns acessíveis por teclado, sem exigir arraste. Eles seguem o mesmo contrato de commit e retornam `false` quando nada muda ou o item não existe.

As molas dos vizinhos e a transição ao soltar respeitam a configuração de Movimento Reduzido do Jolt. O acompanhamento direto do dedo e a rolagem nas bordas continuam disponíveis. Configure a ativação com `longPress` (150–2000 ms, padrão 350) e as bordas com `edge: { size, speed }` (padrões de 72 DIPs e 640 DIPs/segundo).

## O que é nativo e quais conteúdos são suportados

O acompanhamento do gesto, as cópias visuais, o deslocamento por molas e a rolagem nas bordas rodam em código UIKit/Android compilado. Decisões de ciclo de vida, alterações nos dados, movimentos por acessibilidade/teclado e a criação/binding normal de células do Core usam JavaScript. O Jolt não envia eventos de ponteiro/frame para JavaScript; isso **não** torna a interface imune a JavaScript bloqueando sua thread principal.

O suporte inicial cobre texto estático, imagens e contêineres comuns. A cópia é uma imagem parada: não use câmera, vídeo ou superfícies Metal ao vivo como prévias de arraste. O Jolt controla a translação e a opacidade do contêiner da linha durante a operação; coloque outras animações em uma view interna. Seções, cabeçalhos fixos e busca embutida são rejeitados. Grades, listas horizontais, arraste entre listas e plugins CollectionView de terceiros ficam fora deste adaptador.

`ReorderAdapter<T>` é o contrato para integrar outra lista: forneça `view`, `items()`, `subscribe(changed)` e `attach(config)`. O driver controla entrada nativa, geometria medida, duração da cópia, restauração das células recicladas e rolagem, emitindo apenas eventos de início/confirmação/cancelamento. Publicar um adaptador exige validar a reciclagem e a acessibilidade daquela lista; aceitar uma view qualquer não significa suportá-la.
