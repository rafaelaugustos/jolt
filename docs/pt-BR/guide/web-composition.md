# Experimento de composição Web

Este [experimento interno da #280](https://github.com/rafaelaugustos/jolt/issues/280) usa o compilador portátil para reproduzir transforms pela Web Animations API. Ele trabalha diretamente com elementos DOM, sem framework. Ainda não existe uma entrada `/web` publicada; press/reveal do Mavis e o exemplo compartilhado da aplicação continuam nas próximas entregas da [#236](https://github.com/rafaelaugustos/jolt/issues/236).

<Clip name="web-composition-chromium" :width="720" caption="Chromium 156 no macOS arm64, reprodução real do browser em velocidade normal. Os botões iniciam x/y, mudam o destino de x, definem a escala da aplicação em 1.1, aplicam a contribuição de pressão 0.96, alteram a base para 1.2 e soltam preservando 1.2. Os botões exercitam a composição; o reconhecimento completo de pressão por ponteiro/teclado é outra entrega." />

## O que a prova demonstra {#what-the-proof-establishes}

Um efeito visual de `transform` combina canais com relógios independentes do browser. Substituir `x` preserva os relógios de `y` e da escala. A curva original fornece posição e velocidade na interrupção; tokens de ownership impedem um callback antigo de alterar seu substituto. Pausa, retomada, seek, delay e descarte são exercitados separadamente.

A escala da aplicação e a contribuição de pressão se multiplicam: `1.1 × 0.96 = 1.056`. Alterar a base durante a pressão produz `1.2 × 0.96 = 1.152`; soltar somente a pressão preserva `1.2`. Dois efeitos individuais de `translate` com substituição perdem um eixo. A escala aditiva funciona nos browsers testados, mas listas de transforms aditivos precisam de ordem explícita. O agrupamento é a escolha inicial do experimento, sem descartar todas as alternativas.

As 42 verificações rodam em Chromium, Firefox e WebKit do Playwright. Amostras com tempo local explícito verificam erros de posição e escala separadamente da velocidade da curva original. Outra verificação confirma o avanço da reprodução sem escritas de estilo por frame em JavaScript. São testes de comportamento, sem medição de FPS ou aceleração pelo compositor. Leituras de estilo em movimento no WebKit podem diferir do instante da timeline; as asserções precisas usam tempos alinhados explicitamente. Veja versões e limites na [decisão e evidências](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-composition.md).

## Política inicial de CSS {#initial-css-policy}

A superfície controla `transform` com a ordem fixa `baseline × translate × rotate × scale`, mantendo o `transform-origin` original. A base pode conter uma matriz 2D estática. Ficam excluídos `translate`, `rotate` e `scale` individuais de CSS, transforms 3D, animações/transições existentes e transforms inline com `!important`. Mudanças externas de CSS exigem descarte e recriação; alterações arbitrárias em folhas de estilo ou variáveis CSS não são monitoradas.

Este exemplo limitado suporta `x`, `y`, `rotate`, `scaleX` e `scaleY`, duas contribuições e trajetórias finitas de até 15 segundos. Controles públicos, preferências de acessibilidade, keyframes arbitrários, opacidade, empacotamento e integração com lifecycle dos frameworks pertencem ao trabalho seguinte do runtime. Nenhum caminho de execução nativo muda aqui.

## Referência de composição nativa {#native-composition-reference}

A demonstração nativa existente mostra o comportamento de composição que orienta o trabalho no browser. Estes vídeos revisados foram preservados; não demonstram uma tela Mavis compartilhada nem o exemplo Web rodando no native.

<Clip name="layers-ios" caption="Simulador iOS, demonstração nativa existente de Layers em inglês. Movimento e camadas de feedback coexistem no card. É uma referência de composição nativa, não uma gravação em aparelho físico nem o novo exemplo Web." />

<Clip name="layers-android" caption="Emulador Android, demonstração nativa existente de Layers em inglês. Movimento e camadas de feedback coexistem no card. É uma referência de composição nativa, não uma gravação em aparelho físico nem o novo exemplo Web." />

## Executar o experimento {#run-the-experiment}

No repositório, usando Node 22:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run web:proof:typecheck
npm run web:proof:test
npm run web:proof
```

Abra `http://127.0.0.1:4280`. Pare esse servidor antes de executar os testes, que iniciam um servidor próprio. O código e as instruções de gravação ficam em `benchmarks/web-composition/`.
