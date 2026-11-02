# Runtime Web finito

**Também na RC.7:** [escopos, ponteiro/viewport e configuração contínua no Vue](./web-lifecycle), além de [geometria de overlays, elementos compartilhados, receitas e diagnóstico](./web-interactions). A adoção no Mavis permanece separada.

**Desde a RC.7:** [cores, bordas, pintura contínua, tamanho real, FLIP e cenas com seek](./web-visual) ampliam este runtime. As APIs Web continuam experimentais; a paridade completa segue na [#236](https://github.com/rafaelaugustos/jolt/issues/236).

Desde a **0.1.0-rc.5**, a entrada experimental `@rafaelaugusto/jolt/web` usa o compilador portátil do Jolt e WAAPI diretamente em elementos HTML, independentemente de Vue, React ou NativeScript. Veja a [instalação](./install#experimental-web-candidate). O Mavis concluiu a migração inicial de press/reveal e o exemplo compartilhado da aplicação; a adoção dos novos recursos Web continua [no Mavis](https://github.com/getcortexlabs/mavis-ui/issues/191).

A RC.6 inclui [movimento contínuo na Web](./web-dynamic), com valores, followers e drag/snap, além de [mapeamentos numéricos, atualização de geometria e scroll vertical](./web-support). As APIs Web continuam experimentais.

A entrada por ponteiro e teclado está em [Press na Web](./web-press); a gravação abaixo permanece como referência do runtime finito.

<Clip name="web-runtime-chromium" :width="720" caption="Chromium 156 no macOS arm64, playback e cliques reais na velocidade original: movimento com opacidade, interrupção parcial, escala da aplicação com contribuição de pressão, repetição reversa, pausa, seek, retomada e movimento reduzido. Os botões exercitam a contribuição; o reconhecimento completo de ponteiro/teclado fica na #283." />

## Movimento suportado {#supported-motion}

`x` e `y` usam pixels CSS, `rotate` usa graus, `scaleX`/`scaleY` usam fatores e `opacity` fica limitada a 0–1. `scale` expande para os dois eixos; um eixo explícito prevalece sobre o atalho. Springs com destino definido, tweens, keyframes numéricos, presets internos/personalizados compatíveis, transições por propriedade, delay e stagger usam o compilador existente. As receitas numéricas nativas são compartilhadas sem importar o runtime nativo.

Cada runtime pertence a um documento. Configuração, presets, tokens de ownership, efeitos e cleanup ficam nesse contexto. Dois contextos não podem controlar simultaneamente o mesmo elemento. A entrada Web pode ser importada sem DOM; criar o runtime exige um documento ativo com WAAPI. Não há instalação global de driver.

```ts
// Entrada experimental do candidato empacotado localmente.
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
motion.set(card, { scale: 1.1 })
const move = motion.animate(card, { x: 240, opacity: 1 }, 'snappy')
motion.animate(card, { scale: 0.96 }, { layer: 'press', duration: 120 })
// A escala visual é 1.056. Soltar apenas press preserva a escala da aplicação.
motion.animate(card, { scale: 1 }, { layer: 'press', duration: 120 })
move.pause()
move.progress = 0.5
move.play()
const completed = await move.finished
motion.release(card)
motion.dispose()
```

## Controles, composição e cleanup {#controls-and-cleanup}

Cada chamada controla seus canais lógicos e um relógio de origem. Translação/rotação se somam; escala/opacidade se multiplicam. Um efeito visual composto por superfície reproduz o resultado. Substituir `x` preserva os outros canais e as contribuições privadas. O handle antigo não retoma os canais substituídos, mesmo ao fazer seek ou concluir depois. Falhas de preparação ou de orçamento de keyframes preservam o playback anterior.

`progress` abrange a timeline finita inteira, incluindo delays e repetições. Seek pausado para `1` continua pausado e permite voltar; a reprodução conclui ao retomar. `stop()` mantém os valores amostrados atuais e resolve `finished` como `false`. A conclusão natural mantém os valores finais e resolve como `true`; uma substituição parcial faz a chamada anterior resolver como `false` quando seus canais restantes terminam. Handles encerrados permanecem encerrados. Efeitos e relógios são removidos na conclusão; os valores finais ficam até `release()` restaurar os estilos inline originais. Alterações inline externas são preservadas na liberação.

Targets removidos são liberados automaticamente, inclusive dentro de shadow roots. Adapters de framework ainda devem liberar as superfícies no fim de seu lifecycle. `dispose()` também remove observers, listeners de preferência e frames pendentes. Uma timeline de documento não resolvida mantém a pose até a ativação; `ready` resolve na ativação ou no descarte. Playback finito normal não usa loop de frames da biblioteca nem escrita JavaScript de estilos por frame.

## Tempo e movimento reduzido {#timing-and-reduced-motion}

A interrupção projeta o início resolvido do relógio de origem no relógio de performance do documento no instante do comando. O mesmo timestamp ancora a composição e a nova reprodução. Posição e velocidade vêm do modelo de origem. Movimento pausado ou pendente transfere velocidade zero. Isso evita usar o tick de renderização antigo durante uma tarefa longa. Apresentação do browser e precisão numérica da curva são verificadas separadamente, incluindo interrupção a 2.000 px/s após uma tarefa JavaScript ocupada no WebKit.

`reducedMotion: 'user'` acompanha a preferência ao vivo do navegador. Ativar a redução conclui os canais ativos de transform nos valores finais; opacidade continua. Desativar permite movimentos futuros sem repetir os canais concluídos. `'always'` e `'never'` substituem a preferência por contexto. `timeScale` afeta tracks futuras. Repetições finitas normais/reversas aceitam 0–1.000 repetições; playback infinito fica fora desta etapa. O orçamento padrão é 6.001 keyframes preparados por track/superfície composta, configurável de 2 a 60.001; ultrapassá-lo rejeita a transação.

## Política da superfície e limites {#surface-policy-and-limits}

O runtime controla `transform` e `opacity` de uma caixa HTML montada e transformável. A ordem é `base 2D estática × translate × rotate × scale`, preservando `transform-origin`. Transforms CSS individuais, bases 3D, animações/transições existentes e estilos de movimento inline com `!important` não são suportados. Libere e recrie antes de mudanças CSS externas; alterações arbitrárias de stylesheet/variáveis CSS não são monitoradas. Use uma superfície interna dedicada quando outro código controla o estilo do elemento externo.

Mudanças suportadas de tamanho e pivô 2D podem preservar esse ownership com a [API de geometria da RC.6](./web-support#geometry); outras mudanças externas continuam exigindo release/recriação.

Este guia cobre playback finito. Veja [movimento contínuo](./web-dynamic) para valores, springs e drag/snap, e [suporte Web](./web-support) para mapeamentos, geometria e scroll vertical. Pinch, propriedades exclusivas do nativo e outros adapters de framework ficam fora desse escopo Web. Ela ainda não estabelece uma API estável de referências portáteis nem completa a integração do Mavis. WAAPI por si só não comprova aceleração pelo compositor ou garante FPS.

## Referência nativa e validação {#native-reference-and-validation}

O comportamento do playback nativo permanece igual. Estas gravações nativas revisadas, em inglês, ilustram composição; não mostram o fixture Web nem uma tela compartilhada do Mavis rodando nativamente.

<Clip name="layers-ios" caption="Simulador iOS, demo nativa Layers existente: movimento e feedback coexistem. Referência nativa preservada, não é gravação de aparelho físico nem do novo runtime Web." />

<Clip name="layers-android" caption="Emulador Android, demo nativa Layers existente: movimento e feedback coexistem. Referência nativa preservada, não é gravação de aparelho físico nem do novo runtime Web." />

Com Node 22, execute `npm run web:runtime:typecheck`, `npm run web:runtime:test` e `npm run web:runtime` após instalar as dependências e Chromium/Firefox/WebKit do Playwright. O fixture abre em `http://127.0.0.1:4282`; pare o servidor antes dos testes. O [relatório de evidências](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-runtime.md) detalha relógios, referências nativas compartilhadas, rollback, cleanup e comandos de gravação.

O [adapter Vue DOM opcional](./web-vue) agora oferece refs declaradas e lifecycle de entrada/saída.
