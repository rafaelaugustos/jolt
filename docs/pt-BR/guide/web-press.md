# Feedback de pressão na Web

`motion.press()` adiciona feedback finito de ponteiro e teclado a uma superfície HTML declarada. Usa o [runtime Web](./web-runtime), sem Vue, React ou loop permanente por frame. A API experimental está na **0.1.0-rc.5**; veja a [instalação](./install#experimental-web-candidate). A integração do Mavis segue separadamente.

<Clip name="web-press-chromium" :width="720" caption="Chromium 156 no macOS arm64, gravação real do navegador em velocidade original, com ponteiro mantido pressionado e teclado: escala da aplicação 1,1, fator de pressão 0,96, novo destino 1,2 durante a pressão, soltura, Space/Enter, soltura fora, descarte e cancelamento por loading. Não é medição em aparelho físico." />

## Uso imperativo {#imperative-usage}

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document) // após montar
motion.set(button, { scale: 1.1 })
const feedback = motion.press(button) // scale: 0.96, spring snappy

// A aplicação pode mudar a escala durante a pressão por ponteiro ou Space/Enter.
motion.animate(button, { scale: 1.2 }, 'snappy')
feedback.update({ loading: true }) // cancela o feedback; não desabilita a ativação HTML
feedback.update({ loading: false }) // a próxima entrada pode pressionar novamente

// Ao desmontar o componente ou substituir sua superfície declarada:
feedback.dispose() // remove imediatamente apenas sua contribuição e listeners
motion.release(button) // libera toda a superfície no fim de seu ciclo de vida
motion.dispose() // descarta o contexto quando não for mais necessário
```

Os valores opcionais usam os canais numéricos do runtime: `motion.press(button, { scale: 0.96, opacity: 0.8 }, { transition: 'snappy', disabled: false, loading: false })`. Escala/opacidade multiplicam; translação/rotação somam. O feedback retorna à contribuição neutra, sem restaurar um valor antigo da aplicação.

| Estado                                    | Escala visual |
| ----------------------------------------- | ------------- |
| Aplicação em 1,1                          | 1,1           |
| Pressionado com fator 0,96                | 1,056         |
| Aplicação muda para 1,2 durante a pressão | 1,152         |
| Solto ou feedback descartado              | 1,2           |

É permitido um binding por superfície. O namespace privado `jolt:press:` é reservado. `pressed` informa o estado da entrada; `animation` expõe o último handle finito. Interrupções resolvem `finished` como `false`; conclusões resolvem como `true`, uma vez. O novo movimento herda posição e velocidade atuais. Um handle antigo não retoma o controle. Mudanças de movimento reduzido seguem a política do runtime.

## Entrada e ciclo de vida {#input-and-lifecycle}

O ponteiro primário funciona em caixas HTML transformáveis. Elementos `<button>` nativos também recebem feedback por Space/Enter. Jolt não sintetiza cliques, altera foco, chama `preventDefault()`, define `touch-action` ou solicita captura do ponteiro. Ativação, submissão de formulários e repetição do teclado continuam a cargo do navegador. Outros elementos recebem apenas feedback de ponteiro; a aplicação define teclado e semântica acessível. Controles interativos aninhados são ignorados.

Soltar fora, cancelamento/perda de captura, saída do mouse, rolagem de um ancestral, perda de foco/janela e ocultação da página cancelam o feedback. O navegador pode assumir a rolagem. `:disabled` nativo (inclusive fieldsets), `aria-disabled`, `aria-busy` no alvo, ancestral `inert` e `update({ disabled, loading })` bloqueiam o feedback e cancelam uma pressão. Esses estados controlam apenas o feedback: o componente deve implementar ativação, foco e loading, normalmente usando a propriedade nativa `disabled`.

Os alvos precisam estar montados. Elementos removidos são liberados automaticamente, inclusive em shadow roots; o descarte explícito é idempotente e funciona imediatamente após a remoção. Crie outro binding para a superfície substituta. Siga a [política de CSS](./web-runtime#surface-policy-and-limits): base 2D estática, sem animações/transições concorrentes ou mudanças de estilos de movimento/classes enquanto a superfície estiver sob controle. Uma superfície interna dedicada pode separar estilo e movimento.

## Referência nativa e verificação {#native-reference-and-verification}

O press nativo não mudou. Estas gravações existentes em inglês mostram sua composição por layers; não demonstram código Web nem uma tela compartilhada do Mavis.

<Clip name="motion-rfc-ios" caption="Simulador iOS 26.2, auditoria existente de Layers em inglês: toque real mantido e soltura preservam uma base diferente de 1 junto a layers independentes. Velocidade original; referência nativa, não gravação de iPhone físico." />
<Clip name="motion-rfc-android" caption="Emulador Android 16 / API 36, auditoria existente de Layers em inglês com toques reais por ADB e pressão mantida. Referência nativa em velocidade original, sem promessa de desempenho em aparelho físico." />

Execute `npm run web:press:typecheck` e `npm run web:press:test`. Chromium, Firefox e WebKit cobrem entrada, composição e cleanup; o gesto real de rolagem por toque usa apenas o CDP do Chromium. Veja o [relatório de verificação e gravação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-press.md).
