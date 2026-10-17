# Aplicativo de demonstração

O app NativeScript-Vue em [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) usa o build local do Jolt. No iOS, ele abre um assistente com três telas:

- **Home:** saudação letra por letra, cartões de ferramentas com springs e botão de busca pulsando. Toque num cartão ou deslize pelo leque para mudar a seleção. A busca abre Voice.
- **Voice:** esfera flutuante, transcrição com stagger e controles de pausa e retomada. O microfone abre Chat.
- **Chat:** mensagens e cartões de documentos entram em etapas. Abra a prévia de um documento, alterne a prévia da onda de áudio ou envie uma mensagem. As mensagens enviadas ficam na memória ao trocar de tela.

Abra o botão de interrogação na Home e toque em **Watch demo** para reproduzir Voice → Chat → Home → Voice. Navegar, deslizar os cartões, enviar uma mensagem ou abrir uma prévia interrompe a reprodução.

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

No Android, `ns run android` abre o playground de animações, incluindo a seção de entrada de texto. No iOS, o playground tem as mesmas seções e os helpers exclusivos da plataforma.

Com o build instalado no simulador iOS, passe um argumento ao abrir o app:

```sh
xcrun simctl launch booted org.nativescript.jolt --autoplay
xcrun simctl launch booted org.nativescript.jolt --screen=voice
xcrun simctl launch booted org.nativescript.jolt --screen=chat
xcrun simctl launch booted org.nativescript.jolt --playground
```

Encerre o app antes de abrir com outros argumentos. Sem argumentos, o assistente começa na Home.

## Movimento

O assistente usa as APIs públicas do Jolt: `animate()` para transformações e opacidade, `animateText()` para a saudação e a transcrição e `press()` para feedback de toque. Os cartões encaixam ao soltar o gesto; o progresso da animação não acompanha o dedo.

Cada tela cuida dos seus handles de animação, temporizadores de etapas e vínculos de toque. Desmontar a tela ou colocar o app em segundo plano cancela esse trabalho. Ao voltar, o app reconstrói a tela atual. Com Reduzir Movimento, o texto aparece imediatamente, os deslocamentos são removidos e os loops decorativos ficam desativados. Alterar essa opção atualiza a tela atual.

## Conteúdo de exemplo

Esta é uma demo local de interface. Ela não grava voz, busca arquivos, reproduz áudio nem acessa um serviço. As prévias de documentos e a onda de áudio de 37 segundos são simuladas. As mensagens digitadas duram apenas durante a sessão do app.

A esfera usa uma única imagem transparente. [`liquid()`](./liquid) deforma sua textura com uma malha animada nativa, enquanto `animate()` controla escala, rotação, posição e opacidade. A pausa congela os dois movimentos. As dobras coloridas vêm da arte; o efeito deforma a textura, sem simular um fluido.

O playground também inclui [controles de reprodução](./playback): pause um card, escolha o frame no slider e continue, com um pulso independente ao lado.

O [cabeçalho ligado ao scroll](./scroll-linked) se move e desaparece conforme o ScrollView principal avança, revelando um título compacto fixo. Voltar o scroll restaura o cabeçalho.

A seção Keyboard mostra um campo de mensagem preso ao rodapé do playground; [`followKeyboard()`](./keyboard) o ergue junto com o teclado virtual e o devolve ao lugar quando o teclado some.

A [demo de timelines](./sequences) compara entradas sobrepostas, chegadas uma a uma e tempos fixos, com controles para repetir e parar.

A [demo de linhas de lista](./lists) rola sessenta linhas que aparecem com fade, com um botão para animar cada item só uma vez e outro que troca os itens por novos.

O [playground de paths](./paths) segue uma curva cúbica ou uma órbita com arcos, com orientação, repetição, pausa/continuação e parada.
