# Aplicativo de demonstração

O app NativeScript-Vue em [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) usa o build local do Jolt. A abertura normal entra no **Jolt Motion Studio**: splash animado da marca, home em movimento e coleção pesquisável de 67 experimentos, organizados em Motion, Touch, Visual, Type, Layout, State e SceneKit.

<Clip name="showcase-splash-ios" caption="Abertura real no simulador iOS 26: a tela do sistema dá lugar ao splash animado nativo da marca e ao Studio. Captura sem a sincronização de abertura do XCTest; velocidade original. Não comprova desempenho em aparelho físico." />

<Clip name="showcase-ios" caption="Gravação real no simulador iOS 26: springs, gestos nativos, filtros, busca, reprodução SceneKit e navegação de volta. Interações reais do XCTest, sem mudar a velocidade. A reabertura e o ícone instalado também são verificados fora deste vídeo." />

O [Vue Router NS](https://vue-router-ns.rafaelaugusto.dev/guide/splash) conduz home, coleção e exemplos usando pilhas nativas de páginas. Voltar preserva a busca e o filtro da coleção. A primeira página monta por baixo do splash, que não entra no histórico. O Jolt anima logo, nome e saída, pulando essas animações com Movimento Reduzido. A tela de abertura do sistema no iOS usa o mesmo fundo sólido antes de o JavaScript iniciar.

As animações da home param ao sair da página. Cada detalhe monta apenas o experimento escolhido e o libera ao sair. Controles de tempo do exemplo voltam ao padrão ao deixar o detalhe; experimentos exclusivos do SceneKit mostram uma mensagem de disponibilidade no Android. Esta gravação valida a nova apresentação no iOS; não representa validação nativa no Android.

Os recursos iOS agora ficam no repositório, incluindo o nome **Jolt** e o ícone. Abrir pelo ícone instalado entra no Studio sem argumentos especiais. Este preview requer Core 9.1.3+ e instala `vue-router-ns@0.1.0-rc.2`.

## Claro, escuro ou o tema do dispositivo

Toque em **◐** no cabeçalho do Studio para escolher **Claro**, **Escuro** ou **Sistema**. A escolha atualiza imediatamente a abertura, o Studio, a coleção, a busca, a página de idioma e os controles dos exemplos, e fica salva depois de fechar o app. **Sistema** acompanha a aparência do dispositivo, inclusive quando ela muda com o app aberto.

No iOS, o reveal circular do Jolt abre o novo tema a partir do controle escolhido, mantendo a aparência anterior por baixo. Mudanças do sistema usam o centro da página visível. Com Reduzir Movimento, o tema final é aplicado imediatamente; no Android, a troca também é imediata porque o reveal circular é exclusivo do iOS.

As ilustrações e os palcos das animações mantêm suas próprias paletas; mudar o tema da interface não reinicia um exemplo em execução nem altera suas configurações de animação.

<Clip name="showcase-appearance-ios" caption="Simulador iOS 26.2: toques reais via XCTest revelam claro → escuro a partir do controle escolhido, navegam e buscam na coleção, interagem com as molas, voltam ao claro e acompanham mudanças de aparência do sistema ao vivo. Velocidade original. Verificações nativas adicionais validam persistência após reabrir o app e textos em português. Não representa validação no Android ou em aparelho físico." />

## Idioma

O Studio segue o idioma do celular por padrão: português usa a tradução brasileira, variantes de espanhol usam espanhol e variantes de chinês usam chinês simplificado; idiomas não suportados usam inglês. Toque em **Idioma** no topo do Studio para escolher **Idioma do celular**, **English**, **Português**, **Español** ou **简体中文**. A mudança acontece na hora e a escolha permanece depois de fechar o app. **Idioma do celular** remove a preferência manual; o app consulta novamente o idioma ao voltar ao primeiro plano.

Splash, coleção, apresentação dos 67 experimentos, controles, mensagens de estado e rótulos de acessibilidade estão traduzidos. A busca aceita nomes no idioma selecionado ou em inglês, com ou sem acento. Os números da conta usam os separadores do idioma escolhido. Identificadores das APIs, como `popIn`, continuam iguais; o playground técnico isolado mantém seus textos de teste em inglês.

<Clip name="showcase-language-ios" caption="Simulador iOS 26: toques reais do XCTest trocam inglês → português, buscam camera sem acento, operam a lente nativa e voltam ao inglês. Tempo original. Testes nativos separados verificam persistência e seleção automática com os ajustes de idioma preferido do iOS na abertura; não validam Android nem aparelho físico." />

<Clip name="showcase-portuguese-ios" caption="As 54 entradas da coleção em português brasileiro no simulador iOS 26, com interações nativas representativas. Montagem de capturas separadas na velocidade original, incluindo o carro local opcional. Nem todos os controles técnicos são exercitados." />

<Clip name="showcase-splash-pt-ios" caption="Abertura real em português no simulador iOS 26, incluindo splash animado e Studio traduzido. Tempo original; captura separada da sincronização inicial do XCTest." />

## Telas do Motion Studio

Cada exemplo agora tem uma composição interativa: playlist para stagger, conta para os números, toca-discos para drag values, cartões táteis para press e sinais coordenados para bindings. Os quatro exemplos automotivos mantêm o estúdio SceneKit. O showcase oferece os controles principais; o playground isolado continua com os probes e opções técnicas detalhadas.

O splash abre com anéis em expansão, um detalhe em órbita, a marca Jolt e a entrada do nome antes de revelar o Studio. Ele respeita Movimento Reduzido e aguarda a rota inicial. As imagens da galeria e do cartão de gestos são artes editoriais geradas e incluídas no app; os testes de imagem preservam seus quadriculados originais. São demonstrações de movimento, sem serviço bancário, música ou viagem.

<div class="clips">
<Clip name="showcase-springs-ios" caption="Simulador iOS 26: toques interrompem a mola e transferem o movimento para outra resposta. Tempo original." />
<Clip name="showcase-presets-ios" caption="Simulador iOS 26: pop, shake, bounce e pulse no pôster nativo. Toques reais; tempo original." />
<Clip name="showcase-colors-ios" caption="Simulador iOS 26: fundo, letras e borda interpolam entre três paletas. Tempo original." />
<Clip name="showcase-forms-ios" caption="Simulador iOS 26: cantos, borda, rotação e sombra, incluindo parada durante a transição. Tempo original." />
</div>

As montagens abaixo unem capturas nativas separadas entre exemplos. Todas as interações usam entrada real do XCTest no simulador iOS 26, mantendo o tempo original. Não comprovam desempenho em aparelho físico nem comportamento no Android.

<Clip name="showcase-motion-ios" caption="Momentum, stagger, trajetórias, timelines, playback, loops, pausas, tempo orgânico, easing e configurações de movimento. O exemplo de configurações seleciona explicitamente meia velocidade e Movimento Reduzido." />
<Clip name="showcase-touch-ios" caption="Pressionar e segurar, molas encadeadas, folha musical arrastável, pedidos de háptica, gestos na foto, carrossel/scroll, drag/snap e compositor que acompanha o teclado. O simulador mostra pedidos de háptica, sem comprovar vibração física." />
<Clip name="showcase-visual-ios" caption="Gradientes linear/radial/conic, atmosferas e valores reativos, shimmer, partículas, loaders, reveals, fade/overflow e rastros de luz. Reveal seleciona 1600 ms; os rastros selecionam explicitamente a câmera lenta do app." />
<Clip name="showcase-type-ios" caption="Letras e palavras animadas, valores rolando, mudanças na quantidade de dígitos e tamanho da fonte, e efeitos nativos de SF Symbols." />
<Clip name="showcase-layout-ios" caption="Inserir, reordenar e redimensionar cartões, dimensões reais, remontagem, linhas animadas e cabeçalho de álbum ligado ao scroll nativo." />
<Clip name="showcase-state-ios" caption="Folha e fundo coordenados, observadores, camadas de valores e movimentos, estados de envio, transições por alvo, diretivas Vue e comparação de molas. Busy JavaScript exibe somente sua disponibilidade no Android." />
<Clip name="showcase-images-ios" caption="Ripple e dissolve reais nas artes incluídas no app, seguidos de zoom nativo e reset. Simulador iOS 26; tempo original." />

### Estúdio automotivo · iOS

Os três experimentos SceneKit compartilham um estúdio com reflexos. **Camera lens** anima o campo de visão sem mover a câmera. **Lights & materials** muda iluminação e pintura. **Environment & shaders** liga um motion value à intensidade do ambiente, à luz principal, a um uniform de aparência do vidro e à cor dos faróis. São adaptadores nativos do Jolt; JavaScript escolhe o destino e troca a imagem do ambiente no toque, sem observador atualizando propriedades SceneKit a cada frame.

<div class="clips">
<Clip name="showcase-atelier-ios" caption="Simulador iOS 26: transições de lente, seek até a metade, retomada e mudança de pintura. Renderização SceneKit nativa e interação real do XCTest; modelo detalhado local; velocidade original." />
<Clip name="showcase-lighting-ios" caption="Simulador iOS 26: luz diurna, estúdio quente, pintura cobre e iluminação noturna. Modelo detalhado local; velocidade original." />
<Clip name="showcase-shaders-ios" caption="Simulador iOS 26: ambiente e uniforms dos shaders do vidro e dos faróis dirigidos por um motion value compartilhado. Modelo detalhado local; velocidade original. Demonstra aparência, não o interior da cabine nem simulação de fluidos." />
</div>

**Maps & 3D → Timeline** percorre uma rota curva em uma orla ilustrada. A viagem, o pulso do destino, o progresso e o checkpoint atrasado compartilham a timeline e pausam juntos. A aba Native map continua animando o adaptador do mapa real.

<Clip name="showcase-journey-ios" caption="Simulador iOS 26: nova viagem coordenada, pausa/retomada, mapa nativo e retorno à câmera automotiva. Entrada real do XCTest; tempo original; o carro usa o modelo local opcional." />

**Maps & 3D → 3D camera** usa o mesmo estúdio automotivo no Motion Studio. O adaptador nativo de pose move a câmera entre dois ângulos do carro, com pausa, retomada, parada e replay. Trocar de aba zera o progresso exibido e recria os bindings da cena ao voltar.

<Clip name="showcase-camera-orbit-ios" caption="Simulador iOS 26: a aba real de câmera em Maps & 3D, movendo ao redor do carro detalhado, pausando/retomando, repetindo, parando e voltando de Timeline. Toques reais do XCTest; velocidade original; modelo local opcional. Não comprova desempenho em aparelho físico." />

<Clip name="showcase-native-reentry-ios" caption="Simulador iOS 26: abertura e reabertura das quatro entradas automotivas na mesma sessão do app. Cada retorno monta o estúdio nativo novamente, incluindo a aba 3D camera. Navegação real do XCTest; modelo detalhado local; velocidade original." />

O carro detalhado das gravações é um recurso local do projeto separado `jolt-car`. Ele **não é distribuído neste repositório** enquanto sua origem e os termos de redistribuição não estiverem registrados. Para usar localmente um modelo autorizado com os mesmos materiais, coloque-o em `demo/App_Resources/iOS/preview-car.usdz`; sem ele, o demo usa um carro procedural. O ambiente do estúdio é desenhado em código. Estes vídeos de simulador não comprovam desempenho em aparelho físico.

## Exemplo do assistente

O assistente anterior continua disponível com `--screen=home` no iOS ou `--es screen home` no Android. Ele tem três telas:

<div class="clips">
<Clip name="assistant-flow" caption="O assistente repetindo o fluxo no simulador iOS." />
<Clip name="assistant-flow-android" caption="O mesmo fluxo no emulador Android." />
</div>

<div class="clips">
<Clip name="assistant-chat" caption="O balão de áudio em contagem regressiva com rollTo() no iOS." />
<Clip name="assistant-chat-android" caption="A contagem regressiva no Android." />
</div>

- **Home:** saudação letra por letra, cartões de ferramentas com springs e botão de busca pulsando. Toque num cartão ou deslize pelo leque para mudar a seleção. A busca abre Voice.
- **Voice:** esfera flutuante, transcrição com stagger e controles de pausa e retomada. O microfone abre Chat.
- **Chat:** mensagens e cartões de documentos entram em etapas. Abra a prévia de um documento, toque a prévia da onda de áudio e veja o tempo rolar segundo a segundo, ou envie uma mensagem. As mensagens enviadas ficam na memória ao trocar de tela.

As telas trocam com um cross-fade curto, uma saindo antes de a próxima entrar. Abra o botão de interrogação na Home e toque em **Watch demo** para reproduzir Voice → Chat → Home → Voice. Navegar, deslizar os cartões, enviar uma mensagem ou abrir uma prévia interrompe a reprodução.

## Executar

Instale o [NativeScript CLI](https://docs.nativescript.org/setup/) e execute:

```sh
# Raiz do repositório, em um terminal
npm install
npm run dev

# Em outro terminal
cd demo
npm install
ns run ios
```

`ns run android` abre a coleção. No exemplo do assistente, os ícones vêm da fonte Material Icons no lugar dos SF Symbols, o sistema ajusta a janela para o teclado em vez de um observador de teclado, e a esfera mantém a respiração sem a deformação líquida.

O playground de animações abre com `--playground` no iOS e `--es playground true` no Android. Essa entrada preserva a galeria anterior em uma página para gravações e probes; aberturas normais usam o Motion Studio.

Abra **Image effects and photo zoom** no playground para testar ripple, distorção, dissolve e o viewer de fotos. Para abrir diretamente, use `--image-lab=effects` ou `--image-lab=zoom` no iOS; no Android, `--es image-lab effects` ou `--es image-lab zoom`. A grade colorida e o canto transparente do destino ajudam a conferir deformação, recorte e alpha. O viewer inclui botões acessíveis de zoom/reset/fechar, cancelamento e reanexação.

Com o build instalado no simulador iOS, passe um argumento ao abrir o app:

```sh
xcrun simctl launch booted org.nativescript.jolt --autoplay
xcrun simctl launch booted org.nativescript.jolt --screen=voice
xcrun simctl launch booted org.nativescript.jolt --screen=chat
xcrun simctl launch booted org.nativescript.jolt --playground
```

No Android os mesmos nomes entram como extras de texto da intent inicial:

```sh
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es autoplay true
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es screen chat
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es playground true
```

Encerre o app antes de abrir com outros argumentos. Sem argumentos, o app abre o Motion Studio. Use `--screen=home` para o assistente.

Mais dois argumentos ajudam uma revisão ou uma gravação a chegar a um ponto sem tocar na tela. `--tap=<texto>[,<texto>...]` funciona nos dois demos: dispara o toque da primeira view cujo texto ou rótulo de acessibilidade é igual a cada item, subindo até o ancestral mais próximo com um handler de toque, um a cada `--every` milissegundos (1200 por padrão). `--section=<título>` é do playground e rola até a primeira seção cujo título começa com esse texto, sem diferenciar maiúsculas:

```sh
xcrun simctl launch booted org.nativescript.jolt --playground --section=text --tap=Letters
xcrun simctl launch booted org.nativescript.jolt --playground --section=rolling "--tap=+ 1.10,Random" --every=2000
xcrun simctl launch booted org.nativescript.jolt --screen=home "--tap=Help,Watch demo" --every=2000
```

A forma Android acrescenta `playground`:

```sh
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es playground true --es section text --es tap Letters
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es tap "Help,Watch demo"
```

## Movimento

O assistente usa as APIs públicas do Jolt: `animate()` para transformações e opacidade, `animateText()` para a saudação e a transcrição, [`rollTo()`](./rolling) para a contagem regressiva do áudio e a [entrada Vue](./vue) para o resto: `v-press` em todos os botões e `JoltTransition` nas trocas de tela (`mode="out-in"`) e na folha de documento, que some com fade antes de o Vue removê-la. Os cartões encaixam ao soltar o gesto; o progresso da animação não acompanha o dedo.

Cada tela cuida dos seus handles de animação e temporizadores de etapas. Desmontar a tela ou colocar o app em segundo plano cancela esse trabalho. Ao voltar, o app reconstrói a tela atual. Reduzir Movimento fica por conta do Jolt, pelo padrão [`reducedMotion: 'user'`](./configure): o texto aparece imediatamente, as transformações pulam e os fades continuam. A demo só acrescenta decisões de conteúdo: mostra o chat em etapas de uma vez e pula os loops decorativos. Alterar essa opção atualiza a tela atual.

## Conteúdo de exemplo

Esta é uma demo local de interface. Ela não grava voz, busca arquivos, reproduz áudio nem acessa um serviço. As prévias de documentos e a onda de áudio de 37 segundos são simuladas. As mensagens digitadas duram apenas durante a sessão do app.

A esfera usa uma única imagem transparente. No iOS, [`liquid()`](./liquid) deforma sua textura com uma malha animada nativa, enquanto `animate()` controla escala, rotação, posição e opacidade; no Android só o movimento do `animate()` toca. A pausa congela os dois movimentos. As dobras coloridas vêm da arte; o efeito deforma a textura, sem simular um fluido.

Os ícones do iOS são SF Symbols. No Android, `Icon.vue` desenha o glifo equivalente da fonte Material Icons, empacotada com a demo (licença Apache 2.0).

A seção de ajustes no topo do playground define a [escala de tempo e a preferência de redução de movimento](./configure) globais, para ver todas as seções abaixo em câmera lenta ou com as transformações pulando direto para o fim.

O playground também inclui [controles de reprodução](./playback): pause um card, escolha o frame no slider e continue, com um pulso independente ao lado.

O [cabeçalho ligado ao scroll](./scroll-linked) se move e desaparece conforme o ScrollView principal avança, revelando um título compacto fixo. Voltar o scroll restaura o cabeçalho.

A seção Keyboard mostra um campo de mensagem preso ao rodapé do playground; [`followKeyboard()`](./keyboard) o ergue junto com o teclado virtual e o devolve ao lugar quando o teclado some.

A [demo de timelines](./sequences) compara entradas sobrepostas, chegadas uma a uma e tempos fixos, com controles para repetir e parar.

A [demo de linhas de lista](./lists) rola sessenta linhas que aparecem com fade, com um botão para animar cada item só uma vez e outro que troca os itens por novos.

O [playground de paths](./paths) segue uma curva cúbica ou uma órbita com arcos, com orientação, repetição, pausa/continuação e parada.

<Clip name="reorder-pt-ios" caption="Novo neste checkout: o 55º experimento, reordenação de listas, em português no simulador iOS. Arraste real, deslocamento nativo das linhas e alternativa por botões." />

[Layouts compartilhados](./shared-layout) é o experimento 56 deste checkout: indicador de abas e capa de álbum atravessando árvores de views diferentes.

[Replay de interações](./interaction-replay) é o experimento 57: grave um spring ou drag cancelado, aceite uma referência fixa do motor, reproduza no probe nativo e detecte um checkpoint propositalmente errado.

[Precisão das curvas](./transitions#keyframes-adaptativos) é o experimento 58: compare o playback nativo adaptativo com o de taxa fixa, veja a quantidade de pontos e execute as verificações de precisão nativa.

[Inspetor de movimento](./motion-inspector) é o experimento 59: selecione sem alterar a view, compare observações nativas, identifique os donos das propriedades, ajuste/reproduza uma spring e copie TypeScript.

[Navegação compartilhada](./shared-navigation) é o experimento 60: abra uma foto ou um card em outra rota e volte à origem atual com animação nativa do Jolt.

[Navegação interativa](./interactive-navigation) é o experimento 61: espiar com um gesto pela borda, cancelar e confirmar a volta no iOS.

[Voltar com prévia](./predictive-back) é o experimento 62: progresso nativo pela borda no Android, cancelamento, volta com guard e uma cena bilíngue ao entardecer.

[Gestos compartilhados](./shared-gestures) é o experimento 63: imagem e cartão acompanham o gesto nativo de voltar, com cancelamento e botão acessível.

<Clip name="showcase-languages-ios" caption="Simulador iOS 26.2: toques reais selecionam espanhol e chinês simplificado, abrem a coleção traduzida e a composição de rolagem nativa e retornam ao seletor. Testes separados cobrem persistência e seleção pelo idioma do celular. Velocidade original; não representa aparelho físico." />
