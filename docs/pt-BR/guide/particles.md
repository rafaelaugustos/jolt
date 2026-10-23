# Partículas e confete

## Confete

<Clip name="particles" caption="A demonstração original de confete no iOS, emitido a partir de um ponto." />

```ts
import { confetti } from '@rafaelaugusto/jolt'

const stopConfetti = confetti(button, {
  count: 80,
  colors: ['#facc15', '#ef4444', '#3b82f6'],
})
```

O confete sai para cima a partir do centro do alvo e cai sob gravidade. Ele é desenhado na janela do alvo, então as bordas arredondadas do botão e os recortes dos pais não o cortam. Não adiciona uma view interativa nem altera a aparência, as máscaras ou a área de toque do alvo.

A origem é capturada no início da explosão, em coordenadas da janela. Mover ou rolar o botão depois disso não desloca as partículas que já estão no ar. Outra explosão captura a nova posição, incluindo rolagem e transforms. `count` é uma quantidade aproximada de emissão, não uma garantia de quantas partículas estarão visíveis: recortes, agendamento nativo e tempo de vida afetam a visibilidade. O padrão é `80`, com uma paleta de cinco cores. As trajetórias aleatórias podem variar entre plataformas.

A emissão dura 200 ms e cada partícula vive por 2200 ms. A camada é removida automaticamente depois disso. Chame `stopConfetti()` para removê-la imediatamente.

## Emissores contínuos

`particles()` adiciona um emissor acima do conteúdo do alvo: uma camada no iOS e um drawable no `ViewOverlay` no Android. Ele acompanha os transforms e a rolagem do alvo e redimensiona a origem dos novos nascimentos sem reiniciar as partículas existentes. O Android recorta o drawable nos limites do alvo e no `borderRadius` uniforme; o iOS segue o recorte da camada que hospeda o emissor. Use um layout como alvo quando as partículas precisarem cobrir uma cena, em vez de um único controle.

O confete usa a camada/overlay superior da janela, podendo atravessar o botão e os layouts pais. Continua limitado àquela janela e abaixo de outras janelas do sistema. Nenhuma implementação adiciona um alvo de toque ou elemento de acessibilidade; os controles sob o efeito continuam funcionando.

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

Adicione `duration` para encerrar a emissão após um tempo em milissegundos. As partículas existentes terminam suas vidas antes da remoção dos recursos nativos:

```ts
particles(scene, {
  shape: 'rectangle',
  colors: ['#facc15', '#fb923c'],
  rate: 90,
  duration: 700,
  lifetime: 1400,
  velocity: 100,
  gravity: 130,
  spinRange: 240,
})
```

O corte é nativo nas duas plataformas. O iOS usa Core Animation e um timer JS para a limpeza final. O Android usa relógio monotônico e limpeza nativos; bloquear sua thread de UI atrasa o desenho e a entrega de callbacks, mas não estende a emissão nem o tempo de vida. Ao voltar, ele descarta nascimentos já expirados e remove os efeitos concluídos. Efeitos cancelados ao colocar o app em segundo plano não acumulam emissões pendentes.

<Clip name="particles-android" caption="Emulador Android 16 / API 36: toques reais através de neve, anéis e confete na janela; faíscas, retângulos finitos, redimensionamento e movimento reduzido. Desenho nativo na thread de UI em tempo real, sujeito a pausas quando essa thread está ocupada." />

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

Chamadas feitas antes do carregamento esperam por uma janela e um layout com tamanho maior que zero; o relógio da emissão só começa após a conexão. Descarregar a view, trocar a view nativa ou a janela, desconectar o alvo nativo Android ou reduzir o tamanho de um alvo ativo a zero remove o efeito. Colocar o app em segundo plano cancela explicitamente os dois efeitos. Eles não se repetem automaticamente ao recarregar ou voltar ao primeiro plano. Guarde a função de limpeza e chame-a ao desmontar o componente.

Use um motion scope existente para cuidar da limpeza:

```ts
const scope = motionScope() // useMotionScope() no Vue
const remove = scope.use(() => particles(scene, { source: 'top', angle: 90 }))
// remove() ou scope.dispose() remove o emissor imediatamente.
```

`scope.use()` recebe uma fábrica de assinatura: a suspensão remove o efeito e uma retomada explícita do scope executa a fábrica para criar outro. Não retoma as partículas antigas. No Vue, crie o efeito depois que o ref estiver montado e deixe `useMotionScope()` descartá-lo ao desmontar.

## Plataformas e tempo

| Recurso                                                                       | iOS                               | Android                                    |
| ----------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------ |
| Círculos, retângulos e anéis; origens no centro/topo/base                     | `CAEmitterLayer` nativo           | Simulação Java e drawable `Canvas` nativos |
| Emissão contínua, finita e confete                                            | Suportado                         | Suportado                                  |
| Cores/alpha, tamanho, velocidade/variação, gravidade, rotação/variação e fade | Suportado                         | Suportado                                  |
| Confete na janela e passagem de toques                                        | Suportado                         | Suportado                                  |
| Simulação ou callback de desenho JS por frame                                 | Nenhum                            | Nenhum                                     |
| Limpeza no segundo plano/unload e mudança de movimento reduzido               | Cancela; sem repetição automática | Cancela; sem repetição automática          |

A implementação Android vem com o Jolt, usa APIs da plataforma e não adiciona plugin opcional, dependência externa ou permissão. Recompile o app Android após atualizar; uma atualização só de JS não instala as classes Java nem os metadados da ponte nativa. Os requisitos existentes de NativeScript permanecem iguais.

Reduzir Movimento impede novos efeitos; ativá-lo por `configure()` durante um efeito o remove. O Android também observa nativamente a escala de animação do sistema: **escala 0 cancela/impede efeitos mesmo com `reducedMotion: 'never'`**. Escalas positivas como **0,5 e 2 mantêm as durações e unidades físicas no tempo real**, assim como `timeScale`, que não altera o tempo desse efeito. Mudar a configuração não deixa um emissor finito rodando para sempre. Restaurar o movimento exige uma nova chamada.

O Android pré-aloca no máximo 10.000 posições de partículas por emissor, reutilizando arrays e recursos de desenho. Emissores contínuos alocam `ceil(rate × lifetime / 1000)` posições; emissores finitos usam somente a menor janela entre emissão e vida. Cada posição usa 36 bytes de estado primitivo, cerca de 352 KiB no limite, além de pequenos objetos nativos fixos e buffers de diagnóstico. O loop não cria um callback JS ou objeto Java para cada partícula/frame. A limpeza libera arrays, drawable, callbacks de frame/prazo e observador de configuração.

O desenho é nativo, na **thread de UI**. No ASUS físico API 26, a neve comum (30 nascimentos/s, pico de 121 nos quatro segundos medidos) teve intervalo p95 entre callbacks de 16,73 ms; o teste de estresse com 10.000 partículas chegou a 167,05 ms. No emulador API 36, os valores foram 16,67 ms e 33,33 ms. São intervalos observados do Choreographer, sem garantia de GPU/apresentação nem comparação de capacidade entre dispositivos. Use populações modestas em cenas interativas; o teto de 10.000 limita o armazenamento. Ambientes, custos de CPU do desenho, tolerâncias e resultados brutos estão no [relatório de validação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/particles.md).

<Clip name="particles-android-device" caption="ASUS_Z017DC físico, Android 8 / API 26: toques reais através dos efeitos ativos, emissão contínua e finita, redimensionamento e movimento reduzido. Reprodução nativa na thread de UI, em tempo real; as medições de estresse são separadas desta demonstração comum." />

<Clip name="particles-ios" caption="Simulador iPhone 17, iOS 26: mesma API de partículas, todas as formas/origens, passagem de toques, redimensionamento e movimento reduzido ao vivo, exercitados com toques do XCTest. A gravação anterior do iOS foi preservada acima." />
