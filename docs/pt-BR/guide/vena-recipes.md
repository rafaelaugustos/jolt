# Receitas de movimento do Vena

Um coração feito de luz. Duzentos mil pontos formam um corpo que reage, pulsa e convida você a chegar mais perto.

Criado por Rafael Augusto com NativeScript-Vue e Jolt RC.11. O SceneKit desenha 160 mil pontos do torso e 40 mil do coração, com uma camada extra de brilho. O Jolt controla uniforms dos shaders, foco e movimento da interface. A cena de partículas é exclusiva do iOS. Ritmos de exemplo; sem medição cardíaca ou conexão com HealthKit.

[Explore as duas receitas](/pt-BR/recipes/?q=Vena) · [Ver o projeto](https://github.com/rafaelaugustos/vena-ns)

<Clip name="vena-native-ios" :autoplay="false" poster="/media/vena-native-ios.jpg" :width="320" caption="Vena no iOS: gravação enviada pelo criador, com interface em inglês, abertura, coração de partículas, coleção de ritmos e foco no coração. Velocidade original, exportação a 60 fps, sem áudio; os primeiros 3,25 segundos da tela inicial e abertura do sistema foram omitidos. Dispositivo não informado; não é medição de desempenho. Leituras de BPM ilustrativas." />

## Um ritmo só seu. {#opening}

[Um ritmo só seu.](/pt-BR/recipes/vena-opening) · [GitHub](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/motion/entrance.ts)

opening coordena título, legenda, opção de pular e strokeEnd de um sinal vetorial. revealInterface traz cabeçalho, card, rodapé e dica em uma timeline. WelcomeOverlay espera as views carregarem, ignora conclusão após descarte e permite pular. A formação do coração é coordenada separadamente em App.vue. O vídeo mostra a abertura normal; movimento reduzido e descarte são descritos a partir do código.

NativeScript-Vue 3 e Jolt RC.11. Chame opening com quatro views nativas carregadas; title, caption e skip começam com opacity 0. rule recebe um traçado de 190×30. WelcomeOverlay.vue mostra a proteção ao concluir/pular e o descarte. revealInterface recebe um MotionScope próprio e quatro views montadas. Descarte o handle de opening e o scope da interface ao sair. Este arquivo anima texto, traçado e entrada da interface; o coração de partículas depende de HeartScene e seus assets. Preserve movimento reduzido. A gravação é iOS.

## Um coração feito de luz. {#heart}

[Um coração feito de luz.](/pt-BR/recipes/vena-heart) · [GitHub](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/scene-view.ios.ts)

Um motionValue repete de 0 a 1 em 60000 / bpm milissegundos e se vincula ao uniform beat. Valores separados de ripple e heartTap mantêm as ondas de toque independentes do ritmo automático. Springs animam foco, posição do ponteiro e órbita. O shader da GPU deforma a nuvem; o JavaScript não atualiza cada ponto a cada frame. O vídeo mostra pulsação e mudanças de foco. Suspensão/retorno, movimento reduzido e configuração do helper de ponteiro foram revisados no código, sem testes específicos no vídeo.

Somente iOS: NativeScript-Vue 3, Jolt RC.11, seu pacote nativo e SceneKit. A classe HeartScene depende de shaders.ts, anatomy.ts, cloud-data.ts, heart-space.ts, pointer.ios.ts, simulator-pointer.ios.ts e torso.bin/heart.bin. Veja o repositório fixado para registro da view e conexão de sceneReady. O Jolt controla uniforms float/float2/float3; o SceneKit renderiza a nuvem. Preserve hit testing na pose animada, relógios separados de pulsação/toque, condições de renderização, movimento reduzido, suspensão/retorno, remoção de listeners e descarte de propriedades/scopes. Hover no simulador usa um helper Swift de desenvolvimento; não é toque no celular. Preserve os créditos BodyParts3D © DBCLS CC BY 4.0 e MakeHuman CC0. Esta receita não fornece renderizador Android ou Web.

## Código e integração

- [src/App.vue](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/App.vue)
- [src/components/WelcomeOverlay.vue](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/components/WelcomeOverlay.vue)
- [src/scene/shaders.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/shaders.ts)
- [src/scene/anatomy.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/anatomy.ts)
- [src/scene/cloud-data.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/cloud-data.ts)
- [src/scene/heart-space.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/heart-space.ts)
- [src/scene/pointer.ios.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/pointer.ios.ts)
- [src/scene/simulator-pointer.ios.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/simulator-pointer.ios.ts)
- [src/assets/anatomy](https://github.com/rafaelaugustos/vena-ns/tree/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/assets/anatomy)
- [README.md](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/README.md)

## Créditos {#credits}

Coração: BodyParts3D © The Database Center for Life Science (DBCLS), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), preparado pelo OrganUI. O Vena amostrou o exterior em 40 mil pontos, omitiu cavidades, alterou escala, posição e cores e adicionou deformação e iluminação artísticas. Torso: MakeHuman hm08, CC0; posicionado, recortado e amostrado em 160 mil pontos. O site corta e comprime a gravação e recorta frames; não modifica os assets anatômicos. [Créditos completos, fontes e alterações](/media/vena-attribution.txt). O DBCLS não endossa esta demo.

## O site em movimento

<Clip name="vena-site-chromium" :width="960" caption="Chromium no macOS arm64: movimento por rolagem do destaque Vena, reprodução nativa, showcase e duas receitas com cópia de código e prompt. Gravação do navegador em velocidade original; o vídeo iOS incorporado foi enviado pelo criador, em inglês, com dispositivo não informado. A lista da comunidade usa uma resposta local vazia na revisão." />
