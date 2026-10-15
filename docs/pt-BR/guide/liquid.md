# Imagens com movimento líquido

`liquid()` aplica uma deformação lenta e contínua a uma `Image` no iOS. As partes da textura se movem umas em relação às outras, mantendo o contorno da imagem fixo.

```ts
import { liquid } from '@rafaelaugusto/jolt'

const flow = liquid(orb, { intensity: 0.9, duration: 7200 })

flow.pause() // congela a forma atual
flow.resume() // continua a partir dessa forma
flow.stop() // remove o efeito e restaura a imagem original
```

## Opções

| Opção       | Padrão | Significado                                                               |
| ----------- | ------ | ------------------------------------------------------------------------- |
| `intensity` | `0.7`  | Intensidade da deformação entre `0` e `1`. Zero mantém a imagem original. |
| `duration`  | `8000` | Milissegundos por ciclo contínuo. Precisa ser finito e maior que zero.    |

O handle controla apenas este efeito. Transforms e opacidade continuam com `animate()`; parar essas animações não para a deformação. Chame `flow.stop()` ao descartar seu componente. Outra chamada de `liquid()` na mesma imagem substitui o efeito anterior. Opções inválidas preservam o efeito em execução.

## Renderização e ciclo de vida

O Jolt prepara um campo de deslocamento periódico numa malha de textura de 24 × 24. O SpriteKit interpola 64 etapas por ciclo usando uma action nativa em repetição. A GPU deforma os pixels; não há callback JavaScript por frame, temporizador, compilação de shader customizado nem sequência de imagens.

O renderizador nativo fica dentro da view da imagem. Ele preserva transparência, acessibilidade, máscaras, transforms e o modo de stretch (`aspectFit`, `aspectFill`, `fill` ou `none`). Mudanças de layout redimensionam o renderizador sem reiniciar o ciclo. O modelo do NativeScript mantém a fonte original.

A pausa congela a deformação atual. A inatividade do app também pausa a renderização; ao voltar, o efeito continua, exceto se você o pausou explicitamente. Descarregar a view libera cena, textura e action; carregar recria o efeito. Trocar a fonte reconstrói a textura. Reduzir Movimento ou ocultar a imagem remove o renderizador e mostra a imagem original; desativar essa opção ou mostrar a imagem recria o efeito.

## Conteúdo suportado

O helper aceita uma `Image` do NativeScript ou sua referência de template. Ele usa uma única imagem raster estática. Imagens animadas, imagens de template/SF Symbols, imagens ausentes e imagens acima de 16 megapixels mantêm a renderização original. No Android, retorna um handle inativo sem acessar APIs do iOS.

O efeito deforma a arte existente. Ele não gera novas dobras nem simula um fluido e não é uma API genérica de shader para qualquer view. Esse trabalho continua separado na [#35](https://github.com/rafaelaugustos/jolt/issues/35).

A [tela Voice do assistente](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/assistant/Voice.vue) mostra o uso completo com pausa, retomada e limpeza ao desmontar.
