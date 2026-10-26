# Layouts compartilhados na mesma página

Uma capa pode sair do mini player e virar a capa expandida. O indicador da aba selecionada pode mudar entre pais diferentes. **sharedLayout()** conecta essas views por identidade, captura a apresentação atual e move uma imagem nativa temporária até o novo layout.

Disponível desde a **0.1.0-beta.18**, no pacote principal. Instale `@rafaelaugusto/jolt@0.1.0-rc.1` e recompile o app nativo para instalar as classes de captura e renderização. Não exige o plugin opcional de propriedades nativas.

<Clip name="shared-layout-ios" caption="Interação real no simulador iOS: indicador de abas mudando entre pais, capa do mini player expandindo e retornando, e inversão rápida a partir da imagem atual. Velocidade original." />

<Clip name="shared-layout-android" caption="Identidades compartilhadas no emulador Android, com toques reais do SO e playback nativo das capturas. Não é uma medição de desempenho em aparelho físico." />

## Capture antes de mudar a árvore

Crie um controlador para um contêiner e registre views descendentes carregadas com chaves string estáveis:

```ts
import { sharedLayout } from '@rafaelaugusto/jolt/shared-layout'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const shared = scope.add(sharedLayout(pageContent, { transition: 'smooth' }))

const detach = shared.attach(collapsedCover, 'cover', {
  content: 'image',
  radius: 12,
})

const flight = shared.transition(() => {
  // Substitua a árvore sincronamente e registre a nova view com a mesma chave.
  replaceMiniPlayerWithExpandedPlayer()
  shared.attach(expandedCover, 'cover', { content: 'image', radius: 24 })
})
const result = await flight.finished
```

No Vue, a mutação pode atualizar um ref e o handler loaded pode registrar a view de destino. O Jolt espera a atualização enfileirada do Vue e o próximo layout nativo antes de medir o destino. O [exemplo completo](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/components/SharedLayoutLab.vue) também trata a ordem inicial dos eventos de carregamento.

A mutação deve ser síncrona. Carregue os dados antes. O prazo padrão para layout é 500 ms; **layoutTimeout** aceita um valor positivo até 10.000 ms. Destinos ausentes ou não medidos encerram com fallback e liberam todas as capturas.

Uma identidade tem uma view atual. Registros duplicados fora de uma transição geram erro. Durante a preparação, uma nova view pode substituir a origem capturada com a mesma chave. Remover a origem após a captura é suportado; unload remove seu registro automaticamente. Um callback de descarte antigo não remove a substituta. As identidades devem pertencer à subárvore do controlador e não podem se sobrepor.

## Conteúdo e geometria

Posição, largura, altura e recorte uniforme dos cantos usam coordenadas nativas da janela. Escalas positivas uniformes, translações dos ancestrais, offsets de scroll, safe areas e densidade Android entram na conversão.

- **content: 'image'** escala cada captura uniformemente para preencher o recorte móvel e faz crossfade para a captura do destino.
- **content: 'container'** é o padrão. As capturas mantêm seu tamanho de conteúdo e fazem crossfade dentro do recorte variável, sem esticar texto.
- **radius** aceita um valor finito não negativo em DIPs. Quando omitido, usa o borderRadius uniforme numérico da view.

O conteúdo fica congelado durante o playback. Textos ou imagens atualizados ficam vivos ao terminar. As réplicas temporárias não recebem toque nem foco de acessibilidade. As views originais ficam ocultas e são restauradas uma vez ao terminar. Mantenha controles de inversão fora das subárvores registradas e evite alterar sua visibilidade nativa separadamente durante o percurso.

## Interrupção e limpeza

Uma nova transição captura a composição atual antes de mudar a árvore novamente. Posição e velocidade nativas inicializam as novas tracks de geometria. O handle anterior resolve como cancelado com motivo **interrupted**.

```ts
flight.cancel() // stop() é um alias
shared.cancel()
shared.pause() // cancela e rejeita novas transições
shared.play()
shared.dispose()
```

Cancelar revela o layout atual do aplicativo; não desfaz a mutação do app. Mudanças de geometria do destino, rotação/redimensionamento, unload do contêiner e background cancelam a transição. A redução de movimento aplica a mutação sem imagem móvel; ativá-la durante o playback cancela o percurso. Um motion scope assume limpeza e suspensão via pause/play.

A promise finished resolve como **completed**, **cancelled** ou **unavailable**, com motivo nos dois últimos casos. Os motivos incluem interrupção, cancelamento explícito, mudança de geometria, suspensão, endpoints ausentes, captura sem suporte, redução de movimento e prazo de layout. Uma captura sem suporte aplica a mudança normal do app, sem fallback com loop JavaScript por frame.

## Caso inicial suportado

Imagens estáticas e contêineres simples na mesma página/janela são suportados. [Transições de navegação](https://github.com/rafaelaugustos/jolt/issues/24) e [animação de layout](./layout) dos filhos diretos são APIs separadas.

Ancestrais translúcidos, views de blur/efeito nativo, ancestrais rotacionados, inclinados, em perspectiva ou com escala negativa ou não uniforme, endpoints parcialmente cortados/fora da tela, contêineres de scroll/lista como conteúdo capturado, WebViews, vídeo, câmera e superfícies de GPU usam o caminho de indisponibilidade. Resolva os endpoints para views totalmente visíveis e alinhadas aos eixos. Não há promessa de interpolação arbitrária de crop nem superfícies ao vivo.

É possível registrar até oito identidades. **maxSnapshotPixels** usa 8.000.000 pixels por padrão, cerca de 32 MB de capturas RGBA adicionais, incluindo capturas temporárias de inversão. Aceita até 32.000.000. Exceder o orçamento usa o fallback de layout normal. O limite exclui imagens já mantidas pelo app.

## Execução

JavaScript cuida do registro, da mutação do app, da coordenação de layout, da amostragem das curvas e dos callbacks terminais. O código compilado iOS/Android captura/desenha imagens, avalia as tracks, verifica a geometria do destino e controla o clock. O playback não chama JavaScript a cada frame.

Os callbacks nativos ainda compartilham a thread de UI com o NativeScript; bloquear essa thread pode atrasar o playback. Cada captura ou inversão tem um custo pontual de preparação na thread de UI.

A implementação usa uma view UIKit ligada à janela e o [ViewGroupOverlay](https://developer.android.com/reference/android/view/ViewGroupOverlay) do Android. A captura de origem no iOS consulta a [presentation layer](<https://developer.apple.com/documentation/quartzcore/calayer/presentation()>) quando disponível.

<Clip name="shared-layout-pt-ios" caption="Preview integrado em português brasileiro no simulador iOS: troca de aba, player expandido e reversão rápida. Toques reais do sistema, na velocidade original." />
