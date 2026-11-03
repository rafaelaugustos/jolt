# Receitas de movimento do Jolt Drive

Quatro padrões reutilizáveis do [Jolt Drive](https://github.com/rafaelaugustos/jolt-drive), conferidos no commit `2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f`. Cada receita oferece o arquivo-fonte completo, um prompt de adaptação e uma nova gravação nativa da interação. Os arquivos usam Jolt RC.10 e NativeScript-Vue 3; são código do projeto, com as dependências descritas abaixo.

As gravações abaixo mostram o aplicativo real em um simulador iPhone 17 Pro com iOS 26.2, com interação real via idb e velocidade original. Não são evidência de desempenho em aparelho físico. O build do painel de carga difere do código publicado apenas em imports de tipos TypeScript removidos na compilação; o código da interação coincide.

## Painel, câmera e entrada dos cards {#cockpit}

[Abrir receita e copiar o código](/pt-BR/recipes/drive-cockpit) · [Código no projeto](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/pages/Home/useCockpitGesture.ts)

O hook de gestos conecta o arraste vertical ao painel e copia sua posição para o offset compartilhado. Home mapeia esse offset para o enquadramento da câmera; ControlSheet o usa na seta, nos resumos e na entrada escalonada dos cards. Ao soltar, a posição é projetada com velocidade × 0,18 antes de escolher aberto ou fechado.

<Clip name="drive-cockpit-ios" :width="320" caption="Jolt Drive · simulador iPhone 17 Pro, iOS 26.2. Interação real via idb no app nativo, velocidade original. Interface em inglês; não é gravação em aparelho físico nem medição de desempenho." />

**Preparação.** Use refs de NativeScript-Vue chamadas root (GestureSurface) e scrollContent (ScrollView), um motion value offset, posições height/closed medidas e estado active. Home e ControlSheet mapeiam esse offset para câmera e cards; o hook de gesto sozinho não cria a cena 3D.

**Ciclo de vida e adaptação.** Chame useCockpitGesture no setup do componente. Mantenha root e scrollContent montados quando os hooks executarem. Alimente active pelo ciclo de vida da página. O hook pausa a entrada quando inativo e libera assinatura, binding e controlador no unmount. Veja Home/index.vue e ControlSheet.vue para os consumidores do progresso compartilhado.

## Seleção guiada por uma spring {#atmosphere}

[Abrir receita e copiar o código](/pt-BR/recipes/drive-atmosphere) · [Código no projeto](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/pages/Home/AtmosphereOption.vue)

Um alvo alterna entre 0 e 1. Uma spring com rigidez 420, amortecimento 30 e massa 1 conduz fundo, borda, raio dos cantos e cor do texto em conjunto. O pai altera selected e controla o tema da aplicação.

<Clip name="drive-atmosphere-ios" :width="320" caption="Jolt Drive · simulador iPhone 17 Pro, iOS 26.2. Interação real via idb no app nativo, velocidade original. Interface em inglês; não é gravação em aparelho físico nem medição de desempenho." />

**Preparação.** Forneça name, color e selected, trate o evento select e instale o plugin Vue do Jolt para v-press. Copie ou substitua os helpers springs.snap e withAlpha do projeto. O pai controla a opção selecionada; SceneKit não é necessário.

**Ciclo de vida e adaptação.** Mantenha o plugin Vue do Jolt e useMotionScope: a spring seguidora e os bindings pertencem ao escopo do componente. Substitua os dois imports @/themes por equivalentes locais ou copie os helpers correspondentes. Trate a seleção como estado; não crie outra spring a cada toque. A política de movimento reduzido do Jolt continua valendo.

## Painel sobre um fundo desfocado {#charge-sheet}

[Abrir receita e copiar o código](/pt-BR/recipes/drive-charge-sheet) · [Código no projeto](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/pages/Home/EnergyPlan.vue)

Somente o fundo da garagem recebe blur. O painel continua nítido como elemento irmão, com pontos de encaixe content e 90%, ScrollView e backdrop. Quando o blur não tem backend disponível, o exemplo aumenta a opacidade do backdrop. Salvar e fechar usam a mesma saída.

<Clip name="drive-charge-sheet-ios" :width="320" caption="Jolt Drive · simulador iPhone 17 Pro, iOS 26.2. Interação real via idb no app nativo, velocidade original. Interface em inglês; não é gravação em aparelho físico nem medição de desempenho." />

**Preparação.** Registre GestureSurface e as diretivas Vue do Jolt. Forneça accent, level, limit e a view montada da garagem como background; renderize o painel como irmão dela. Adapte Icon, safeArea e os helpers de tema. Trate save/close sem desmontar antes do fim da saída.

**Ciclo de vida e adaptação.** Mantenha o painel fora da árvore do fundo desfocado. onDismiss espera o blur desaparecer antes de emitir close, com uma proteção contra desmontagem. Preserve useMotionScope e descarte o proprietário do blur no unmount. Se adaptar para um modal, o host também deve cuidar de foco, semântica e ciclo de vida da página.

## Da câmera orbital à cabine {#cabin}

[Abrir receita e copiar o código](/pt-BR/recipes/drive-cabin) · [Código no projeto](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/components/scene/Car3D.vue)

A câmera primeiro se alinha à porta; depois inside vai de 0 a 1 em 1900 ms. A saída dura 1400 ms. O renderizador conecta posição, foco, campo de visão, iluminação e materiais a esse progresso. O caminho pela porta é uma interpolação quadrática nas coordenadas do conjunto da câmera.

<Clip name="drive-cabin-ios" :width="320" caption="Jolt Drive · simulador iPhone 17 Pro, iOS 26.2. Interação real via idb no app nativo, velocidade original. Interface em inglês; não é gravação em aparelho físico nem medição de desempenho." />

**Preparação.** Exclusivo do iOS. Requer SceneView/createCarStage, helpers camera-path, modelo, materiais e ClimatePanel do projeto, além de @rafaelaugusto/jolt-native. Use as medidas da sua cena. Car3D é o arquivo completo, não um helper isolado de câmera nem uma implementação Web.

**Ciclo de vida e adaptação.** Leia Car3D.vue junto com car-stage.ios.ts e camera-path.ts. Adapte porta, olhos e foco ao seu modelo em vez de copiar as coordenadas. Preserve os controles de revisão, movimento reduzido, active/foreground e a diferença entre proprietários nativos duradouros e bindings recriados. SceneKit é exclusivo do iOS; esta não é a API Web.

## Gravações e origem do código {#provenance}

Os arquivos são cópias conferidas, verificadas por SHA-256. O botão de código aponta para o commit fixado, evitando que a receita mude silenciosamente com a main. Execute o projeto completo para obter a interface e os assets ao redor.
