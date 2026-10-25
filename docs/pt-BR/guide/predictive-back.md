# Voltar com prévia

`predictiveBack(view, values, options)` conecta uma superfície ao gesto de voltar do Android. A view acompanha o progresso das duas bordas; cancelar faz a spring retornar, e confirmar termina a spring antes de chamar sua função de navegação ou fechamento uma vez.

Disponível neste checkout para a próxima beta; **não faz parte da beta.18**. Recompile o app nativo. Requer **Android 14 / API 34+**, navegação por gestos, AndroidX Activity **1.8+** e a opção no manifest abaixo. Validado com NativeScript Core **9.1.3** e `vue-router-ns` **0.1.0-rc.2**.

<Clip name="predictive-back-android" caption="Emulador Android 16 / API 36: toques e gestos reais do sistema abrem as dunas, cancelam uma volta parcial, confirmam pela borda direita e usam o botão de voltar. Reprodução nativa na velocidade original; não é uma medição em aparelho físico." />
<Clip name="predictive-back-pt-android" caption="Emulador Android 16: o mesmo cancelamento, confirmação pela direita e botão acessível em português, com entrada real do sistema na velocidade original." />

## Uma superfície com dono

Ative no aplicativo que usa a biblioteca:

```xml
<application android:enableOnBackInvokedCallback="true" ...>
```

Crie o handle quando a view estiver anexada e seu ciclo de vida iniciado, por exemplo no `navigatedTo` da Page. Use um container dedicado, sem outra animação ou binding escrevendo suas transformações.

```ts
import { predictiveBack } from '@rafaelaugusto/jolt/predictive-back'

const motion = predictiveBack(
  surface,
  {
    x: [0, 28],
    y: [0, 14],
    scale: [1, 0.9],
    rotate: [0, 0.6],
  },
  {
    spring: { duration: 380, bounce: 0 },
    // vue-router-ns resolve undefined no sucesso e um objeto quando a navegação falha.
    commit: async (options) => (await router.back(options)) === undefined,
    onState(event) {
      if (event.outcome === 'cancelled') console.log('Continuamos aqui')
    },
  },
)

// Botão acessível: a mesma animação e uma única confirmação.
backButton.on('tap', () => motion.back())
```

`commit` é obrigatório: o Jolt não pode inferir se deve fechar um painel ou voltar uma rota. Ele recebe `{ animated: false }` para evitar outra transição de rota. Retorne `false` quando um guard rejeitar; retorne `true` ou nada depois de fechar/navegar. Exceções e promises rejeitadas também restauram a apresentação. Para um painel dentro da página, feche-o no `commit`. Um handle concluído se descarta; crie outro quando a superfície abrir novamente.

Com Core puro, o commit pode verificar `frame.canGoBack()`, retornar false quando indisponível e chamar `frame.goBack()`; configure essa entrada sem uma segunda transição do Core ao abri-la. Não anexe um dono habilitado a uma página raiz sem ação de voltar. Use `motion.enabled = false` quando outra parte da interface precisar receber essa ação.

## Valores e física

| Valores                         | Significado                                                                 |
| ------------------------------- | --------------------------------------------------------------------------- |
| `x`, `y`                        | Deslocamento relativo em DIPs, começando em `0`                             |
| `rotate`                        | Rotação relativa em graus, começando em `0`                                 |
| `scale`, ou `scaleX` / `scaleY` | Multiplicadores da escala capturada, começando em `1`, destino positivo     |
| `opacity`                       | Multiplicador do alpha capturado, começando em `1`, destino entre `0` e `1` |

Cada valor é um par de números finitos. Não combine `scale` com `scaleX` / `scaleY`. Propriedades omitidas são preservadas. Deslocamento, rotação, escala e alpha nativos existentes são capturados a cada gesto e restaurados no cancelamento ou descarte. Essas seis propriedades pertencem ao handle durante a interação; não as anime ao mesmo tempo por outro caminho.

`mirrorX` é true por padrão: x e rotação invertem a direção quando o gesto começa na direita. `spring` aceita `smooth`, `snappy`, `bouncy`, duration/bounce ou stiffness/damping/mass. O progresso nativo fornece a velocidade de soltura à spring do Jolt. O Android decide confirmar ou cancelar, inclusive em flicks; o Jolt não impõe um limiar de metade. O progresso visual fica entre `[0, 1]`. A acomodação tem limite de **1,5 segundo de relógio**, mesmo com física incomum ou `timeScale` lento; a velocidade é capturada ao anexar ou atualizar movimento reduzido.

## Entrada nativa, guards e limpeza

Um `OnBackPressedCallback` Java se anexa ao dono do dispatcher existente na árvore da view. Não substitui Activity, router ou dispatcher. O último callback habilitado recebe a ação; registre depois que a página aparecer e desabilite ou descarte quando não for mais o dono. O fechamento normal do teclado continua tendo prioridade.

Progresso e frames da spring em `Choreographer` ficam em Java. JavaScript recebe eventos de ciclo de vida e o commit final do app, nunca uma chamada por amostra ou frame. Isso não torna trabalho JavaScript na thread principal não bloqueante.

Um guard rejeitado faz a spring retornar sem remover histórico. Um commit assíncrono espera no máximo `commitTimeout` milissegundos (padrão **5000**, intervalo **1–10000**); depois restaura com motivo `timeout`. Isso **não cancela sua promise** nem desfaz uma navegação externa posterior: limite seus guards ou implemente cancelamento no aplicativo.

`state` pode ser `idle`, `tracking`, `cancelling`, `finishing`, `committing` ou `disposed`. Finishing/cancelling incluem `release: { progress, velocity }`, com velocidade em progresso por segundo. Eventos idle terminais incluem `outcome: 'completed' | 'cancelled'`; commits rejeitados também informam `reason: 'rejected' | 'error' | 'timeout'`. `edge` indica left/right em gestos e não aparece em botões. `progress` é uma leitura sob demanda, não um valor reativo.

- `cancel()` desfaz um gesto ainda segurado. Uma soltura já confirmada pelo Android continua.
- `enabled = false` cede futuras ações e restaura uma prévia em andamento.
- Movimento reduzido mantém a superfície parada, preservando a ação e os guards.
- Desanexar a view, destruir o ciclo de vida ou chamar `dispose()` restaura a superfície e remove a entrada. Uma rota desanexada durante `commit` mantém somente a conclusão pendente, com prazo. Suspender restaura o gesto. Se o Core descarregar a view ao parar a Activity, crie outro handle depois que ela carregar e se anexar; o preview demonstra isso. Um handle cuja view continuar anexada pode retomar.
- `supported` é false no iOS, Android antigo, código nativo ausente, view desanexada ou dono ausente/inativo. Nenhum callback nativo é instalado. `back()` explícito ainda chama seu commit sem movimento; o voltar normal do sistema continua igual. Descarte um handle sem suporte antes de tentar anexar novamente.

A opção no manifest e navegação por gestos ainda precisam estar ativas mesmo com `supported` true. A API anima a superfície fornecida; não desenha a rota anterior, adiciona morphs compartilhados ou substitui o histórico do router. Para páginas inteiras no iOS, veja [navegação interativa](./interactive-navigation). Consulte a [validação nativa e reprodução](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/predictive-back.md) e o [guia do Android para animações ao voltar](https://developer.android.com/guide/navigation/custom-back/support-animations-views).
