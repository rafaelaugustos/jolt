# Partículas, superfícies e efeitos de imagem na Web

**Disponível desde a 0.1.0-rc.10.** As issues #359–#364 adicionam seis métodos ao runtime e aos escopos. Importar `/web` continua seguro no SSR. Crie o runtime após a montagem; use `HTMLImageElement` já decodificado e com layout nos efeitos de imagem. A adoção no Mavis segue em uma frente separada.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const snow = scope.particles(scene, { source: 'top', angle: 90, rate: 30 })
scope.confetti(button, { count: 80 })
const soft = scope.blur(panel, { radius: 24 })
await soft.animate(0.7, 'smooth')
const line = scope.shape(canvasHost, {
  d: 'M10 10 L90 10 L90 90 L10 90 Z',
  viewBox: [0, 0, 100, 100],
  fill: '#6851c9',
  stroke: '#b9fff1',
})
await line.animate({ d: 'M50 0 L100 50 L50 100 L0 50 Z' })
await photo.decode()
const flow = scope.liquid(photo, { intensity: 0.8 })
flow.pause()
flow.resume()
flow.stop()
await nextPhoto.decode()
const swap = scope.imageEffect(photo, 'dissolve', { to: nextPhoto, paused: true })
swap.progress = 0.4
swap.play()
// scope.suspend(); scope.resume(); scope.dispose(); motion.dispose()
```

## Controle e ciclo de vida {#lifecycle}

Os seis métodos funcionam em `motion.scope()` e nos escopos de `/web/vue`. A suspensão congela o trabalho; a retomada continua do mesmo ponto; o descarte remove camadas, listeners, tarefas e estilos. O tempo com o documento oculto é excluído. Opções inválidas preservam o efeito anterior, e outro runtime não pode assumir o alvo. Camadas decorativas não recebem interação nem entram na árvore de acessibilidade. Use `scope.use()` para refs substituíveis e KeepAlive.

Blur de conteúdo, liquid e efeitos de imagem compartilham um único slot de filtro por alvo; iniciar outro substitui o anterior. Backdrop blur usa um slot separado. Filtros CSS anteriores são preservados, assim como alterações posteriores do app. Coloque bordas e fundos em um contêiner externo quando apenas os pixels da imagem devem receber o filtro. As implementações usam o agendador JavaScript compartilhado e Canvas/CSS/SVG do navegador, sem promessa de reprodução fora da thread principal ou pixels idênticos aos nativos.

## Partículas e confete {#particles}

`particles()` aceita as [opções nativas](./particles), usando pixels CSS no lugar de DIPs. O Canvas limita a população a 10.000 partículas e a superfície a 4.194.304 pixels, com DPR máximo de 2. Redimensionar muda a origem das novas partículas sem deslocar as existentes. Emissões já expiradas são descartadas após um quadro demorado. Com `duration`, a emissão termina e as partículas restantes completam sua vida.

`confetti()` emite durante 200 ms, com vida de 2200 ms. Captura o centro do alvo e usa uma camada fixa no viewport, fora do recorte dos ancestrais; continua abaixo de diálogos na top layer e da interface do sistema. Trajetórias aleatórias podem diferir das nativas. Os dois retornam funções de limpeza com pause/play, suspend/resume, dispose, finished e snapshot. O término natural resolve `true`; cancelamento resolve `false`. Movimento reduzido suprime novas rajadas e limpa partículas contínuas, que retomam sem acumular emissões atrasadas.

<Clip name="web-particles-surfaces-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais demonstram reprodução, pausa/retomada, substituição, movimento reduzido e descarte na velocidade original. Captura de navegador; sem alegação de desempenho em aparelho físico." />

<Clip name="web-confetti-surfaces-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais demonstram reprodução, pausa/retomada, substituição, movimento reduzido e descarte na velocidade original. Captura de navegador; sem alegação de desempenho em aparelho físico." />

<Clip name="particles-ios" caption="Simulador iOS, interface em inglês: reprodução e interação nativas reais, revisadas e reutilizadas como referência. Velocidade original; não é uma gravação de aparelho físico." />

## Desfoque controlado {#blur}

`blur(target, { amount, radius, mode })` usa filtro CSS de conteúdo por padrão. `amount` vai de 0 a 1; `radius` de 1 a 64 pixels CSS, com padrão 24. `mode: 'backdrop'` usa backdrop-filter quando disponível; caso contrário, snapshot().backend retorna none. A opção compartilhada style aceita system/light/dark, sem simular o material colorido do iOS.

`animate()` redireciona a intensidade visível e a velocidade da mola. A reprodução permite pausa, seek e resultado booleano. `set()` aplica imediatamente; `stop()` mantém a intensidade atual; `dispose()` restaura o filtro anterior. Movimento reduzido aplica o destino. O vídeo nativo abaixo usa material iOS; Android usa desfoque de conteúdo.

<Clip name="web-blur-surfaces-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais demonstram reprodução, pausa/retomada, substituição, movimento reduzido e descarte na velocidade original. Captura de navegador; sem alegação de desempenho em aparelho físico." />

<Clip name="blur-ios" caption="Simulador iOS, interface em inglês: reprodução e interação nativas reais, revisadas e reutilizadas como referência. Velocidade original; não é uma gravação de aparelho físico." />

## Formas e morphing {#shape}

`shape()` cria uma superfície SVG decorativa com preenchimento, traço, viewBox, terminações, junções e regra de preenchimento. Reutiliza o parser nativo portátil. `animate({ d, strokeStart, strokeEnd }, transition)` exige comandos normalizados e subcaminhos compatíveis; `set()` aceita outra topologia. O recorte fica em 0–1, afeta apenas o traço e exige um contorno único quando parcial.

A reprodução permite pausa, seek, interrupção e movimento reduzido. O redirecionamento parte da geometria atual com uma nova curva. `stop()` mantém a forma; `dispose()` remove a superfície. `drawPath()` continua controlando geometrias SVG que pertencem ao app.

<Clip name="web-shape-surfaces-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais demonstram reprodução, pausa/retomada, substituição, movimento reduzido e descarte na velocidade original. Captura de navegador; sem alegação de desempenho em aparelho físico." />

<Clip name="shapes-ios" caption="Simulador iOS, interface em inglês: reprodução e interação nativas reais, revisadas e reutilizadas como referência. Velocidade original; não é uma gravação de aparelho físico." />

## Imagens líquidas {#liquid}

`liquid(image, { intensity: 0.7, duration: 8000 })` usa o mesmo campo periódico do iOS, convertido em um mapa SVG de deslocamento de 48 × 48. Intensidade vai de 0 a 1; duração é o tempo positivo de cada ciclo em milissegundos. pause, resume e stop mantêm seu significado nativo; a Web também expõe play/suspend/dispose e diagnósticos.

Movimento reduzido mostra a imagem original e suspende o relógio. Troca de origem ou remoção do alvo descarta o efeito; recrie após o carregamento. Redimensionar atualiza liquid; efeitos finitos de imagem são cancelados. Liquid nativo no Android continua sem deformação. Imagens indisponíveis ou não prontas retornam um controle encerrado com motivo explícito.

<Clip name="web-liquid-surfaces-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais demonstram reprodução, pausa/retomada, substituição, movimento reduzido e descarte na velocidade original. Captura de navegador; sem alegação de desempenho em aparelho físico." />

<Clip name="liquid-ios" caption="Simulador iOS, interface em inglês: reprodução e interação nativas reais, revisadas e reutilizadas como referência. Velocidade original; não é uma gravação de aparelho físico." />

## Ondas, distorção por toque e dissolução {#image}

`imageEffect(image, name, options)` aceita ripple, distortion e dissolve. Origem, amplitude de 0–64 (padrão 8) e raio positivo (padrão 96) usam pixels CSS locais. A duração finita padrão é 650 ms; seed da dissolução é inteiro de 0 a 65535. Distorção usa captura real do ponteiro, retorna ao soltar e controla touch-action enquanto ativa. Não aceita seek ou reverse finitos. Use imagem alinhada aos eixos, sem rotação ou skew, para a distorção por ponteiro.

Efeitos finitos expõem finished, progress, pause/play, reverse e finish. Seek preserva a pausa; finish conclui no extremo da direção atual. Parar ou substituir restaura a origem e resolve false. Dissolução concluída para frente aplica a origem do `to: HTMLImageElement` já decodificado e limpa srcset/sizes; conclusão reversa conserva a original. O framework deve aplicar o mesmo destino ao estado do app após o sucesso.

São aceitas imagens raster estáticas carregadas e com layout positivo, até 4.194.304 pixels físicos de saída. Dissolução aceita fill/contain/cover/none/scale-down com object-position percentual. O destino precisa permitir leitura por Canvas; imagens de outra origem exigem CORS adequado. A CSP precisa permitir imagens data. Renderer indisponível, posicionamento incompatível ou movimento reduzido mantém efeitos decorativos inalterados (false), mas aplica o destino da dissolução imediatamente (true), inclusive quando solicitada pausada. Consulte diagnostics.backend/reason. Ativar movimento reduzido durante um efeito finito conclui no extremo da direção atual. Troca de src, fonte responsiva ou tamanho cancela o efeito. Preserve alt e os estados de carregamento/erro do app.

<Clip name="web-image-surfaces-chromium" :width="900" caption="Chromium no macOS, interface em inglês: cliques reais demonstram reprodução, pausa/retomada, substituição, movimento reduzido e descarte na velocidade original. Captura de navegador; sem alegação de desempenho em aparelho físico." />

<Clip name="image-effects-ios" caption="Simulador iOS, interface em inglês: reprodução e interação nativas reais, revisadas e reutilizadas como referência. Velocidade original; não é uma gravação de aparelho físico." />

## Validação e reprodução

Execute `npm run web:surfaces:typecheck` e `npm run web:surfaces:test`. A suíte verifica mudanças reais de pixels, ponteiro, conclusão, controle, tempo oculto, troca de origem, Shadow DOM/base URL e limpeza em Chromium, Firefox e WebKit. Grave a interação real com `node benchmarks/web-surfaces/record.mjs`. Os vídeos nativos são preservados dos guias correspondentes. Consulte o [relatório de validação](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-surfaces.md).
