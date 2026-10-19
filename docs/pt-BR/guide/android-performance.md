# JavaScript ocupado no Android

O Jolt calcula os keyframes uma vez e os reproduz nativamente. Isso elimina JavaScript por frame da animação, mas o `ObjectAnimator` do Android continua atualizando as propriedades das Views na UI thread. Em um app NativeScript comum, o JavaScript do runtime principal compartilha essa thread. Uma tarefa síncrona longa pode parar transforms, opacidade e cores até terminar.

<Clip name="android-performance" caption="Reprodução normal, bloqueio de 300 ms no JavaScript e o mesmo trabalho em um worker no emulador Android 16. Diagnóstico visual, não uma garantia de desempenho em aparelhos." />

`ViewPropertyAnimator.withLayer()` não leva esse trabalho para a RenderThread. Ele guarda o desenho da view em uma camada de hardware, restaura a camada anterior depois e continua usando um `ValueAnimator` para atualizar propriedades. O cache de opacidade existente no Jolt reduz o custo de desenho; ele não torna uma UI thread bloqueada responsiva. Veja o código do Android para [`withLayer()` e a atualização das propriedades](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/view/ViewPropertyAnimator.java).

## Experimente

O playground Android inclui **Busy JavaScript**, com três controles:

- O preset `spin` do Jolt.
- A mesma rotação com `ViewPropertyAnimator.withLayer()` nativo.
- Um circular reveal nativo como outro efeito para comparação.

**Play** roda sem trabalho extra. **Block JS** executa um loop síncrono de CPU por 300 ms depois que as animações começaram. **Worker** executa o mesmo loop em outra thread. O worker está pronto antes da reprodução, então a comparação exclui seu custo de inicialização.

O reveal nativo é um controle de diagnóstico, não uma implementação Android da API `reveal()` do Jolt. Efeitos capazes de rodar na RenderThread são efeitos específicos da plataforma; eles não fornecem um backend geral para keyframes ou springs arbitrários do Jolt.

O [benchmark reproduzível](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/android-busy.md) registra amostras das propriedades nativas, IDs das threads do worker e intervalos de frames do `gfxinfo`. Ele distingue os registros da janela na UI thread da apresentação real na tela. O resultado no emulador é um diagnóstico, não uma garantia de desempenho em aparelho físico.

## Tire o trabalho de CPU da UI thread

Use um [Worker do NativeScript](https://docs.nativescript.org/guide/multithreading) para preparar dados, fazer parsing ou executar trabalho de CPU que possa devolver um resultado pequeno e serializável. Views e atualizações da UI continuam na thread principal:

```ts
// No app, não no Jolt.
const worker = new Worker('./prepare.worker.ts')
worker.onmessage = ({ data }) => {
  applyResult(data)
  worker.terminate()
}
worker.postMessage(input)
```

```ts
// prepare.worker.ts
import '@nativescript/core/globals'

self.onmessage = ({ data }) => {
  self.postMessage(prepareData(data))
}
```

Trate erros do worker e encerre trabalho pendente quando a tela for descartada; a demo faz os dois. Workers não podem manipular views do NativeScript diretamente. Tirar o cálculo da thread principal também não elimina o custo de reconciliar uma lista grande ou recalcular layout: aplique os resultados em lotes pequenos e evite mudanças caras nas views durante o movimento.

Quando o trabalho não puder ir para um worker, divida-o em tarefas limitadas que devolvam o controle ao loop nativo, ou conclua-o antes de começar a animação. `Promise.resolve()` só cede para microtasks; colocar uma tarefa longa em `setTimeout()` apenas adia o mesmo bloqueio da UI thread.

No iOS, os tracks do Core Animation já enviados pelo Jolt podem continuar no render server durante um bloqueio de JavaScript, mas input, novas animações e callbacks de conclusão em JavaScript ainda aguardam a thread principal.
