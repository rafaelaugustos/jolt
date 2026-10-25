# Zoom, pan e fechamento de fotos

`zoomable()` adiciona pinch, zoom por toque duplo, pan com limites e fechamento vertical opcional a uma `Image`. Mantém a mesma view e processa gestos, ponto focal, transformações e retorno ao repouso nativamente no iOS e Android.

<Clip name="photo-zoom-ios" caption="Pinça, arrasto, zoom por toque duplo, reset e cancelamento do fechamento no simulador iOS." />

```ts
import { zoomable } from '@rafaelaugusto/jolt'

const viewer = zoomable(foto, {
  viewport: foto.parent, // Pai direto
  scale: [1, 5],
  doubleTap: 2.5,
  dismiss: 'vertical',
  backdrop,
  onDismiss(intent) {
    confirmarFechamento().then((aceito) => {
      if (aceito) {
        if (intent.complete()) fecharRotaDoViewer({ animated: false })
      } else intent.cancel()
    })
  },
})
```

Recompile o aplicativo nativo. A configuração aguarda as duas views carregarem, layout positivo e imagem carregada. `ready` indica se o controlador nativo existe. Configure depois de a imagem receber um pai, ou passe explicitamente o viewport que será seu pai direto.

Argumentos inválidos lançam erro imediatamente. Falha posterior na configuração nativa descarta o controlador, preenche `error` e chama o callback opcional `onError(error)`.

## Gestos

- Pinch acompanha o ponto focal em coordenadas do viewport e respeita a faixa de escala.
- Toque duplo alterna entre mínimo e `doubleTap` (padrão 2,5, limitado à faixa).
- Acima do mínimo, um dedo move a imagem com limites baseados no conteúdo visível; overscroll oferece resistência e retorna ao soltar.
- No mínimo, movimento horizontal pode seguir para um pager ancestral. Fechamento exige direção vertical clara e `dismiss: 'vertical'`; fica desligado por padrão.
- Progresso acima de 35% ou velocidade vertical acima de 1.000 DIPs/s na direção do arraste gera uma intenção de fechamento. A pose fica suspensa até cancelar, concluir ou resetar.

A escala padrão é `[1, 5]`, relativa à transformação original positiva e sem rotação da imagem. O mínimo deve ser pelo menos 1. Rotacione um ancestral. O viewport recorta a imagem enquanto o controlador está ativo e recupera seu recorte anterior ao descartá-lo.

O controlador assume as transformações e gestos da imagem. Evite outra animação de transformação simultânea no mesmo alvo. `imageEffect()`, `liquid()` ou outro `zoomable()` substituem esse controle. Use um ancestral para movimento independente da tela.

## Controles acessíveis

```ts
viewer.zoomTo(3, { x: 100, y: 160 }) // Foco em DIPs locais do viewport
viewer.zoomTo(2, undefined, false) // Imediato
viewer.reset()
viewer.requestDismiss()
viewer.cancelDismiss()
viewer.dispose()
```

Ofereça botões ou ações de acessibilidade para zoom, reset e fechar, como na demo. Os gestos sozinhos não substituem esses controles. Redução de movimento torna movimentos programáticos e retorno ao repouso imediatos; acompanhar o dedo continua direto.

`state` retorna `x`, `y` em DIPs locais do viewport, `scale` relativa, `progress` do fechamento e `pending`. `onSettled(state)` avisa no repouso, sem callback JavaScript por quadro. Views separadas em `backdrop` e `chrome` acompanham a opacidade do fechamento nativamente e recuperam a opacidade original ao resetar/descartar.

## Navegação e limpeza

`onDismiss` recebe `{ state, velocity, cancel, complete }`. Velocidade é vertical, em DIPs/s. `cancel()` retorna ao mínimo; `complete()` libera o controlador depois da decisão do roteador. Ambos retornam `false` se a intenção ficou obsoleta; só navegue após uma conclusão aceita. Sem callback, o fechamento é cancelado automaticamente. Intenções antigas ficam inativas depois de reset, substituição ou descarte.

Esta API entrega a interação da imagem. Transições de elementos compartilhados entre rotas continuam como [trabalho separado](./not-there-yet). `nativeController` expõe o objeto nativo para adaptadores; a rota deve assumir a propriedade explicitamente e usar o estado final se quiser continuar a pose ao descartar o controlador.

Se a transição anima um ancestral do viewer, mantenha a intenção pendente: a foto continua na pose em que foi solta. Ao aceitar, oculte/remova a rota antes de chamar `complete()`; ao cancelar, restaure o ancestral e chame `cancel()`. Completar antes da transição visível restaura a foto cedo demais. Um adaptador que anime a transformação da própria imagem precisa assumir a pose nativa explicitamente; veja a [receita completa da galeria](./gallery) para a transferência da pose mantida com `returnToSource()`.

Na demo, **Open viewer route** abre uma página real do Frame, com imagem vertical transparente e controles acessíveis. Voltar do Android e o botão de fechar passam por `requestDismiss()`: a foto retorna ao repouso antes da decisão da aplicação. O exemplo desativa o gesto independente de voltar pela borda do iOS para manter um dono da navegação. Keep viewing cancela na mesma view; Leave viewer esconde seu ancestral antes de confirmar o retorno. O laboratório inline funciona sem pilha de navegação.

Troca de origem/stretch reseta e reconecta com segurança. Mudanças do viewport recalculam limites. Unload descarta listeners e restaura a transformação original. Background cancela fechamento pendente e leva a imagem ao repouso; resume reativa a entrada. Chame `dispose()` se remover o viewer sem descarregar as views.
