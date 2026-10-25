# Gestos compartilhados

`sharedNavigationEntry(frame, options)` mantém uma imagem ou cartão conectado ao abrir uma rota e arrastar para voltar. Cancele para permanecer no detalhe ou complete para retornar à origem. O roteador controla o histórico; os drivers nativos do Jolt controlam a apresentação compartilhada.

Disponível neste checkout para a próxima beta; **não faz parte da beta.18**. Recompile o app nativo. Validado com NativeScript Core 9.1.3 e `vue-router-ns` 0.1.0-rc.2 em simulador iOS 26.2 e emulador Android 16 / API 36. No Android exige API 34+, AndroidX Activity 1.8+, navegação por gestos e `<application android:enableOnBackInvokedCallback="true" ...>`.

<Clip name="shared-entry-ios" caption="Simulador iOS 26.2, inglês: toques e gestos reais abrem a imagem, cancelam uma volta parcial e completam o retorno. Depois, um cartão abre, cancela e volta pelo botão. Reprodução nativa na velocidade original." />
<Clip name="shared-entry-pt-ios" caption="Simulador iOS 26.2, português: o mesmo percurso de imagem/cartão, cancelamento e retorno com entrada real do sistema. Não é uma medição de desempenho em aparelho físico." />
<Clip name="shared-entry-android" caption="Emulador Android 16, inglês: cancelamento real pela borda esquerda e conclusão pela direita mantêm a foto conectada; o cartão também cancela e volta pelo botão acessível. Velocidade original." />
<Clip name="shared-entry-pt-android" caption="Emulador Android 16, português: gestos e toques reais demonstram as transições de imagem/cartão, cancelamento e conclusão. Os indicadores mostram os toques reais, sem quadros de animação simulados." />

## Uma entrada, um responsável

Use o mesmo `sharedTransitionTag`, único, na origem e no destino. As páginas precisam preservar suas árvores de views. Imagens devem ser Core Images estáticas, já decodificadas e com a mesma origem; mudanças de recorte entre `aspectFill` e `aspectFit` são suportadas. Cartões de layouts simples fazem transição entre snapshots. Consulte as regras de conteúdo da [navegação compartilhada](./shared-navigation).

```ts
import { sharedNavigationEntry } from '@rafaelaugusto/jolt/shared-navigation'

// Frame e página de origem já carregados.
const entry = sharedNavigationEntry(frame, {
  tag: 'place-cover',
  spring: { duration: 480, bounce: 0 },
  // vue-router-ns retorna undefined no sucesso e um objeto em caso de rejeição.
  back: async (options) => (await router.back(options)) === undefined,
  onState(event) {
    if (event.outcome === 'cancelled') console.log('Ainda no detalhe')
  },
})

const result = await entry.open((options) => router.push('/place/cove', options))
backButton.on('tap', () => entry.back())
// Descarte quando esta entrada sair do histórico, não apenas quando a origem ficar coberta.
```

Com Core, repasse as opções para `frame.navigate({ create: createDetail, ...options })`. No callback `back`, verifique `frame.canGoBack()` antes de `frame.goBack()` e retorne `false` se não puder voltar. `navigate` síncrono com retorno void é suportado. Não adicione outra transição à mesma entrada.

`open()` aceita uma única abertura e resolve depois da apresentação com `SharedNavigationResult`: `completed`, `unavailable`, `cancelled` ou `failed`, além de `navigated` e `reason` opcional. Um par ausente ou incompatível usa navegação comum; `unavailable` pode ter `navigated: true`. Chamadas repetidas não abrem outra rota. Pedidos de voltar durante a abertura viram um único retorno após ela terminar.

## Controle nativo do gesto

| Plataforma  | Apresentação e histórico                                                                                                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS         | Os hooks de transição do Core preservam seu delegate e o histórico do UIKit. Um reconhecedor nativo de borda controla páginas e imagem/cartão pelo mesmo progresso. O par é resolvido depois do layout do UIKit.                                                                                                    |
| Android 14+ | O dispatcher existente controla progresso e decisão; a mola roda nativamente. Um snapshot limitado da página estática de origem e sua âncora é capturado antes da entrada. O detalhe real permanece por baixo do retorno compartilhado. O callback `back` roda uma vez após a conclusão, com `{ animated: false }`. |

Não há callback JavaScript por amostra do gesto ou quadro. JavaScript resolve tags, valida a origem estática nos limites do gesto, recebe eventos de ciclo de vida e executa a navegação. Isso não torna não bloqueante um trabalho JavaScript síncrono na thread principal.

No iOS, UIKit confirma a volta interativa pelo Core; o callback `back` atende ao botão acessível. Respeite `Page.enableSwipeBackNavigation` e a política de guards do roteador: um guard de saída pode desabilitar o swipe nativo. No Android, um guard assíncrono que rejeita restaura a apresentação e mantém a entrada para outra tentativa. O sistema decide se o gesto confirma; esta API não impõe um limiar de metade da tela.

## Limpeza e alternativas

- `back()` usa o retorno nativo e ignora pedidos repetidos enquanto ele estiver pendente. Mantenha a volta comum do roteador como alternativa no botão quando o handle já estiver descartado.
- `cancel()` restaura um gesto em andamento. Durante a abertura, descarta a apresentação; não cancela a operação pendente do roteador. No Android, uma liberação já confirmada pelo sistema continua.
- `dispose()`, descarregamento do Frame, remoção da rota e suspensão do app liberam entrada, overlays e snapshots. Após suspensão, use a volta comum ou crie outra entrada na próxima abertura.
- Movimento reduzido preserva a navegação sem o voo compartilhado. Tags ausentes/duplicadas, imagens incompatíveis, origem estática alterada no Android, conteúdo incompatível ou orçamento insuficiente usam a alternativa sem deixar views escondidas.
- `maxSnapshotPixels`: padrão **8.000.000**, inteiro positivo até **32.000.000**. Android contabiliza a cena de retorno junto com o voo; iOS limita cada voo. O limite conta pixels de imagens, não toda a memória do processo.
- `navigationTimeout`: padrão **5000 ms**, máximo **10000 ms**. Esperas de abertura ou retorno alternativo liberam o controle ao expirar. O commit protegido do Android restaura a prévia. Nenhum timeout cancela a promise da aplicação nem desfaz navegação externa tardia; limite seus guards.

A mola aceita `smooth`, `snappy`, `bouncy`, duration/bounce ou stiffness/damping/mass. Os drivers limitam a acomodação nativa a 3 segundos no iOS e 1,5 segundo no Android. A geometria visível fica limitada aos extremos.

`state` pode ser `ready`, `opening`, `idle`, `tracking`, `finishing`, `cancelling`, `committing` ou `disposed`. Eventos podem incluir `shared: { status: 'ready' | 'unavailable', reason? }`, `outcome` terminal e `release: { progress, velocity }`. São diagnósticos de ciclo de vida, sem fluxo reativo de progresso.

Esta etapa suporta **páginas estáveis preservadas, uma imagem estática ou cartão simples**. O fundo de retorno no Android é um snapshot: mantenha a origem estática enquanto estiver coberta; detectar uma mudança usa a alternativa, sem resolver um novo destino. Alvos reciclados/fora da tela, resolução após scroll, vídeo/GL/WebView, modais arbitrários, zoom nativo do iOS e coordenação de galeria ficam para outras etapas. Rotação, RTL e desempenho em aparelho físico não foram validados exaustivamente. Veja [reprodução e auditoria nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/shared-entry.md).
