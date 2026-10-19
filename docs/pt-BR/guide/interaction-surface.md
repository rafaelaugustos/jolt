# Áreas de toque durante a animação

`interactionSurface(target)` mantém a geometria nativa de toque alinhada às transformações e à opacidade animadas pelo Jolt em uma view e seus descendentes. Adicionado na beta.8. **Recompile o app iOS** para incluir o novo helper nativo.

<Clip name="interaction-surface-ios" caption="Um toque na posição visível do card azul o expande durante a reorganização lenta. Simulador iOS; o layout ativa a geometria interativa." />

```ts
import { animate, drag, interactionSurface } from '@rafaelaugusto/jolt'

const surface = interactionSurface(container)
const animation = animate(button, { x: 180 }, { duration: 1200 })
const cardDrag = drag(card, { axis: 'x', bounds: { left: 0, right: 180 } })

// Ao descartar a tela:
cardDrag.dispose()
animation.stop()
surface.dispose()
```

Registre a superfície **antes de iniciar as animações**. O alvo aceita uma view NativeScript ou uma ref compatível. A seleção inclui o próprio alvo e seus descendentes NativeScript. Inclua todos os ancestrais animados: registrar só o botão não corrige uma transformação Core Animation de um pai fora da superfície. A demo de drag registra o container para manter o card interativo durante a soltura.

## Por que é opcional?

Por padrão, no iOS o Jolt escreve o destino no modelo NativeScript e anima a apresentação com Core Animation. O UIKit pode testar o toque no destino enquanto o botão aparece em outro lugar. O teste da issue #56 reproduziu isso com um botão real pausado no meio de uma translação.

Dentro da superfície, o iOS reproduz os keyframes numéricos previamente calculados com um `CADisplayLink` nativo compartilhado, atualizando a transformação e a opacidade reais. Hit testing, gestos, clipping, ordem dos irmãos e geometria de acessibilidade usam essa mesma geometria. Nenhum método de UIView é substituído, nenhum controle transparente é inserido e não há callback JavaScript por frame. Cores e decorações continuam com seus drivers existentes.

No Android, as animações de propriedades nativas já atualizam a geometria de toque. A mesma API pode ser usada e mantém o driver existente.

Há um custo na thread de UI do iOS: use a superfície no conteúdo interativo em movimento, em vez de incluir toda a decoração por padrão. JavaScript pesado na thread principal pode atrasar a animação e os toques. Não há garantia de reprodução pelo render server com a thread principal bloqueada. As propriedades JS do NativeScript continuam seguindo o destino usado pelo engine; elas não se tornam motion values reativos a cada frame.

## Ciclo de vida e reprodução

O handle expõe `disposed: boolean` e `dispose()` idempotente. Registros independentes na mesma view usam contagem de referências; descartar um não remove os outros.

O descarte desativa a seleção para **animações futuras**. Ele não interrompe nem troca o driver de animações em andamento. Registrar uma superfície também não migra uma animação Core Animation já iniciada. Pare ou substitua essa animação depois do registro se ela precisar de geometria interativa.

Pause, resume, scrub, delay, reverse/repeat e interrupção seletiva mantêm a semântica dos handles. Tracks pausadas mantêm a pose sem display link ativo. Unload cancela as animações da view. No iOS, a suspensão do app cancela as tracks interativas na posição atual, resolvendo com `false`; inicie outra animação após o resume quando necessário. Assim não fica um loop interativo retido em background.

Um scope pode controlar o registro e as animações:

```ts
const scope = motionScope() // ou useMotionScope() no setup do Vue
scope.use(() => interactionSurface(container))
const animation = scope.animate(button, { x: 180 })
// scope.dispose() para as animações próprias e descarta o registro.
```

## As regras nativas continuam valendo

Uma view desabilitada ou sem interação continua assim. A parte recortada não recebe toques, e os limites nativos dos ancestrais continuam restringindo o hit testing. A API não amplia a área de toque do pai, não arbitra reconhecedores concorrentes e não altera os limites de coordenadas descritos em [drag](./drag). Labels, papéis e semântica de acessibilidade continuam sob controle do NativeScript; a superfície preserva os controles existentes sem duplicá-los.

O [relatório de validação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interaction-lifecycle.md) cobre toques pelo SO, ancestrais animados, clipping, controles sobrepostos, `press()`, frames nativos de acessibilidade e ciclo de vida nos dois sistemas. Não representa uma auditoria manual de navegação com VoiceOver ou TalkBack.
