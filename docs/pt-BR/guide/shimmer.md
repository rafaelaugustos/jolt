# Shimmer

Passe uma faixa de luz pelo placeholder enquanto o conteúdo carrega:

<Clip name="shimmer" caption="Shimmer sobre placeholders de carregamento." />

```ts
import { shimmer } from '@rafaelaugusto/jolt'

const stopShimmer = shimmer(placeholder)
// Quando o conteúdo estiver pronto:
stopShimmer()
```

Recebe uma view ou um ref que contenha uma. Aplique em um container para passar a faixa por todas as formas do skeleton juntas. A máscara varia a opacidade, então as cores das formas e do fundo determinam o contraste; formas claras em um fundo escuro produzem uma faixa luminosa.

## Tempo

```ts
const stopShimmer = shimmer(placeholder, { duration: 2000 })
```

`duration` é o tempo em milissegundos de cada passagem, incluindo a entrada e a saída da faixa. O padrão é `1500`. Precisa ser um número positivo e finito.

No iOS, uma máscara `CAGradientLayer` anima suas `locations` pelo Core Animation. A repetição é nativa, sem callback JavaScript por frame. Mudanças de layout redimensionam a máscara sem reiniciar a passagem.

## Limpeza

A função retornada remove o shimmer e seus listeners. Pode chamá-la mais de uma vez. Iniciar outro shimmer na mesma view substitui o anterior; a função de limpeza antiga não para o efeito novo.

Chamadas feitas antes do carregamento esperam pela view e por um layout com tamanho maior que zero. Descarregar a view remove a máscara nativa e o observer de acessibilidade; carregá-la novamente inicia outra passagem. Isso também cobre a ida para segundo plano e a volta ao app. Chame a função retornada para encerrar o shimmer de vez, inclusive enquanto a view estiver descarregada.

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { shimmer } from '@rafaelaugusto/jolt'

const placeholder = ref()
let stop: (() => void) | undefined

onMounted(() => {
  stop = shimmer(placeholder.value)
})
onUnmounted(() => stop?.())
</script>

<template>
  <StackLayout ref="placeholder" />
</template>
```

Máscaras existentes, incluindo clip paths do NativeScript, continuam no lugar. A limpeza remove só o gradiente do Jolt. Shimmer não muda a opacidade, o transform, a interação ou as propriedades de acessibilidade da view. Use `stopShimmer()` para pará-lo; `stop(view)` controla as animações do `animate()`.

## Compatibilidade

Esta primeira implementação é **só para iOS**. No Android, o placeholder permanece igual e a função de limpeza não faz nada.

Com Reduzir Movimento ativado, o placeholder fica estático na opacidade normal. Mudar essa preferência durante o shimmer remove ou retoma a faixa automaticamente.
