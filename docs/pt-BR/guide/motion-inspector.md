# Inspecione o movimento no dispositivo

Selecione uma view, veja qual animação controla suas propriedades e compare a curva esperada com observações nativas. O experimento **59 — Inspetor de movimento** também ajusta uma spring, reproduz o resultado e copia o TypeScript para repetir a configuração.

::: warning Apenas para desenvolvimento
Disponível desde a **0.1.0-beta.18**, no pacote principal. Recompile o app nativo para incluir o probe. Mantenha o import em uma entrada de desenvolvimento excluída do build de produção.
:::

<Clip name="motion-inspector-ios" caption="Simulador iOS com toques reais do XCTest: inspecionar uma interrupção, ajustar e reproduzir uma spring, pausar seu tempo, conferir atraso/camadas/vínculos e copiar TypeScript. Verde é o modelo do engine; rosa é a apresentação amostrada do CALayer. Gravação em velocidade original, sem medição de display físico." />

<Clip name="motion-inspector-android" caption="Emulador Android com toques reais via ADB: o mesmo inspetor lê propriedades da View nativa em buffer limitado. São observações na thread de UI, não timestamps de apresentação da GPU nem FPS de aparelho físico. Velocidade original." />

## Ative apenas no desenvolvimento

```ts
// dev/motion-tools.ts — exclua esta entrada do build de produção
import { createMotionInspector } from '@rafaelaugusto/jolt/inspector'

const inspector = createMotionInspector({
  development: true,
  capacity: 240,
  hertz: 60,
})
const unwatch = inspector.watch(card, 'card')
inspector.select('card', 'x')

const animation = animate(card, { x: 220 }, 'bouncy')
inspector.label(animation, 'Entrance')

// Um lote; o painel de desenvolvimento pode ler a cada 200–250 ms.
const state = inspector.read()
// state.properties: dono, rótulo, camada, alvo, valor, velocidade e tempos
// state.bindings: raiz do motion value, intervalos de mapeamento e seguidores
// state.events: início, troca, parada, conclusão, pausa e seek
// state.samples: instante, esperado, observado e origem

unwatch()
inspector.dispose()
```

Ler e selecionar não muda o tempo, reinicia, assina motion values nem toma controle das propriedades. Nomeie o handle original de `animate(view, ...)`; um grupo não é o dono de cada propriedade de seus filhos. Camadas nomeadas aparecem com donos separados, mesmo quando o driver reproduz uma única curva composta. Os eventos dessa curva têm identidade própria.

Registre e selecione antes de reproduzir um problema. Selecionar uma animação existente mostra o estado atual, mas não recupera eventos passados. Vínculos mostram a raiz e a cadeia de mapeamentos numéricos; entradas de seguidores nativos são expandidas até oito níveis. Detalhes da mistura de cores e dependências externas arbitrárias não são reconstruídos.

## Ajuste, copie e pause

```ts
import { inspectorSpring, springCode } from '@rafaelaugusto/jolt/inspector'

const spring = { duration: 650, bounce: 0.35 }
const options = inspectorSpring(spring)
// Também aceita física: { stiffness: 180, damping: 22, mass: 1 }
const code = springCode({ target: 'card', to: 220, spring })
```

O demo aplica duração e elasticidade ao tocar em **Reproduzir**. **Copiar TypeScript** gera uma spring explícita de `[0, alvo]` com velocidade inicial zero, reproduzível numa view nova após reiniciar. O preview salva os ajustes ao copiar. O retorno interrompido é outra ação e preserva a velocidade que já existia.

`inspector.control(animation, 'seek', 0.25)` pausa explicitamente e desloca um handle finito para 25%. Use `'play'` para continuar ou `'pause'` para pausar onde está. Esse comando altera o playback e é separado da inspeção. Animações infinitas não permitem scrubbing; a API atual de `timeline()` não oferece seek arbitrário da sequência inteira. Sequências com atraso podem ser inspecionadas conforme seus participantes entram em execução.

## Entenda as medições

- **iOS:** o probe lê a camada de apresentação. Quando ela falta, `observed` é `null`; a camada de modelo nunca a substitui.
- **Android:** o probe lê propriedades da View nativa na thread de UI. Isso não comprova a apresentação da GPU; a ordem dos callbacks pode colocar uma leitura um frame atrás do animator.
- A coleta nativa cobre `x`, `y`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` e `opacity`. Outras propriedades mantêm diagnósticos do engine com indisponibilidade nativa explícita. Translação usa DIP, rotação graus e escala/opacidade não têm unidade.
- `expected` é a curva entregue ao driver, ligada ao relógio que ele informa. É um modelo, não outra medição da tela. Seguidores nativos e curvas compostas iniciadas antes da seleção podem não ter curva reconstruível; nesses casos, o esperado é `null`. Escritas diretas do app e animadores de terceiros não são cobertos pelo registro de eventos.
- Os históricos nativo e JavaScript têm limites: capacidade de 8–600, padrão 240, até 32 views e uma sessão por vez. A coleta roda no nativo; JavaScript lê lotes. A frequência solicitada é um teto, não garantia de taxa de atualização. Amostras antigas descartadas são contadas. Lacunas continuam sendo lacunas no gráfico.

Descarregar a view selecionada ou ir para segundo plano encerra a coleta nativa. Selecione novamente ao voltar. Remover o registro libera os listeners; descartar o inspetor restaura o driver anterior e encerra o probe sem parar as animações do app. Descarte ao sair da página de desenvolvimento ou encerrar uma sessão de hot reload.

A entrada principal de produção não importa os hooks nem a UI do inspetor; uma verificação do bundle confirma a remoção. As classes nativas do probe acompanham o binário principal, mas ficam inativas até a criação explícita. `development: true` é uma opção deliberada, não detecção automática de build de produção.

`state.overhead` informa custo acumulado das leituras/hooks JavaScript, coleta/serialização nativa, quantidade de amostras e descartes. O custo de serialização aparece no lote seguinte. A medição exclui a renderização do painel e depende do ambiente; o benchmark também compara preparação com e sem inspeção. Veja [validação e reprodução](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/motion-inspector.md).
