---
pageClass: showcase-page
sidebar: false
aside: false
prev: false
next: false
---

<div class="showcase-intro">
  <p class="showcase-kicker">FEITO COM JOLT</p>

# Pequenos detalhes. Apps que impressionam.

Explore o movimento em apps nativos feitos com Jolt. Veja as gravações, descubra os recursos e compartilhe o que você criou.

<a class="showcase-submit-link" href="#submit-app">Envie seu app <span aria-hidden="true">↗</span></a>
</div>

<section class="showcase-feature" aria-labelledby="morrow">
  <div class="showcase-copy">
    <p class="showcase-kicker">PROJETO EM DESTAQUE <span class="showcase-platform">iOS · NativeScript + Jolt</span></p>
    <h2 id="morrow">Morrow<span>.</span></h2>
    <p class="showcase-lead">Música para sentir. Um player em vinil que responde ao toque, uma página de artista cheia de expressão e uma transição para vídeo.</p>
    <p class="showcase-note">Criado por Rafael Augusto com NativeScript e Jolt. O criador enviou esta gravação do aplicativo real. Dispositivo de captura e disponibilidade pública não informados.</p>
  </div>
  <div class="showcase-stage showcase-morrow-stage">
    <Clip name="morrow-native-ios" :width="280" caption="Morrow no iOS: gravação enviada pelo criador com abertura animada, página da artista, player em vinil, busca na faixa e transição para vídeo. Tempo original, codificado a 60 fps; os primeiros 2,4 segundos da tela inicial do sistema foram removidos. Dispositivo não informado; não é medição de desempenho em aparelho físico." />
  </div>
</section>

<section class="showcase-feature" aria-labelledby="jolt-drive">
  <div class="showcase-copy">
    <p class="showcase-kicker">EM DESTAQUE <span class="showcase-platform">iOS · SceneKit</span></p>
    <span id="jolt-car" aria-hidden="true"></span>
    <h2 id="jolt-drive">Jolt Drive<span>.</span></h2>
    <p class="showcase-lead">Uma garagem em que dá para entrar. Gire o carro, explore a cabine e sinta cada controle responder.</p>
    <ul class="showcase-points">
      <li><a href="./rolling">Números rolando</a> para as milhas e a porcentagem.</li>
      <li>Câmera <a href="./scene-camera">SceneKit</a> para o carro, a cabine e a rua.</li>
      <li><a href="./press">Press</a> e springs nos controles.</li>
    </ul>
    <p class="showcase-note">Criado por Rafael Augusto com NativeScript-Vue, Jolt e Vue Router NS. Garagem em SceneKit, controles nativos e trajeto em MapKit. Bateria, clima e busca são simulados; o app não se conecta a um veículo real.</p>
    <div class="showcase-project-links"><a href="https://github.com/rafaelaugustos/jolt-drive">Ver no GitHub ↗</a><a href="https://github.com/rafaelaugustos/jolt-drive#run-it">Rodar o projeto ↗</a></div>
  </div>
  <div class="showcase-stage">
  <Clip name="jolt-drive-entrance-ios" :width="280" caption="Jolt Drive no iOS: entrada da garagem do GIF publicado pelo projeto, convertido para MP4 preservando o tempo de cada quadro. Dispositivo de captura não informado; esta prévia não mede desempenho de renderização." />
</div>
</section>

## Leve o movimento para o seu app

Quatro receitas extraídas do projeto real: cockpit coordenado, seleção de atmosfera com spring, painel de carga com blur e câmera entrando na cabine. Cada uma tem vídeo nativo, código conferido e prompt de adaptação.

[Explore as 4 receitas](/pt-BR/recipes/?q=Jolt%20Drive) · [Leia o guia de integração](./drive-recipes)

<div class="drive-screens">
  <figure><img src="/media/jolt-drive-garage.png" width="368" height="800" loading="lazy" alt="Garagem do Jolt Drive com carro 3D, autonomia e controles rápidos" /><figcaption><span>01</span>A garagem</figcaption></figure>
  <figure><img src="/media/jolt-drive-cockpit.png" width="368" height="800" loading="lazy" alt="Cockpit do Jolt Drive com carga, climatização e opções de atmosfera" /><figcaption><span>02</span>O cockpit</figcaption></figure>
  <figure><img src="/media/jolt-drive-pickup.png" width="368" height="800" loading="lazy" alt="Busca simulada do Jolt Drive por Austin, com controles de pausa e trajeto" /><figcaption><span>03</span>Por Austin</figcaption></figure>
</div>
<p class="showcase-note">Telas do projeto publicado. <a href="https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/README.md">Origem e instalação ↗</a></p>

## Por dentro da experiência

Estas gravações preservadas mostram versões anteriores do Jolt Car. A entrada e as telas acima vêm do projeto publicado como Jolt Drive.

<div class="showcase-scenes">
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>01</span><h3>Garagem e controles</h3><p>Gire o carro e experimente os controles nativos.</p></div>
    <Clip name="film-car-ios" :width="260" caption="Jolt Car em um simulador dedicado de iPhone 17, iOS 26.2. Toques e arraste reais pelo XCTest: entrada, órbita da câmera, cockpit, carga, temperatura e faróis. Velocidade original. Interface de exemplo local; nenhum veículo real ou serviço é acessado. A vibração não pode ser sentida em uma gravação." />
  </article>
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>02</span><h3>Entre na cabine</h3><p>Uma mudança de perspectiva, guiada pelo toque.</p></div>
  <Clip name="film-impulse-cabin-ios" caption="Jolt Car em um simulador de iPhone 17, iOS 26.2. A interação real com o controle de clima pelo XCTest leva a câmera nativa do SceneKit para dentro da cabine e depois para fora. Sem cortes, a 1×. O carro é uma interface de exemplo local e não controla um veículo físico. SceneKit é exclusivo do iOS; a vibração não pode ser sentida em uma gravação." />
  </article>
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>03</span><h3>Pela Congress Avenue</h3><p>Um passeio por Austin, visto do banco do motorista.</p></div>
  <Clip name="jolt-car-drive-ios" caption="Gravação do app iOS Jolt Car. A cabine vazia segue um trajeto roteirizado para o norte na Congress Avenue, em Austin, e espera na 5th and Congress. A velocidade e o relógio de chegada correm na tela. Interface de exemplo local; nenhum veículo real ou serviço é acessado. Não é medição de desempenho em aparelho físico." />
  </article>
</div>

## Seu app pode estar aqui {#submit-app}

<ShowcaseBoard />
