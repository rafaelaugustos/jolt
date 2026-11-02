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

<section class="showcase-feature" aria-labelledby="jolt-car">
  <div class="showcase-copy">
    <p class="showcase-kicker">EM DESTAQUE <span class="showcase-platform">iOS · SceneKit</span></p>
    <h2 id="jolt-car">Jolt Car<span>.</span></h2>
    <p class="showcase-lead">Uma garagem em que dá para entrar. Gire o carro, explore a cabine e sinta cada controle responder.</p>
    <ul class="showcase-points">
      <li><a href="./rolling">Números rolando</a> para as milhas e a porcentagem.</li>
      <li>Câmera <a href="./scene-camera">SceneKit</a> para o carro, a cabine e a rua.</li>
      <li><a href="./press">Press</a> e springs nos controles.</li>
    </ul>
    <p class="showcase-note">Exemplo local. Carga, clima e o trajeto ficam no telefone. O modelo detalhado é a prévia do <code>jolt-car</code> e fica de fora deste repositório.</p>
  </div>
  <div class="showcase-stage">
  <Clip name="film-car-ios" :width="260" caption="Jolt Car em um simulador dedicado de iPhone 17, iOS 26.2. Toques e arraste reais pelo XCTest: entrada, órbita da câmera, cockpit, carga, temperatura e faróis. Velocidade original. Interface de exemplo local; nenhum veículo real ou serviço é acessado. A vibração não pode ser sentida em uma gravação." />
</div>
</section>

## Por dentro da experiência

Da câmera aos controles: veja os detalhes em movimento.

<div class="showcase-scenes">
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>01</span><h3>Entre na cabine</h3><p>Uma mudança de perspectiva, guiada pelo toque.</p></div>
  <Clip name="film-impulse-cabin-ios" caption="Jolt Car em um simulador de iPhone 17, iOS 26.2. A interação real com o controle de clima pelo XCTest leva a câmera nativa do SceneKit para dentro da cabine e depois para fora. Sem cortes, a 1×. O carro é uma interface de exemplo local e não controla um veículo físico. SceneKit é exclusivo do iOS; a vibração não pode ser sentida em uma gravação." />
  </article>
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>02</span><h3>Pela Congress Avenue</h3><p>Um passeio por Austin, visto do banco do motorista.</p></div>
  <Clip name="jolt-car-drive-ios" caption="Gravação do app iOS Jolt Car. A cabine vazia segue um trajeto roteirizado para o norte na Congress Avenue, em Austin, e espera na 5th and Congress. A velocidade e o relógio de chegada correm na tela. Interface de exemplo local; nenhum veículo real ou serviço é acessado. Não é medição de desempenho em aparelho físico." />
  </article>
</div>

## Seu app pode estar aqui {#submit-app}

<ShowcaseBoard />
