# Liquid Glass

Aproxime controles e deixe o iOS unir suas superfícies. `@rafaelaugusto/jolt/glass` adiciona `GlassContainer` e `GlassView`, dois layouts NativeScript compatíveis com o `animate()` existente. Disponível desde a **0.1.0-rc.1**.

<Clip name="glass-ios" caption="Simulador iOS 26.2: toques reais unem e separam três superfícies nativas de vidro, trocam o material, interrompem o movimento, pausam/retomam e aplicam Reduzir Movimento. Interface em inglês; tempo original." />
<Clip name="glass-android" caption="Emulador Android API 36: o mesmo layout, movimento e interação com cartões clássicos estilizados explicitamente. Android não tem Liquid Glass nem fusão. Interface em inglês e toques reais por ADB; tempo original." />

<Clip name="glass-legacy-ios" caption="Simulador iOS 18.6: superfícies arredondadas com blur comum preservam conteúdo, toque e movimento, sem a fusão do Liquid Glass. Interface em inglês e toques reais; tempo original." />

## Uma superfície compartilhada

Registre os layouts uma vez ao usar NativeScript-Vue:

```ts
import { registerElement } from 'nativescript-vue'
import { GlassContainer, GlassView } from '@rafaelaugusto/jolt/glass'

registerElement('GlassContainer', () => GlassContainer)
registerElement('GlassView', () => GlassView)
```

```vue
<GlassContainer height="160" glassSpacing="26">
  <GlassView id="left" width="72" height="72" translateX="-104"
    glassInteractive="true">
    <Label text="✦" textAlignment="center" verticalAlignment="center" />
  </GlassView>
  <GlassView id="right" width="72" height="72" translateX="104"
    glassInteractive="true">
    <Label text="＋" textAlignment="center" verticalAlignment="center" />
  </GlassView>
</GlassContainer>
```

Depois do carregamento, passe as **instâncias das views NativeScript** ao Jolt:

```ts
import { animate, motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
scope.add(animate(left, { x: -36 }, 'smooth'))
scope.add(animate(right, { x: 36 }, 'smooth'))

// Nos handlers de suspensão/retomada do aplicativo:
// scope.suspend()
// scope.resume()

// Ao desmontar o componente definitivamente:
// scope.dispose()
```

No Core NativeScript, construa as classes e use `addChild()` normalmente. `GlassView` é um `GridLayout`: pode conter textos, ícones e controles. Coloque os elementos de vidro diretamente no mesmo `GlassContainer`. Os layouts encaminham os filhos ao `contentView` de cada efeito nativo, preservando propriedade, layout e entrada do NativeScript.

No iOS 26+, o container usa `UIGlassContainerEffect` e cada superfície usa `UIGlassEffect`. Aproximar os elementos muda o formato do material compartilhado. UIKit decide a união com base na geometria e no espaçamento; Jolt anima as views. Consulte o [container de vidro da Apple](https://developer.apple.com/documentation/uikit/uiglasscontainereffect) e as [views personalizadas com Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/284/).

## Propriedades

| Propriedade              | Padrão      | Significado                                                             |
| ------------------------ | ----------- | ----------------------------------------------------------------------- |
| Container `glassSpacing` | `16`        | Distância em DIPs em que vidros próximos começam a se unir, 0–200.      |
| View `glassStyle`        | `'regular'` | `'regular'` ou `'clear'`, iOS 26+.                                      |
| View `glassRadius`       | `'capsule'` | Cápsula ou raio dos cantos em DIPs, 0–1000. Aplicado no iOS.            |
| View `glassTint`         | `undefined` | `ColorValue` do Jolt; `null`/`undefined` remove a cor. iOS 26+.         |
| View `glassInteractive`  | `false`     | Resposta nativa ao toque, iOS 26+. Não instala um handler de tap.       |
| View `glassFallback`     | `'blur'`    | `'blur'` ou `'none'` antes do iOS 26. Android sempre usa nenhum efeito. |

Propriedades numéricas aceitam números e strings numéricas em markup declarativo. `glassInteractive` também aceita `'true'` e `'false'`. Valores inválidos lançam erro antes de substituir o material. Alterações configuram o material imediatamente; não são canais separados de animação. Use `glassRadius` para os cantos do vidro nativo, evitando máscaras ou recortes CSS concorrentes.

`supportsLiquidGlass()` verifica o sistema e os metadados NativeScript disponíveis. A propriedade somente leitura `glassBackend` informa o suporte selecionado: container `'liquid-glass'`/`'none'`, view `'liquid-glass'`/`'blur'`/`'none'`. Ela descreve a configuração, não se uma view descarregada está renderizando.

## Plataformas e ciclo de vida

Compile com Xcode e metadados iOS do NativeScript que incluam UIKit 26 para usar Liquid Glass. Em um iOS anterior, cada superfície usa `UIBlurEffect` comum, exceto com `glassFallback="none"`; o container não tem efeito e as superfícies não se fundem. No Android, ambas as classes continuam como `GridLayout`s comuns: conteúdo e interação funcionam, sem desfoque nem fusão. Defina fundo e `borderRadius` explícitos para Android, como no preview. O fallback também foi executado em simulador iOS 18.6.

Mantenha o vidro e seus ancestrais com opacidade 1 e evite recortar a área de união do container. Reduzir a opacidade da view de efeito não é uma forma suportada de esmaecer seu material. UIKit cuida da aparência de acessibilidade do sistema; confira o contraste no fundo real. [Orientações da Apple sobre views de efeito](https://developer.apple.com/documentation/uikit/uivisualeffectview).

Use a animação de transforms existente para interrupção, molas, atrasos, repetições, pausa, posição e Reduzir Movimento. Guarde as animações em um motion scope e conecte seus métodos de suspensão/retomada para continuar após o app voltar do segundo plano. Os efeitos são removidos no unload/dispose e retornam com a configuração mais recente no load; o unload comum da animação segue o cancelamento já existente no Jolt.

JavaScript configura materiais e prepara as curvas. UIKit renderiza o vidro; a animação nativa de transforms avança o movimento. Não há novo loop JavaScript por frame, helper nativo ou dependência. Isso não é morph de SVG arbitrário, animação do raio de blur nem medição de desempenho em aparelho físico. Para operações diferentes, veja [formas](./shapes), [blur animado](./blur) e [deformação de imagens](./liquid).

O preview **Melhor como um só / Still**, em quatro idiomas, é o exemplo 73. [Verificações nativas e reprodução](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/glass.md).
