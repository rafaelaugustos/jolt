# O playground Web

[Abrir o playground](/pt-BR/#playground)

53 experimentos, sete categorias e uma demo ativa por vez. Busque pelo nome ou pela API, escolha, interaja e copie o código principal. O experimento selecionado fica na URL e acompanha a troca de idioma.

## Explore

- [Movimento e física · 12](/pt-BR/?play=spring#playground): Springs, stagger, keyframes, presets, gravidade, inércia, timelines, sequências, controle de progresso, estados, valores e física de círculos.
- [Toque e gestos · 7](/pt-BR/?play=gestures#playground): Press, drag/snap, inércia, gestos simultâneos, acompanhamento do ponteiro, zoom de imagem e reordenação.
- [Rolagem e layout · 9](/pt-BR/?play=scroll#playground): Rolagem vertical e horizontal/RTL, entradas no viewport, itens com chave, layout, tamanho automático, layout compartilhado, cabeçalhos e rolagem aninhada.
- [Efeitos visuais · 12](/pt-BR/?play=gradient#playground): Gradientes lineares/radiais/cônicos, partículas, confete, blur, glass, formas, desenho SVG, imagens líquidas, efeitos de imagem, reveal/conceal, shimmer e loaders.
- [Texto e símbolos · 3](/pt-BR/?play=text#playground): Animação por palavra/letra, números rolantes e efeitos em símbolos com camadas.
- [Superfícies e navegação · 5](/pt-BR/?play=sheet#playground): Bottom sheets, diálogos interativos, navegação compartilhada, volta interativa e retorno à galeria, inclusive sem a miniatura original.
- [Dispositivo e navegador · 5](/pt-BR/?play=sensor-rotation#playground): Sensores de rotação e gravidade, hápticos, observação/acompanhamento do teclado e inspeção de playback/ciclo de vida.

## O que roda de verdade

Todos os previews usam o runtime experimental Jolt Web existente. Só o experimento selecionado fica montado. Sair do viewport suspende seu escopo; voltar o recria. Trocar de demo ou sair da página descarta listeners, efeitos e vínculos com o DOM. Redimensionar recalcula os limites geométricos. As preferências de movimento reduzido do site e do sistema continuam respeitadas.

Os trechos mostram a integração principal e pressupõem refs DOM já montadas. O guia da API detalha a estrutura, o ciclo de vida e os limites. A navegação compartilhada troca uma cena local da demo; o aplicativo continua responsável pelas rotas. O adaptador Vue está em [Integração Web](./web-vue). Esta atualização do site não altera o motor nem a API nativa.

Sensores só solicitam permissão após uma ação explícita e precisam receber leituras reais para indicar atividade. Dispositivos incompatíveis ou sem permissão mostram seu estado. Hápticos informam a aceitação do navegador, sem confirmar vibração física. Um teclado de desktop normalmente cobre zero pixels; experimente em um celular compatível. Glass e efeitos de imagem exibem o backend real. Movimento reduzido pode suprimir a animação.

## Gravações reais no navegador

<Clip :autoplay="false" name="web-playground-motion-chromium" :width="960" caption="Chromium no macOS arm64, interface em inglês, velocidade original, sem áudio. Interação real de ponteiro e teclado com o playground. Captura do navegador, não uma medição de desempenho nativo." />

<Clip :autoplay="false" name="web-playground-effects-chromium" :width="960" caption="Chromium no macOS arm64, interface em inglês, velocidade original, sem áudio. Interação real de ponteiro e teclado com o playground. Captura do navegador, não uma medição de desempenho nativo." />

<Clip :autoplay="false" name="web-playground-platform-chromium" :width="960" caption="Chromium no macOS arm64, interface em inglês, velocidade original, sem áudio. Interação real de ponteiro e teclado com o playground. Captura do navegador, não uma medição de desempenho nativo." />

## Referências nativas revisadas

Estas gravações nativas existentes ficam separadas dos previews Web. Os guias vinculados incluem as demais referências nativas e os limites específicos de cada plataforma.

<Clip :autoplay="false" name="showcase-springs-ios" caption="Simulador iOS 26: toques reais via XCTest interrompem e redirecionam o spring nativo. Velocidade original; não mede desempenho em aparelho físico." />

<Clip :autoplay="false" name="gesture-composition-ios" caption="Simulador iOS: demo nativa existente de gestos simultâneos e toque. Velocidade original; não é aparelho físico." />

<Clip :autoplay="false" name="web-native-gradients-ios" caption="Simulador iPhone 17, iOS 26: demo Vue nativa em inglês, interação real via XCTest com gradientes. Velocidade original; não é aparelho físico." />

<Clip :autoplay="false" name="interactive-modal-ios" caption="Simulador iOS, demo nativa em inglês: apresentação, retorno e fechamento interativo do modal. Velocidade original; não é aparelho físico." />

## Revisão e cobertura

Execute `npm run docs:check-playground`, `npm run docs:check-media` e `npm run docs:build`. Com o site rodando, use `JOLT_SITE_URL=http://127.0.0.1:5184 npm run docs:test-playground`. A revisão exercita cada experimento em Chromium e WebKit, além de gestos, teclado, tamanhos de tela, idiomas, movimento reduzido e limpeza. A checagem de cobertura falha se uma operação pública Web não tiver demo ou responsabilidade documentada no host. Ela mede cobertura, não suporte universal de navegadores.
