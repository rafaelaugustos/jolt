# Gradientes, carregamento e texto na Web

**Build de desenvolvimento, ainda fora do RC.9.** As issues #352–#357 adicionam `gradient`, `shimmer`, `loader`, `reveal`/`conceal`, `animateText` e `rollTo` ao runtime experimental `/web` e seus escopos filhos. O adaptador `/web/vue` gerencia esses recursos por `useWebMotion().use()`. A adoção no Mavis continua em uma frente separada.

## Gradientes {#gradients}

Gradientes lineares, radiais e cônicos aceitam 2–8 cores CSS, mantendo a quantidade de cores. As paradas são frações ordenadas de 0 a 1; o centro usa frações da caixa; o raio radial é uma fração não negativa da menor dimensão. Ângulos usam graus. Cores, paradas e geometria são substituídas independentemente. As cores usam a interpolação OKLab pré-multiplicada compartilhada; paradas que ultrapassam os limites são ordenadas sem trocar a identidade das cores. `bind()` usa valores numéricos/de cor do mesmo runtime e retorna uma limpeza que respeita substituições. Com movimento reduzido, a geometria mantém a posição atual e as cores continuam ativas.

Os gradientes são desenhados acima das imagens de fundo existentes e restauram apenas os estilos que ainda controlam. Gradientes finitos e valores contínuos usam o agendador do runtime, pois strings CSS de gradiente não interpolam como canais numéricos WAAPI. Nenhum loop de quadros independente é criado.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const paint = scope.gradient(card, {
  type: 'radial',
  colors: ['#4135c2', '#f5cf8e'],
  center: { x: 0.3, y: 0.4 },
  radius: 0.7,
})
await paint.animate({ center: { x: 0.7 }, colors: ['#087e8b', '#ffe1b2'] }, 'snappy')
const centerX = scope.motionValue(0.3)
const unbind = paint.bind({ center: { x: centerX } })
// unbind(); paint.stop(); paint.suspend(); paint.resume(); paint.dispose()
```

<Clip name="web-gradient-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais demonstram reprodução, pausa/retomada, substituição, movimento reduzido e limpeza na velocidade original. Captura de navegador; sem alegação de desempenho em aparelho físico." />

## Carregamento {#loading}

`shimmer()` adiciona uma faixa decorativa recortada. `loader()` aceita `dots`, `bars` e `ring`; o tamanho usa pixels CSS. Ambos retornam funções de limpeza com `pause`, `play`, `suspend`, `resume` e `dispose`. As camadas temporárias são inertes e ocultas da acessibilidade. Conteúdo, transformações e fundo do app são preservados. O app fornece os rótulos de carregamento e `aria-busy`. Movimento reduzido oculta a faixa e mantém um indicador estático; ocultar o documento pausa a reprodução.

```ts
const shimmer = scope.shimmer(placeholder, { duration: 1500 })
const loader = scope.loader(indicator, { style: 'ring', color: '#f3be7c', size: 48 })
shimmer.pause()
shimmer.play()
loader.pause()
loader.play()
// shimmer(); loader.dispose()
```

<Clip name="web-loading-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais demonstram reprodução, pausa/retomada, substituição, movimento reduzido e limpeza na velocidade original. Captura de navegador; sem alegação de desempenho em aparelho físico." />

## Revelação circular {#reveal}

As origens usam pixels CSS locais. A reversão começa no círculo exibido. Conceal termina com `visibility: hidden`, preservando layout e DOM; reveal restaura a visibilidade. Mova o foco antes de ocultar conteúdo interativo focado. Um clip path existente é intersectado por uma máscara temporária, preservando o recorte do app. Redimensionar cancela o círculo antigo e restaura seus estilos.

```ts
const hiding = scope.conceal(panel, { to: { x: 24, y: 24 }, duration: 600 })
const showing = scope.reveal(panel, { from: { x: 24, y: 24 }, duration: 600 })
showing.pause()
showing.progress = 0.5
showing.play()
await showing
```

<Clip name="web-reveal-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais demonstram reprodução, pausa/retomada, substituição, movimento reduzido e limpeza na velocidade original. Captura de navegador; sem alegação de desempenho em aparelho físico." />

## Texto e números em rolagem {#text}

`animateText()` agrupa grafemas Unicode ou palavras. `rollTo()` recebe um número finito ou uma string formatada; a direção automática compara destinos numéricos. Dígitos alterados rolam enquanto os demais permanecem. As cópias temporárias preservam a composição do texto e ficam fora da acessibilidade; o Text original continua como conteúdo semântico do framework. A substituição captura os fragmentos exibidos antes do cancelamento.

Use uma folha de texto simples block ou inline-block, com até um nó Text e 256 grafemas. Markup interno, controles editáveis, escrita vertical e transformações com rotação, inclinação ou escala negativa são rejeitados. Transformações positivas alinhadas aos eixos são aceitas. Redimensionamento, mudanças de fonte e substituição do texto cancelam com segurança. Os snapshots de números são achatados e limitados a 2048 fragmentos visíveis; exceder esse limite rejeita o próximo destino antes de substituir a animação atual. Algarismos tabulares são temporários; use CSS `font-variant-numeric: tabular-nums` para mantê-los em repouso.

```ts
await scope.animateText(label, { by: 'word', duration: 400, stagger: 60, y: 12 })
await scope.rollTo(amount, 12980.6, {
  format: (value) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
  direction: 'auto',
  duration: 600,
  bounce: 0.2,
  stagger: 20,
  tabular: true,
})
```

<Clip name="web-text-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais demonstram reprodução, pausa/retomada, substituição, movimento reduzido e limpeza na velocidade original. Captura de navegador; sem alegação de desempenho em aparelho físico." />

<Clip name="web-roll-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais demonstram reprodução, pausa/retomada, substituição, movimento reduzido e limpeza na velocidade original. Captura de navegador; sem alegação de desempenho em aparelho físico." />

## Controle dos recursos e Vue {#lifecycle}

Um alvo aceita um controlador por tipo de efeito. A substituição no mesmo runtime limpa o anterior; outro runtime é rejeitado. Animações oferecem pause/play, progresso e resultado booleano de conclusão. Suspender o escopo pausa a reprodução e descartá-lo libera seus recursos. Remoção e troca de ref limpam os efeitos; desativar KeepAlive libera os recursos do setup e ativá-lo os recria. O descarte preserva estilos mais recentes do app. Gradientes e máscaras usam o agendador compartilhado; texto, reveal sem clip do app e carregamento usam WAAPI. Essas escolhas não garantem execução fora da thread principal.

```ts
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'
const motion = useWebMotion(elementRef)
motion.use((scope, element) => {
  scope.shimmer(element)
  scope.gradient(element, { type: 'linear', colors: ['#4135c2', '#087e8b'] })
})
```

## Referências nativas e verificação {#verification}

As gravações novas abaixo mostram as implementações nativas correspondentes no demo Vue normal. Elas são referências visuais; os vídeos de navegador acima exercitam o backend Web novo. As APIs nativas existentes mantêm seu comportamento.

<Clip name="web-native-gradients-ios" caption="Simulador iPhone 17, iOS 26, demo Vue normal em inglês: interação real por XCTest demonstra o efeito nativo correspondente na velocidade original. Gravação de simulador." />

<Clip name="web-native-shimmer-ios" caption="Simulador iPhone 17, iOS 26, demo Vue normal em inglês: interação real por XCTest demonstra o efeito nativo correspondente na velocidade original. Gravação de simulador." />

<Clip name="web-native-loaders-ios" caption="Simulador iPhone 17, iOS 26, demo Vue normal em inglês: interação real por XCTest demonstra o efeito nativo correspondente na velocidade original. Gravação de simulador." />

<Clip name="web-native-reveal-ios" caption="Simulador iPhone 17, iOS 26, demo Vue normal em inglês: interação real por XCTest demonstra o efeito nativo correspondente na velocidade original. Gravação de simulador." />

<Clip name="web-native-text-ios" caption="Simulador iPhone 17, iOS 26, demo Vue normal em inglês: interação real por XCTest demonstra o efeito nativo correspondente na velocidade original. Gravação de simulador." />

<Clip name="web-native-rolling-ios" caption="Simulador iPhone 17, iOS 26, demo Vue normal em inglês: interação real por XCTest demonstra o efeito nativo correspondente na velocidade original. Gravação de simulador." />

Execute `npm run web:effects:typecheck` e `npm run web:effects:test`. A suíte cobre Chromium, Firefox e WebKit, bindings contínuos, substituição, Unicode, identidade do Text original, movimento reduzido, limpeza e ciclo de refs/KeepAlive do Vue. Os consumidores empacotados exercitam as seis APIs públicas, tipos estritos NodeNext/Bundler e importação segura em SSR.
