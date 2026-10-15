# Partículas e confete

## Confete

```ts
import { confetti } from '@rafaelaugusto/jolt'

const stopConfetti = confetti(button, {
  count: 80,
  colors: ['#facc15', '#ef4444', '#3b82f6'],
})
```

O confete sai para cima a partir do centro do alvo e cai sob gravidade. Ele é desenhado na janela do alvo, então as bordas arredondadas do botão e os recortes dos pais não o cortam. Não adiciona uma view interativa nem altera a aparência, as máscaras ou a área de toque do alvo.

A origem é capturada quando a explosão começa. Mover ou rolar o botão depois disso não desloca as partículas que já estão no ar. `count` é uma quantidade aproximada de emissão, não uma garantia de quantas partículas estarão visíveis: o Core Animation controla a emissão e a visibilidade. O padrão é `80`, com uma paleta de cinco cores.

A emissão dura 200 ms e cada partícula vive por 2200 ms. A camada é removida automaticamente depois disso. Chame `stopConfetti()` para removê-la imediatamente.

## Emissores contínuos

`particles()` adiciona um emissor à camada do próprio alvo. Ele acompanha os transforms e recortes dessa view e redimensiona a origem da emissão quando o layout muda.

```ts
import { particles } from '@rafaelaugusto/jolt'

const stopSnow = particles(scene, {
  source: 'top',
  angle: 90,
  rate: 30,
  velocity: 45,
  velocityRange: 15,
  spread: 30,
  size: 5,
  lifetime: 5000,
})

// Remove o emissor e suas partículas:
stopSnow()
```

Faíscas saem do centro em todas as direções:

```ts
particles(scene, {
  colors: ['#facc15', '#fb923c'],
  velocity: 120,
  velocityRange: 50,
  spread: 360,
  rate: 70,
  size: 3,
  lifetime: 1000,
})
```

Bolhas sobem a partir da base:

```ts
particles(scene, {
  shape: 'ring',
  source: 'bottom',
  colors: ['#67e8f9', '#a5f3fc'],
  velocity: 40,
  spread: 20,
  rate: 14,
  size: 18,
  lifetime: 5000,
})
```

Adicione `duration` para encerrar a emissão após um tempo em milissegundos. As partículas existentes terminam suas vidas antes da remoção da camada. O corte de emissão roda no Core Animation mesmo com o JavaScript ocupado; a limpeza final dos recursos pode esperar a thread ficar livre.

| Opção                        | Padrão        | Significado                                                                                  |
| ---------------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| `colors`                     | `['#ffffff']` | Strings de cores do NativeScript, dividindo igualmente a taxa de emissão.                    |
| `shape`                      | `'circle'`    | `'circle'`, `'rectangle'` ou `'ring'`.                                                       |
| `source`                     | `'center'`    | Um ponto central ou uma linha no topo (`'top'`) ou na base (`'bottom'`).                     |
| `rate`                       | `20`          | Total de partículas por segundo, somando todas as cores.                                     |
| `lifetime`                   | `3000`        | Vida de cada partícula em milissegundos.                                                     |
| `size`                       | `6`           | Maior lado em DIPs.                                                                          |
| `velocity` / `velocityRange` | `60` / `0`    | Velocidade inicial e variação aleatória nativa, em DIPs por segundo.                         |
| `angle` / `spread`           | `-90` / `30`  | Direção e cone de emissão em graus. Direita é `0`, baixo é `90` e cima é `-90`.              |
| `gravity`                    | `0`           | Aceleração para baixo em DIPs por segundo ao quadrado; valores negativos aceleram para cima. |
| `spin` / `spinRange`         | `0` / `0`     | Rotação e variação aleatória nativa, em graus por segundo.                                   |
| `fadeOut`                    | `true`        | Reduz a opacidade ao longo da vida da partícula.                                             |
| `duration`                   | Omitido       | Tempo de emissão em milissegundos; omitido significa contínuo.                               |

Os valores precisam ser finitos. Os limites são 1–32 cores, tamanho de 1–128 DIPs, vida de 1–60000 ms, taxa de 0–10000 partículas por segundo e população viva estimada (`rate × lifetime / 1000`) de no máximo 10000. Velocidade e sua variação aceitam 0–10000, gravidade −10000–10000, ângulo −360–360, abertura 0–360, rotação −3600–3600 e sua variação 0–3600. Uma duração finita precisa ser positiva e caber, com a vida das partículas mais 50 ms, em um timer de 32 bits. O confete aceita uma contagem inteira de 0 a 10000. Contagem ou taxa zero remove o efeito anterior do mesmo tipo sem iniciar outro.

## Limpeza e compatibilidade

As duas funções aceitam uma view ou um ref que contenha uma e retornam uma função de limpeza que pode ser chamada mais de uma vez. Uma explosão de confete e um emissor podem coexistir na mesma view. Iniciar outro efeito do mesmo tipo substitui o anterior; a função de limpeza antiga não remove o novo. `stop(view)` controla as animações de `animate()`; use a função retornada para partículas.

Chamadas feitas antes do carregamento esperam por uma janela e um layout com tamanho maior que zero. Descarregar a view, trocar a view nativa ou a janela, ou reduzir o tamanho de um alvo ativo a zero remove o efeito. Descarregar inclui colocar o app em segundo plano. Os efeitos não se repetem automaticamente ao carregar de novo; inicie outro quando fizer sentido. Guarde a função de limpeza e chame-a ao desmontar o componente.

Esta implementação é **só para iOS**, usando `CAEmitterLayer` sem callback JavaScript por frame. No Android, a função de limpeza não faz nada. Reduzir Movimento impede novos efeitos; ativá-lo com um emissor ativo remove esse emissor sem repeti-lo depois.
