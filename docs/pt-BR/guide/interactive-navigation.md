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

Por padrão, esta API anima páginas inteiras do Frame. Para imagem/cartão com o mesmo progresso nativo, use a composição [gestos compartilhados](./shared-gestures). Modais usam o controle separado `interactiveModal()` abaixo. Gesto em tela inteira para páginas e realização automática de views recicladas continuam fora do contrato do Frame. Ofereça o botão de voltar como alternativa acessível. Veja a [validação nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interactive-navigation.md).

## Modais interativos {#interactive-modals}

**Ainda não publicado:** `interactiveModal()` adiciona fechamento por arraste para baixo a um modal NativeScript que ocupa a janela inteira. Abra **Navegação interativa → Abrir um modal** na prévia. Recompile o aplicativo nativo; caminho validado com Core **9.1.3**, NativeScript-Vue **3.1.2** e simulador iOS **26.2**.

<Clip name="interactive-modal-ios" caption="Simulador iPhone 17, iOS 26.2, interface em inglês: abrir um modal NativeScript-Vue real, cancelar um arraste para baixo, tentar novamente e confirmar, depois reabrir e fechar pelo botão. Reprodução nativa na velocidade original. Não mede desempenho físico nem valida leitor de tela." />

Crie um controle novo para cada apresentação. Core e Vue mantêm a propriedade do modal e do callback de fechamento; o Jolt fornece os objetos nativos de animação e interação pelo delegate de transição existente no Core.

```ts
import { interactiveModal } from '@rafaelaugusto/jolt/interactive-navigation'
import { $showModal } from 'nativescript-vue'

const motion = interactiveModal({
  spring: 'smooth',
  canBegin: () => !saving,
  onState(event) {
    if (event.outcome === 'cancelled') console.log('Continua aberto')
  },
})
try {
  const result = await $showModal(Detail, {
    transition: motion.transition,
    props: { motion },
  })
} finally {
  motion.dispose()
}
```

Dentro do modal, use `motion.close(result)` no botão de fechar. Em plataforma não suportada, use o `$closeModal(result)` normal do framework. Com Core sem Vue, passe a mesma `transition` para `parent.showModal(content, { transition, closeCallback })`; `content.closeModal(result)` continua disponível. Descarte um controle não utilizado se a apresentação falhar ou for abandonada. O [exemplo Vue executável](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/InteractiveModalDetail.vue) independe do roteador de páginas.

| Operação           | Contrato                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arraste para baixo | Um pan nativo controla o modal. O progresso acompanha o dedo; a soltura projeta a velocidade para escolher entre confirmar e cancelar. UIControls e descendentes de UIScrollView mantêm seus próprios gestos. |
| Cancelar           | Restaura o transform original da view do controller, preserva o modal do Core e o componente Vue, e mantém callback/promise de fechamento pendentes. Permite outro gesto ou fechamento pelo botão.            |
| Confirmar          | Conclui o UIKit uma vez; o Core chama o callback e o Vue desmonta uma vez. Libera gesto, display link e estado de transição do Core.                                                                          |
| `close(...args)`   | Encaminha argumentos ao Core. O primeiro pedido durante a abertura espera `shownModally`; duplicatas e pedidos durante arraste/acomodação retornam `false`. Pedidos aceitos retornam `true`.                  |
| `cancel()`         | Desfaz um gesto ainda segurado. Uma soltura já aceita pelo UIKit termina com o resultado escolhido.                                                                                                           |
| `dispose()`        | Desconecta o Jolt de forma idempotente sem fechar o modal. Cancela um arraste antes de liberar o estado do Core; o fechamento normal do Core/framework permanece disponível.                                  |

`cancelable: false` nas opções do modal e `canBegin()` síncrono bloqueiam o fechamento por gesto. Mantenha um botão de fechar acessível. Reduzir Movimento torna apresentação e acomodação imediatas, mantendo o controle direto pelo dedo; ativar a preferência cancela um gesto segurado. `timeScale` afeta a acomodação, limitada a três segundos reais. Os estados são `ready`, `presenting`, `idle`, `dragging`, `finishing`, `cancelling`, `closed` e `disposed`. Cancelamento informa `idle/cancelled`; conclusão, `closed/completed`. A velocidade de soltura usa **alturas do modal por segundo**. Não há observador JavaScript por frame.

Suspender durante o arraste cancela o gesto e preserva o modal para a retomada. Na gravação, a rotação é solicitada com o dedo ainda pressionado; nessa configuração, o UIKit mostra a paisagem após o cancelamento terminar. Restaurar retrato e fechar novamente continuam funcionando.

<Clip name="interactive-modal-lifecycle-ios" caption="Simulador iPhone 17, iOS 26.2, interface em inglês: arraste real mantido, Home/retomada, rotação, nova tentativa cancelada e fechamento confirmado, seguido de reabertura e fechamento pelo botão. Velocidade original; a paisagem aparece girada na gravação em retrato. Snapshot e os demais controles pequenos são diagnósticos opcionais. Não valida desempenho físico ou acessibilidade." />

O estilo suportado é o **modal customizado do Core que ocupa a janela inteira**, com apresentação animada padrão. Não substitua `ios.presentationStyle` nem seu delegate de transição. `animated: false` usa apresentação e fechamento comuns, sem instalar o pan do Jolt. Detents de sheets nativas, popovers, apresentações UIKit externas e transferência de scroll para fechamento ficam fora desta API. Um modal rolável pode oferecer um cabeçalho sem scroll para o arraste. `supported` é falso no Android, sem a classe nativa recompilada ou em versões do Core sem `closedModallyEvent`; nesses casos, `transition` é undefined. Desempenho físico e navegação por VoiceOver não foram medidos neste exemplo.

[Observações nativas e reprodução](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interactive-navigation.md#interactive-modals--2026-10-30) detalham o comportamento e a limpeza validados.
