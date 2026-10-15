# Indicadores de carregamento

Adicione um indicador de carregamento a uma view vazia:

```ts
import { loader } from '@rafaelaugusto/jolt'

const stopLoading = loader(slot, {
  style: 'dots',
  color: '#71717a',
  size: 48,
  duration: 1200,
})

stopLoading() // quando o conteúdo estiver pronto
```

O indicador fica centralizado no alvo. Um `CAReplicatorLayer` repete uma única camada animada: três bolinhas pulsando, cinco barras de equalizador ou doze bolinhas com variação de opacidade ao redor de um anel. O Core Animation executa o loop sem callbacks JavaScript por frame nem views extras do NativeScript.

## Opções

| Opção      | Padrão      | Significado                                                               |
| ---------- | ----------- | ------------------------------------------------------------------------- |
| `style`    | `'dots'`    | `'dots'`, `'bars'` ou `'ring'`.                                           |
| `color`    | `'#71717a'` | Uma string de cor do NativeScript.                                        |
| `size`     | `48`        | Largura e altura máximas em DIPs. Diminui para caber nos limites do alvo. |
| `duration` | `1200`      | Milissegundos por ciclo.                                                  |

Tamanho e duração precisam ser números finitos positivos. Opções inválidas lançam um erro antes de substituir um loader existente. O indicador acompanha mudanças de layout sem reiniciar a animação.

O alvo precisa ter largura e altura maiores que zero; o loader não define seu tamanho intrínseco. Ele adiciona uma camada sem alterar conteúdo, máscaras, transformações ou áreas de toque existentes. Um `GridLayout` vazio serve como espaço para o indicador. O recorte existente continua valendo.

```vue
<GridLayout
  ref="slot"
  width="80"
  height="64"
  accessibilityLabel="Carregando resultados"
/>
```

Defina um rótulo acessível ou mostre um status de carregamento próximo ao indicador. Camadas decorativas não criam elementos de acessibilidade, e o Jolt preserva as configurações de acessibilidade do alvo.

## Limpeza e ciclo de vida

`loader()` aceita uma view ou uma ref que contenha uma e retorna uma função de limpeza idempotente. Iniciar outro loader no mesmo alvo substitui o anterior. Uma função de limpeza antiga não remove o substituto. Use a função retornada para parar o loader; `stop(view)` controla as animações de `animate()`.

Chamadas feitas antes do carregamento esperam uma janela e um layout com tamanho maior que zero. O evento `unloaded`, inclusive ao colocar o app em segundo plano, remove as camadas nativas e o observador de Reduzir Movimento. O evento `loaded` recria o indicador. Um alvo com tamanho zero remove o efeito temporariamente, até que exista um layout utilizável.

A limpeza explícita também remove os listeners e impede qualquer reinício. Guarde a função e chame quando o componente responsável for desmontado.

## Reduzir Movimento e plataformas

Com Reduzir Movimento ativado, as bolinhas, barras ou o anel continuam visíveis, sem animação. O loader acompanha mudanças nessa preferência enquanto está carregado e retoma a animação se ela for desativada.

Esta implementação é **somente para iOS**. No Android, retorna uma função de limpeza sem efeito e não desenha um indicador.
