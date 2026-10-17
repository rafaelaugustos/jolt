# Aplicativo de demonstração

O app NativeScript-Vue em [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) usa o build local do Jolt. No iOS e no Android, ele abre um assistente com três telas:

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

`ns run android` abre o mesmo assistente. Os ícones vêm da fonte Material Icons no lugar dos SF Symbols, o sistema ajusta a janela para o teclado em vez de um observador de teclado, e a esfera mantém a respiração sem a deformação líquida.

O playground de animações abre com `--playground` no iOS e `--es playground true` no Android. Os dois têm todas as seções; o do iOS acrescenta os helpers exclusivos da plataforma.

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

Encerre o app antes de abrir com outros argumentos. Sem argumentos, o assistente começa na Home.

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
