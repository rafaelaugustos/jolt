# Composição portável

APIs candidatas à próxima versão, acompanhadas em #424–#427, #386 e #385. Estas adições Web **não estão na RC.12 publicada**. As implementações nativas já existem; definições, políticas e ciclo de vida compartilhados ganham adaptadores de navegador. Use o tarball do PR até a publicação de uma versão que as inclua.

## Recursos retidos {#lifecycle}

`retain(resource)` e `resource(factory)` mantêm recursos até release, reset ou descarte, inclusive playbacks concluídos. `release(resource)` destrói apenas recursos pertencentes ao scope. A suspensão pausa recursos compatíveis e preserva uma pausa manual anterior; recursos estáticos retidos permanecem. `add()` mantém seu ciclo transitório e aceita novamente um recurso já retido pelo mesmo scope sem duplicá-lo. Converter um recurso transitório em retido é rejeitado; escolha o ciclo ao adotá-lo. Factories limpam recursos novos quando a adoção falha.

O `useShape` do Vue usa o adaptador SVG existente. `.current` fica disponível após a montagem; o callback ref também aceita componente com um HTMLElement raiz. KeepAlive pausa e retém o desenho; desmontagem real ou troca de ref o descarta. `{ runtime }` opcional é emprestado. `useWebMotion(ref).resource(setup)` oferece esse ciclo retido; `.use(setup)` continua recriando na ativação. `unload: 'pause'` preserva o shape removido no mesmo documento; `motion.shape` normalmente descarta ao remover. Release ou descarte explícito do runtime sempre destrói o recurso.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const drawing = scope.resource(() =>
  motion.shape(host, {
    d: 'M10 50 L50 10 L90 50 Z',
    viewBox: [0, 0, 100, 100],
    stroke: '#7858db',
    unload: 'pause',
  }),
)
scope.suspend()
scope.resume()
scope.release(drawing)
scope.dispose()
```

```vue
<script setup lang="ts">
import { useShape } from '@rafaelaugusto/jolt/web/vue'
const drawing = useShape({
  d: 'M10 50 L50 10 L90 50 Z',
  viewBox: [0, 0, 100, 100],
  stroke: '#7858db',
})
</script>
<template><div :ref="drawing.ref" style="width: 120px; height: 120px" /></template>
```

<Clip name="composition-lifecycle-web" :width="900" caption="Recursos retidos: Chromium no macOS: controles reais e reprodução no navegador." />

<Clip name="composition-resources-ios" caption="Recursos retidos: Simulador iOS 26.2: demo nativa real e interação por XCTest." />

## Coordenação de comportamentos {#behaviors}

Nativo e Web usam a mesma política de execução exclusiva: prioridade, `when`, `blocks`, rejeição/substituição de prioridades iguais e ação explícita de repouso. Prioridade maior interrompe, exceto quando a ação atual a bloqueia; coordenadores separados permanecem independentes. Cada execução possui um scope filho. Use `wait`, `checkpoint` e `guard` no trabalho assíncrono para impedir alterações tardias após cancelamento. Uma Promise arbitrária não pode ser cancelada à força. Background e pausa manual suspendem o playback; conclusão/cancelamento restauram o repouso, `stop()` cancela sem restaurar e o descarte impede novos pedidos. O estado de domínio pertence ao app.

```ts
const actions = scope.motionBehaviors(
  {
    rest: { priority: -1, run: ({ scope }) => scope.animate(card, { x: 0 }).finished },
    touch: {
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { x: -70 }, { duration: 2000 }).finished)
      },
    },
    dress: { priority: 2, run: ({ scope }) => scope.animate(card, { x: 70 }).finished },
    eat: {
      priority: 3,
      blocks: ['touch', 'dress'],
      run: ({ scope }) => scope.animate(card, { scale: [1, 1.2, 1] }).finished,
    },
  },
  { rest: 'rest' },
)
actions.request('touch')
actions.request('dress')
```

<Clip name="composition-behaviors-web" :width="900" caption="Coordenação de comportamentos: Chromium no macOS: controles reais e reprodução no navegador." />

<Clip name="composition-behaviors-ios" caption="Coordenação de comportamentos: Simulador iOS 26.2: demo nativa real e interação por XCTest." />

## Texto com gradiente {#gradient-text}

As duas plataformas aceitam 2–8 cores, stops ordenados em 0..1, ângulo em graus no sentido horário a partir da direção esquerda-direita e largura de brilho em (0,1]. Nativo aceita ColorValue; Web aceita strings CSS de cor. `play()` retorna um playback com interrupção, pausa e cancelamento; `stop()` remove o brilho móvel e mantém o preenchimento estático. Movimento reduzido preserva esse preenchimento.

O navegador pinta o texto original selecionável com recorte CSS de fundo; aceita HTMLElement de texto simples sem elementos filhos. Preserva o nome acessível e restaura estilos próprios sem sobrescrever mudanças posteriores do app. Cores forçadas ou falta de suporte ao recorte usam texto legível comum e cancelam o brilho decorativo. Não combine gradiente de fundo e gradiente de texto no mesmo alvo. O nativo pinta glifos reais; recorte, custo de repintura e pixels diferem no navegador.

```ts
const title = scope.gradientText(heading, {
  colors: ['#7858db', '#197a88'],
  angle: 10,
  sheen: { color: '#ffffffbf', width: 0.3, direction: 'right' },
})
const playback = title.play({ duration: 1800, ease: 'linear' })
title.suspend()
title.resume()
title.stop()
```

<Clip name="composition-text-web" :width="900" caption="Texto com gradiente: Chromium no macOS: controles reais e reprodução no navegador." />

<Clip name="composition-text-ios" caption="Texto com gradiente: Simulador iOS 26.2: demo nativa real e interação por XCTest." />

## Rigs 2D articulados {#rig}

A definição compartilhada aceita 1–64 partes e `x`, `y`, `scaleX`, `scaleY`, `rotate`; rotação usa graus e translação usa DIPs nativos ou pixels CSS. Pivôs são frações da caixa com borda. Encaixes aceitam frações relativas ou unidades lógicas locais (`dip` conserva o nome nativo na Web). A mistura é relativa ao repouso; pesos cuja soma supera um são normalizados. Rotações sem limite percorrem o caminho mais curto; limites contêm as amostras da mola, inclusive overshoot.

Na Web, partes precisam ser caixas 2D conectadas na hierarquia DOM direta declarada, com pais posicionados como `offsetParent`; zoom CSS, perspectiva, 3D e propriedades individuais de transformação são rejeitados. Acessórios são filhos diretos sem outro dono na parte do encaixe. Transformações dos pais nativos e do DOM os carregam. `point()` retorna o encaixe nas coordenadas da caixa com borda do pai raiz; chame `refresh()` após alterar offsets de layout. Redimensionamento atualiza os encaixes. `attach` substitui partes; poses Web compartilham um playback, portanto liberar uma parte cancela esse grupo. O descarte restaura apenas canais ainda pertencentes ao rig. Preserve rótulos semânticos para imagens significativas; rigs não fornecem hit testing nem semântica acessível.

```ts
const character = scope.rig2d(
  {
    parts: {
      body: { rest: { rotate: 0 } },
      hand: {
        parent: 'body',
        pivot: { x: 0.5, y: 0.1 },
        rest: { rotate: 0 },
        rotation: [-70, 70],
      },
    },
    poses: {
      rest: {},
      wave: { hand: { rotate: -55 } },
      reach: { hand: { rotate: 110 } },
    },
    sockets: { grip: { part: 'hand', x: 0.5, y: 0.85, units: 'relative' } },
  },
  { body, hand },
)
character.accessory('grip', flower)
character.to('wave', 'bouncy')
character.blend([
  { pose: 'wave', weight: 0.5 },
  { pose: 'reach', weight: 0.5 },
])
```

<Clip name="composition-rig-web" :width="900" caption="Rigs 2D articulados: Chromium no macOS: controles reais e reprodução no navegador." />

<Clip name="composition-rig-ios" caption="Rigs 2D articulados: Simulador iOS 26.2: demo nativa real e interação por XCTest." />

## Helpers e preferência de movimento {#preferences}

A entrada Web reexporta os helpers existentes `cubicBezier`, `origamiSpring`, `springs` e `presets`, usando o mesmo solver. `motion.reducedMotion()` lê a preferência efetiva daquele documento/runtime, incluindo configuração `user`, `always` e `never`. `onReducedMotion()` observa mudanças sem polling nem callback inicial e retorna uma função de cancelamento da assinatura. Descartar o runtime encerra a observação.

O `useReducedMotion(runtime?)` do Vue retorna uma ref somente leitura. Sem runtime, começa em false no SSR e assina após montar; com runtime emprestado, lê esse runtime. KeepAlive remove a assinatura na desativação e sincroniza novamente na ativação. Só descarta o runtime que criou. Não há singleton de preferência entre requisições. Prefira o observador do runtime quando a configuração do app puder substituir a preferência do sistema.

```ts
import { cubicBezier, origamiSpring, springs, presets } from '@rafaelaugusto/jolt/web'
const current = motion.reducedMotion()
const unsubscribe = motion.onReducedMotion((reduced) => updatePreference(reduced))
scope.retain(unsubscribe)
scope.animate(
  card,
  { x: [0, 70, 0] },
  { duration: 1200, ease: cubicBezier(0.25, 0.1, 0.25, 1) },
)
// Vue: import { useReducedMotion } from '@rafaelaugusto/jolt/web/vue'
// const reduced = useReducedMotion(motion)
```

<Clip name="composition-preferences-web" :width="900" caption="Helpers e preferência de movimento: Chromium no macOS: controles reais e reprodução no navegador." />

<Clip name="composition-text-ios" caption="Helpers e preferência de movimento: Simulador iOS 26.2: demo nativa real e interação por XCTest." />

## Sensores vetoriais {#sensors}

Os seis nomes canônicos são aceitos. `rotation` fornece radianos relativos e quaternion; `acceleration` é aceleração própria com gravidade (m/s², cerca de +9,8 em Z com a tela para cima); `linearAcceleration` exclui gravidade (m/s²); `gravity` aponta para baixo (linear menos própria); `gyroscope` usa radianos/s na convenção da mão direita, mapeados de beta/gamma/alpha. `magneticField` conserva a unidade µT, mas retorna `unavailable`, backend `none`, motivo `unsupported-kind`; DeviceMotion não fornece vetor magnético, que não é inferido da orientação.

É necessário contexto seguro, suporte do navegador/dispositivo e política de permissão compatível. A solicitação de permissão ocorre apenas em `requestPermission()` explícito por ação do usuário. Disponibilidade exige uma amostra finita completa daquele tipo; valores nulos/parciais não viram zeros. API ausente, negação e timeout sem dados aparecem em `snapshot()`. As fontes compartilham um listener por evento/documento e só executam com demanda, visibilidade e sem pausa. Coordenadas de interface se ajustam à rotação da tela; coordenadas do dispositivo permanecem canônicas. `interval` limita leituras entregues (5–1000 ms ou `auto`), não a taxa do hardware. Timestamps são monotônicos do navegador, não timestamps nativos do sensor.

Esta rodada valida renderização real no navegador com **eventos injetados** e a prévia nativa no simulador. Entrega e precisão dos sensores no navegador em aparelho físico permanecem pendentes em #385. Consulte [Device Orientation and Motion](https://www.w3.org/TR/orientation-event/) e os [limites de disponibilidade de Magnetometer](https://www.w3.org/TR/magnetometer/).

```ts
const sensor = scope.sensor('gyroscope', { coordinates: 'interface', interval: 50 })
// Invoke directly from a click/tap handler:
await sensor.requestPermission()
scope.bind(card, { rotate: scope.map(sensor.z, [-Math.PI, Math.PI], [-45, 45]) })
console.log(sensor.snapshot())
```

<Clip name="composition-sensors-web" :width="900" caption="Chromium no macOS: eventos DeviceMotion explicitamente injetados, pausa/retomada e indisponibilidade magnética. Sem medição de sensor físico." />

<Clip name="composition-sensors-ios" caption="Simulador iOS 26.2: prévia vetorial nativa e controles de ciclo de vida. Os dados da prévia não comprovam disponibilidade de sensores físicos." />

As gravações são evidência funcional. Não comprovam redução de CPU/PSS, precisão de hardware nem renderização independente de JavaScript. Os [contratos nativos](./native-composition) continuam disponíveis; o [relatório de validação e reprodução](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/portable-composition.md) registra a aceitação e os limites pendentes.
