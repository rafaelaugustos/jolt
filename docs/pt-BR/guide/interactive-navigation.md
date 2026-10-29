# Navegação interativa

`interactiveNavigation(frame)` adiciona **volta pela borda a uma transição personalizada de páginas no iOS**. A página acompanha o dedo; soltar antes da metade cancela, enquanto continuar ou lançar o gesto para frente confirma a volta. Uma spring do Jolt preserva a velocidade de soltura e acomoda as páginas. Frame e router só atualizam o histórico quando o UIKit confirma.

Disponível desde a **0.1.0-rc.1**. Recompile o app nativo. Integração verificada com NativeScript Core **9.1.3** e `vue-router-ns` **0.1.0-rc.2**.

<Clip name="interactive-navigation-ios" caption="Simulador iOS 26.2: toques e gestos reais via XCTest abrem uma página, cancelam uma volta parcial, confirmam uma volta completa e usam o botão de voltar. Reprodução nativa na velocidade original; não é medição em aparelho físico." />
<Clip name="interactive-navigation-pt-ios" caption="Simulador iOS 26.2: os mesmos cancelamento, confirmação e botão de voltar em português, com entrada real via XCTest e velocidade original." />

## Suspensão e rotação

**Corrigido na 0.1.0-rc.2:** o NativeScript descarrega temporariamente o Frame raiz quando o app vai para segundo plano. O Jolt cancela a volta em andamento e mantém o controlador enquanto esse Frame recarrega. A mesma página, o histórico e a transição personalizada continuam disponíveis na retomada. Um Frame que permaneça removido, uma rota excluída ou um `dispose()` explícito continuam liberando o controlador.

<Clip name="interactive-background-ios" caption="Simulador iOS 26.2, demo em inglês: um gesto real pela borda permanece pressionado durante a troca para a tela inicial. Ao retornar, a página é preservada; um novo swipe do Jolt confirma uma única volta, seguido de navegação pelo botão. Velocidade original; sem medição de desempenho em aparelho físico." />

Na configuração de iOS testada, girar o dispositivo durante o gesto adia a rotação da interface até a volta parcial se acomodar. A gravação verifica a página preservada, os layouts horizontal e vertical e um novo swipe confirmado; não demonstra uma mudança imediata do viewport durante o arraste.

<Clip name="interactive-rotation-ios" caption="Simulador iOS 26.2, demo em inglês: a orientação muda durante o gesto pressionado; o UIKit aguarda o cancelamento para exibir a interface horizontal. De volta à vertical, um novo swipe retorna normalmente. Entrada nativa real na velocidade original." />

## Um handle por entrada

```ts
import { interactiveNavigation } from '@rafaelaugusto/jolt/interactive-navigation'

// O Frame já está carregado. Crie outro handle para cada push.
const motion = interactiveNavigation(frame, {
  spring: 'smooth', // ou { duration: 480, bounce: 0 }
  onState(event) {
    // Eventos de ciclo de vida, nunca um observador por frame.
    if (event.outcome === 'cancelled') console.log('Continua nesta página')
  },
})

try {
  await router.push('/place/cala-serena', { transition: motion.transition })
  // Um guard/redirect pode resolver sem usar esta transição.
  if (motion.state === 'ready') motion.dispose()
} catch (error) {
  motion.dispose()
  throw error
}

// A entrada lembra a transição também para a volta programática.
await router.back()
```

Com Core puro, passe `transition: motion.transition` a `frame.navigate({ create: () => page, ... })`. Descarte o handle se a navegação nunca começar. Não reutilize a transição em outra entrada. Volta confirmada, remoção do histórico e unload do Frame liberam automaticamente o recognizer e o estado de transição do Core. `dispose()` é idempotente; na página visível, restaura o gesto padrão do Core conforme `page.enableSwipeBackNavigation`.

`supported` é false e `transition` é undefined no Android ou quando falta a classe nativa compilada. O chamador pode navegar normalmente com essas opções. Esta API não implementa predictive back no Android.

## Dedo, spring e histórico

- Um `UIScreenEdgePanGestureRecognizer` nativo começa na borda inicial (esquerda em LTR, direita em RTL). Exige intenção horizontal, entrada atual com destino de volta e nenhuma transição ativa no UIKit.
- O gesto chama uma vez o callback de volta fornecido pelo Core. O delegate existente do controlador de navegação fornece ao UIKit o animador e o controlador interativo do Jolt; o Jolt não substitui nem faz swizzle desse delegate.
- O gesto move as views reais das páginas. Na soltura, `JoltSpringAdvance` roda em um display link nativo, levando a velocidade do dedo à mesma equação das springs dos valores vivos do Jolt. Não há callbacks JS por frame. JS na thread principal ainda pode bloquear o UIKit.
- A decisão combina progresso e uma projeção curta da velocidade. Mover de volta à borda pode cancelar mesmo após cruzar a metade. A acomodação tem limite de três segundos reais, inclusive com spring incomum ou `timeScale` global lento.
- Cancelar restaura as duas transformações e mantém rota e histórico. Confirmar faz uma única volta. Entradas empilhadas têm handles independentes; só a entrada no topo aceita gestos.

`spring` aceita `smooth`, `snappy`, `bouncy` ou configurações duration/bounce e stiffness/damping/mass. Delay, repeat, tween e velocidade explícita não são aceitos. O progresso acompanha o dedo; `timeScale` afeta a spring no início de cada navegação. O progresso fica limitado às bordas da página, inclusive com spring elástica.

## Guards, acessibilidade e limpeza

`page.enableSwipeBackNavigation` é sempre respeitado. O `vue-router-ns` o desabilita enquanto guards assíncronos de saída precisam executar; use o botão de voltar para essa navegação. `canBegin()` permite uma condição síncrona adicional. Não espera decisões assíncronas.

Redução de movimento desabilita o gesto e conclui imediatamente a animação programática. O botão de voltar permanece disponível. Suspensão, mudança de viewport, `cancel()` e descarte cancelam um gesto ainda segurado. Depois de o UIKit aceitar a soltura, a limpeza conclui essa decisão sem tentar reverter uma volta confirmada.

`state` pode ser `ready`, `animating`, `idle`, `dragging`, `finishing`, `cancelling` ou `disposed`. O evento `finishing`/`cancelling` inclui `release: { progress, velocity }`, com velocidade em larguras de página por segundo. O evento `idle` após um gesto inclui `outcome: 'completed' | 'cancelled'`. Erros no observador são informados pelo Trace do NativeScript sem interromper a limpeza.

Mantenha o conteúdo visual da página anterior montado enquanto ela estiver no histórico: a volta interativa mostra essa página **antes** de `navigatedTo`. Reconstruir tudo apenas nesse evento deixa a prévia vazia.

Por padrão, esta API anima páginas inteiras do Frame. Para imagem/cartão com o mesmo progresso nativo, use a composição [gestos compartilhados](./shared-gestures). Modais nativos arbitrários, gesto em tela inteira e realização automática de views recicladas continuam fora deste contrato. Ofereça o botão de voltar como alternativa acessível. Veja a [validação nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interactive-navigation.md).
