# A coleção de movimentos

A [home do Jolt](/pt-BR/) e a [coleção de receitas](/pt-BR/recipes/) combinam um playground Web interativo com gravações do aplicativo nativo Motion Studio. Busque pelo nome, filtre por categoria e abra a receita para assistir à gravação, copiar o exemplo da API, consultar a demo NativeScript Vue completa ou copiar um prompt de adaptação.

## Experimente no navegador

A abertura combina tipografia grande com uma escultura cromada que acompanha o ponteiro, gira por clique ou teclado e mantém a inércia após um arraste horizontal. O pequeno renderizador WebGL pertence ao site; o Jolt fornece valores de movimento, springs, acompanhamento do ponteiro e arraste com inércia. Uma escultura vetorial continua disponível quando WebGL não está disponível ou perde o contexto. A renderização pausa fora da área visível ou quando o documento está oculto. Os dois aparelhos do Morrow acompanham a rolagem, e a ação principal responde ao ponteiro. O playground executa spring, stagger e drag/snap com o runtime experimental Jolt Web existente. Seu código é carregado com a home; os guias de referência não carregam esse runtime.

<Clip name="motion-site-chromium" :width="960" caption="Chromium no macOS arm64: interação real de ponteiro e teclado com o site do Jolt, incluindo escultura cromada com inércia, aparelhos do Morrow ligados à rolagem e reprodução, preview nativo, interrupção de spring, stagger, drag/snap, busca e cópia. Gravação do navegador na velocidade original. Os vídeos das receitas vêm do simulador iOS; Morrow é uma captura iOS fornecida pelo criador, sem identificação do aparelho de captura. Esta gravação do navegador não comprova desempenho nativo." />

Cada interação montada possui seu runtime e o descarta ao sair da página. A escultura acompanha mudanças de geometria ao redimensionar a janela. O site respeita a preferência de movimento reduzido do sistema; o rodapé também oferece um controle persistente de redução de movimento. Essa opção impede os previews automáticos. Vídeos carregam ao passar o ponteiro ou receber foco e pausam ao sair do card, da área visível ou do documento. As gravações completas possuem controles de reprodução.

## Gravações nativas

A galeria reutiliza capturas nativas revisadas. Os novos clipes abaixo são recortes das gravações do Motion Studio, sem alterar o tempo ou sintetizar quadros. Os originais continuam no repositório. Cada receita identifica a plataforma e os limites da captura.

<Clip name="showcase-springs-ios" caption="Simulador iOS 26: toques reais via XCTest interrompem e redirecionam a spring nativa. Velocidade original; não mede desempenho em aparelho físico." />
<Clip name="motion-recipe-drag-ios" caption="Simulador iOS 26: arraste e soltura reais via XCTest movem o card e o painel até seus encaixes. Trecho contínuo de showcase-touch-ios, na velocidade original. Sem afirmação de desempenho em aparelho físico." />
<Clip name="motion-recipe-gradients-ios" caption="Simulador iOS 26: interação real via XCTest altera a composição de gradientes nativos. Trecho contínuo de showcase-visual-ios, na velocidade original. Sem afirmação de desempenho em aparelho físico." />

A receita de revelação circular mantém a duração de 1600 ms selecionada na demo. A receita de confete mostra emissores nativos e uma explosão de confete. Nenhuma gravação demonstra vibração física. O filme e a experiência automotiva mantêm suas legendas e controles. As notas de versões anteriores e suas gravações estão no [histórico de versões](./release-history).

## Código e prompts

Cada trecho da API é extraído do guia versionado durante o build. Ele demonstra a API de animação; a demo nativa vinculada contém as views, os controles e o ciclo de vida. Os prompts incluem versão do pacote, import documentado, referência ao código, limites da captura, movimento reduzido e descarte de recursos. A API nativa e a API Web experimental não são intercambiáveis.

A coleção e suas páginas estão disponíveis em inglês, português brasileiro, espanhol e chinês simplificado. A busca e os filtros ficam representados na URL. A troca de idioma mantém a receita selecionada.

## Reproduza a revisão

Execute `npm run docs:check-media` e `npm run docs:build`. Inicie `npm run docs:preview -- --port 5181` e execute `npm run docs:test-site`. A revisão cobre Chromium e WebKit, interações reais, reprodução dos MP4 nativos, cópia, filtros, quatro idiomas, larguras de desktop e celular, movimento reduzido e navegação/remontagem. Os resultados ficam em `/tmp/jolt-motion-site-review`. A revisão visual bloqueia analytics e simula uma resposta vazia para a listagem da comunidade; ela não testa o serviço de comunidade em produção.

`scripts/motion-recipe-captures.json` registra os vídeos originais e os intervalos exatos dos recortes. `node scripts/prepare-motion-recipe-media.mjs` reproduz os clipes e as capas com FFmpeg. `node scripts/record-motion-site.mjs` grava o site com interação real via Playwright; use o MP4 acima na revisão, sem substituir a gravação por capturas de tela.

O site usa APIs Web já existentes no Jolt. Não adiciona capacidade ao motor nem altera código de aplicação do Mavis.

A home inclui um [estudo exploratório em aparelho físico](./performance-study), com CPU, PSS após a execução e espera de apresentação no mesmo painel. As três métricas usam o grupo padrão; o gráfico anima medições armazenadas. O rodapé compacto reúne receitas, showcase, estudo, instalação e API, além dos controles de movimento reduzido e volta ao topo.
