# Números rolando

Troque um número e deixe os dígitos que mudaram rolarem até o lugar:

<div class="clips">
<Clip name="rolling-ios" caption="Dígitos rolando no iOS." />
<Clip name="rolling-android" caption="Dígitos rolando no Android." />
</div>

```ts
import { rollTo } from '@rafaelaugusto/jolt'

await rollTo(balance, 1249.9, { format: (value) => value.toFixed(2) })
await rollTo(timer, '00:42')
```

O alvo deve ser uma `Label` do NativeScript, ou um template ref / `ElementRef` que contenha uma. A Label recebe o texto final na hora, então layout, bindings e acessibilidade já têm o novo valor desde o primeiro frame. Só o desenho se move: em cada posição que mudou, o glifo antigo desliza para fora enquanto o novo desliza para dentro atrás dele, em uma spring do Jolt, recortado pela Label. Os dígitos que não mudaram ficam parados.

Um número passa por `format` antes, `String` por padrão. Uma string é mostrada como está.

## Opções

| Opção       | Padrão   | Significado                                                                 |
| ----------- | -------- | --------------------------------------------------------------------------- |
| `format`    | `String` | Transforma um número no texto a mostrar.                                    |
| `duration`  | `600`    | Quanto tempo a spring parece durar, em milissegundos.                       |
| `bounce`    | `0.2`    | Quique da spring, de -1 a 1, como nas [springs](./transitions).             |
| `stagger`   | `0`      | Milissegundos entre as posições que mudaram, a partir da mais à direita.    |
| `delay`     | `0`      | Milissegundos antes de a primeira posição se mover.                         |
| `direction` | `'auto'` | `'auto'`, `'up'` ou `'down'`.                                               |
| `tabular`   | `true`   | Algarismos tabulares na label nativa, para todo dígito ter a mesma largura. |

Com `'auto'`, um número maior rola para cima e um menor rola para baixo. A comparação usa o número do `rollTo()` anterior naquela Label, ou o texto anterior quando ele é um número; strings rolam para cima. Rolar para cima quer dizer que o glifo antigo sai por cima enquanto o novo entra por baixo.

## Como as posições se alinham

Os dois textos são divididos em grafemas, então uma letra acentuada ou um emoji composto conta como uma posição, e alinhados pelo último caractere. O dígito das unidades fica no lugar quando o número cresce: `99` vira `100` rolando os dois noves para zeros e rolando um `1` para dentro à esquerda, e `100` vira `99` rolando o `1` para fora sozinho. Separadores e sufixos que não mudam ficam parados.

O stagger conta as posições que mudaram a partir da direita: o dígito das unidades se move primeiro, depois cada posição à esquerda dele, e por último os dígitos que saem sem ninguém entrar.

## Plataformas

No iOS, o TextKit calcula o layout do texto antigo e do novo nos bounds atuais da Label e o Jolt separa os glifos em layers temporárias com imagens, do mesmo jeito que as [entradas de texto](./text). O Core Animation toca a spring e os fades sem JavaScript por frame enquanto o texto da própria Label é desenhado transparente. Os limites do guia de texto valem aqui: labels truncadas, anexos embutidos e redução automática da fonte mostram o texto final e resolvem com `false`.

No Android, um span por posição que mudou desenha o glifo antigo e o novo, e um único animator nativo os move, respeitando a escala de duração de animações do sistema. A `TextView` mantém o texto real o tempo todo. Recompile o app Android depois de atualizar para incluir a classe nativa; sem ela, a Label mostra o texto final e a chamada resolve com `false`.

Com `tabular` ligado, o Jolt pede algarismos tabulares à label nativa: o recurso de espaçamento de números da fonte no iOS e a configuração `tnum` no Android. Fontes proporcionais param de deslocar o resto da linha quando um `1` vira um `8`. O NativeScript pode definir a fonte de novo na próxima mudança de estilo; o próximo roll aplica o recurso outra vez.

O roll usa os bounds da Label no momento em que começa. Quando a quantidade de dígitos muda, a largura da própria Label muda no próximo layout, o que desloca textos centralizados e alinhados à direita. Uma Label alinhada à esquerda com algarismos tabulares, ou com largura fixa, dá o resultado mais limpo.

## Altura automática dentro de StackLayout

Declare `rows="auto"` no `GridLayout` que contém a linha quando ela deve acompanhar a altura do texto. Um grid sem definição de linhas pode esticar sua linha implícita até a altura disponível, e um `StackLayout` horizontal pode repassar essa altura ao rótulo. `rollTo()` não acrescenta filhos ao layout: suas sobreposições nativas de desenho não determinam a altura medida da Label.

```vue
<StackLayout>
  <GridLayout rows="auto" columns="auto,auto,*,auto">
    <StackLayout orientation="horizontal">
      <Label ref="range" text="312" fontSize="40" minWidth="180" />
    </StackLayout>
    <Label col="1" text="mi" verticalAlignment="middle" />
    <Label col="3" text="78%" verticalAlignment="middle" />
  </GridLayout>
</StackLayout>
```

A largura reserva espaço para mudanças na quantidade de dígitos; a altura continua automática. A demo compara rótulos animados e estáticos com fontes de 40 e 64 DIP, incluindo números que crescem/encolhem e cancelamento. No iOS, também verifica se a sobreposição dos dígitos existe durante a reprodução e é removida depois.

A [investigação do modelo](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/model-motion-values.md) reproduziu um rótulo de 554 pt **antes** de chamar `rollTo()`. Acrescentar `rows="auto"` reduziu a altura para 48,7 pt antes e depois da chamada, com a mesma fonte Inter Display e sem altura fixa. Um rótulo estreito ainda pode mostrar diretamente o texto final quando os glifos antigos ou novos ficam truncados; reserve largura suficiente quando precisar do efeito de rolagem.

<Clip name="rolling-layout-ios" caption="Texto animado e estático mantêm alturas automáticas equivalentes durante mudanças de dígitos e cancelamento, no simulador iOS. Há largura reservada, sem altura fixa. Reprodução em tempo real." />

<Clip name="rolling-layout-android" caption="Texto animado e estático mantêm alturas automáticas equivalentes durante mudanças de dígitos e cancelamento, no emulador Android. Há largura reservada, sem altura fixa. Reprodução em tempo real." />

## Parada e mudanças

```ts
const roll = rollTo(balance, 2000, { format })
roll.stop()

await sequence([() => rollTo(score, 10), () => animate(badge, 'popIn')])
```

Retorna uma `Animation`: você pode usar `await`, ler `finished` ou chamar `stop()`. A conclusão nativa resolve com `true`. Parar deixa o texto final no lugar e resolve com `false`. Quando o texto não muda, a chamada resolve com `true` na hora. Iniciar outro `rollTo()` na mesma Label cancela o anterior e rola a partir do texto em que ele parou.

Unload, troca da view nativa e mudanças que o app faz no texto ou no estilo cancelam o roll e mantêm o que o app definiu. Um `formattedText` é substituído pelo texto simples rolado. Reduzir Movimento no iOS e animações desligadas no Android mostram o texto final imediatamente e resolvem com `true`. Mais de 256 posições alteradas mostram o texto final e resolvem com `false`.
