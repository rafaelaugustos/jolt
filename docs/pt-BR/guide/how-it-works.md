# Como funciona

A compilação das curvas fica em um core interno em TypeScript, sem imports de NativeScript, DOM ou frameworks. A fronteira nativa fornece `timeScale` e a preferência de movimento reduzido já resolvidos; os dois drivers nativos consomem os mesmos tracks compilados. O core também define o contrato genérico de driver por target, o relógio de playback e o registro de propriedade dos canais por contexto. Isso prepara o [compartilhamento de movimento entre plataformas (#236)](https://github.com/rafaelaugustos/jolt/issues/236): ainda não há entradas públicas `/core` ou `/web`, e o pacote nativo continua exigindo NativeScript. Springs ao vivo e gestos mantêm a execução nativa.

Quando a animação começa, o Jolt resolve os valores iniciais e calcula a curva original. Springs, decays e tweens numéricos usam [keyframes adaptativos](./transitions#keyframes-adaptativos), concentrando detalhe onde a interpolação linear precisa dele. Tempos dos keyframes definidos pelo app continuam exatos, e trechos numéricos retos usam apenas os extremos. Estabilização dos springs, velocidade nas interrupções e chegada das sequências mantêm o contrato de tempo anterior. Mistura de cores e mapeamentos compostos de motion values conservam suas políticas próprias de amostragem.

As amostras vão para a plataforma de uma vez:

- **iOS**: um `CAKeyframeAnimation` por propriedade na layer da view (`opacity`, `transform.translation.x`, `transform.scale.y`, `transform.rotation.z`...). O Core Animation os compõe, então `x` e `scale` podem pertencer a animações diferentes, e os toca no render server.
- **Android**: um `ObjectAnimator` por propriedade com `Keyframe`s e um interpolador linear, nos `alpha`, `translationX`, `scaleY`, `rotation`... da view.

[Cores](./colors) sólidas usam keyframes de CGColor no iOS e keyframes inteiros através de um alvo Java nativo no Android. No iOS, o texto usa uma máscara alfa do UILabel para manter a posição dos caracteres enquanto a camada de cor anima.

Antes de tocar, os valores finais são definidos na view do NativeScript, como o `view.animate()` faz, então `view.translateX` já contém o alvo enquanto a animação roda. Parar escreve de volta os valores na tela.

Cada propriedade em andamento guarda sua curva e o instante de início. No Android, as interrupções leem o valor na tela e o tempo atual do animator, então a velocidade herdada acompanha a escala de duração das animações do sistema. A chegada antecipada dos springs usa um marcador de tempo nativo com callbacks apenas na conclusão; as demais sequências avançam na conclusão nativa. Delays, repetições e animações desativadas seguem o mesmo relógio da plataforma, sem JavaScript por frame.

[`animateSize()`](./size) tem outro caminho de execução: dimensões reais e reorganização do texto exigem medição/layout do NativeScript na thread de UI em cada frame. Seu callback de frame pertence à biblioteca e executa JavaScript; não é playback no render server. `animateLayout()` continua medindo uma vez e usando tracks nativos de transform. Subscribers de motion values, eventos de scroll e ativação de callbacks de timeline também mantêm seus custos documentados de JS.

[`springValue()`](./live-springs) usa um caminho ao vivo separado: estado persistente em C/Java, um callback nativo de display compartilhado e composição nativa de mapeamentos/camadas. Ele não reconstrói animações de keyframes a cada atualização de alvo. Os callbacks compartilham a thread de UI; não isolam o movimento de JavaScript ocupado no render server. Animações de alvo fixo mantêm o caminho amostrado descrito acima.

A entrada opcional [`gestures()`](./gestures) reconhece pan/pinch/rotação e coordena o ScrollView em código nativo. Os valores retidos alimentam bindings sem callback JS por movimento; callbacks solicitados e listeners existentes do Core ainda executam JavaScript. Reconhecimento e springs ao vivo compartilham a thread de UI.

## Testes

Os testes rodam a engine contra um driver de plataforma falso ([`test/helpers.ts`](https://github.com/rafaelaugustos/jolt/blob/main/test/helpers.ts)) com o próprio relógio: ele registra os keyframes que tocaria e os encerra quando o relógio passa do fim. Os drivers de iOS e Android são checados pelos tipos contra as tipagens das plataformas.

O app de CI nativo também lê valores das presentation layers/views no iOS e Android, valida dimensões reais e o ciclo de vida dos seguidores e detecta uma falha de geometria proposital. Os núcleos C e Java dos springs são compilados e comparados em testes determinísticos de trajetórias.

Os testes de regressão do core portátil comparam 38 trajetórias com uma referência congelada anterior à extração, incluindo keyframes amostrados, tempos, velocidades e preferências de acessibilidade. `npm run core:check` também empacota e instala o core interno compilado em um consumidor sem dependências, verifica suas declarações apenas com tipos de ECMAScript e o importa e exercita sem globais de plataforma. Isso verifica a fronteira interna; não valida um renderer de browser.
