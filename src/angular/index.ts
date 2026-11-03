import {
  Directive,
  ElementRef,
  Input,
  TemplateRef,
  ViewContainerRef,
  inject,
  type AfterViewInit,
  type EmbeddedViewRef,
  type OnChanges,
  type OnDestroy,
} from '@angular/core'
import { toView } from '../animate.js'
import { motionScope } from '../motion-scope.js'
import { getPreset } from '../presets.js'
import type { PresetName } from '../presets.js'
import {
  animateBinding,
  pressBinding,
  type AnimateValue,
  type PressValue,
} from '../frameworks/native-binding.js'
import type { Keyframes, Target } from '../types.js'
export type { AnimateValue, PressValue } from '../frameworks/native-binding.js'

@Directive({ selector: '[joltAnimate]', standalone: true })
export class JoltAnimateDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() joltAnimate?: AnimateValue
  private readonly element = inject(ElementRef)
  private binding?: ReturnType<typeof animateBinding>
  ngAfterViewInit() {
    this.binding = animateBinding(this.element, this.joltAnimate)
  }
  ngOnChanges() {
    this.binding?.update(this.joltAnimate)
  }
  ngOnDestroy() {
    this.binding?.destroy()
  }
}

@Directive({ selector: '[joltPress]', standalone: true })
export class JoltPressDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() joltPress?: PressValue
  private readonly element = inject(ElementRef)
  private binding?: ReturnType<typeof pressBinding>
  ngAfterViewInit() {
    this.binding = pressBinding(this.element, this.joltPress)
  }
  ngOnChanges() {
    this.binding?.update(this.joltPress)
  }
  ngOnDestroy() {
    this.binding?.destroy()
  }
}

/** One native root. Keeps the embedded view alive until its owned exit completes. */
@Directive({ selector: '[joltIf]', standalone: true })
export class JoltIfDirective implements OnChanges, OnDestroy {
  @Input() joltIf = false
  @Input() joltIfEnter: AnimateValue = 'fadeIn'
  @Input() joltIfLeave: AnimateValue = 'fadeOut'
  private readonly template = inject(TemplateRef<unknown>)
  private readonly container = inject(ViewContainerRef)
  private readonly scope = motionScope()
  private view?: EmbeddedViewRef<unknown>
  private root?: Target
  private epoch = 0
  private leaving = false
  private destroyed = false
  ngOnChanges() {
    if (this.destroyed) return
    const epoch = ++this.epoch
    if (this.joltIf) {
      const interrupted = this.leaving
      this.leaving = false
      if (!this.view) {
        this.view = this.container.createEmbeddedView(this.template)
        this.view.detectChanges()
        const roots: Target[] = []
        for (const node of this.view.rootNodes) {
          try {
            roots.push(toView(node))
          } catch {
            /* Angular anchor/comment nodes are not views. */
          }
        }
        if (roots.length !== 1) {
          this.container.clear()
          this.view = undefined
          throw new Error(
            'joltIf requires exactly one NativeScript root view; wrap siblings in a layout.',
          )
        }
        this.root = roots[0]
      } else if (!interrupted) return
      this.play(this.joltIfEnter, interrupted)
    } else if (this.view) {
      this.leaving = true
      const animation = this.play(this.joltIfLeave, true)
      void animation.finished.then((completed) => {
        if (completed && !this.destroyed && this.epoch === epoch && !this.joltIf) {
          this.scope.reset()
          this.container.clear()
          this.view = undefined
          this.root = undefined
          this.leaving = false
        }
      })
    }
  }
  private play(value: AnimateValue, interrupted: boolean) {
    const [animation, options] = Array.isArray(value) ? value : [value, undefined]
    const preset =
      typeof animation === 'string' ? getPreset(animation as PresetName) : undefined
    let frames: Keyframes = preset?.keyframes ?? (animation as Keyframes)
    if (interrupted) {
      // Explicit preset starts must not snap an in-flight enter/exit to an endpoint.
      frames = Object.fromEntries(
        Object.entries(frames).map(([key, values]) => [
          key,
          Array.isArray(values) ? [null, ...values.slice(1)] : values,
        ]),
      ) as Keyframes
    }
    return this.scope.animate(this.root!, frames, options ?? preset?.transition)
  }
  ngOnDestroy() {
    this.destroyed = true
    this.epoch++
    this.scope.dispose()
    this.container.clear()
    this.view = undefined
    this.root = undefined
  }
}
