import {
  Directive,
  ElementRef,
  Input,
  TemplateRef,
  ViewContainerRef,
  afterEveryRender,
  inject,
  type EmbeddedViewRef,
  type OnChanges,
  type OnDestroy,
} from '@angular/core'
import { type WebRuntime } from '../public.js'
import {
  animateBinding,
  fromCurrent,
  motionBinding,
  type MotionSetup,
  pressBinding,
  type AnimateValue,
  type PressValue,
  type BindingOptions,
} from '../frameworks/binding.js'
export type {
  AnimateValue,
  PressValue,
  BindingOptions,
  MotionSetup,
} from '../frameworks/binding.js'

@Directive({ selector: '[joltAnimate]', standalone: true })
export class JoltAnimateDirective implements OnDestroy {
  @Input() joltAnimate?: AnimateValue
  @Input() joltRuntime?: WebRuntime
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef)
  private binding?: ReturnType<typeof animateBinding>
  private runtime?: WebRuntime
  private readonly render = afterEveryRender(() => {
    if (this.binding && (this.runtime !== this.joltRuntime || this.binding.disposed)) {
      this.binding.destroy()
      this.binding = undefined
    }
    if (!this.binding) {
      this.runtime = this.joltRuntime
      this.binding = animateBinding(this.element.nativeElement, this.joltAnimate, {
        runtime: this.runtime,
      })
    } else this.binding.update(this.joltAnimate)
  })
  ngOnDestroy() {
    this.render.destroy()
    this.binding?.destroy()
  }
}

@Directive({ selector: '[joltPress]', standalone: true })
export class JoltPressDirective implements OnDestroy {
  @Input() joltPress?: PressValue
  @Input() joltRuntime?: WebRuntime
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef)
  private binding?: ReturnType<typeof pressBinding>
  private runtime?: WebRuntime
  private readonly render = afterEveryRender(() => {
    if (this.binding && (this.runtime !== this.joltRuntime || this.binding.disposed)) {
      this.binding.destroy()
      this.binding = undefined
    }
    if (!this.binding) {
      this.runtime = this.joltRuntime
      this.binding = pressBinding(this.element.nativeElement, this.joltPress, {
        runtime: this.runtime,
      })
    } else this.binding.update(this.joltPress)
  })
  ngOnDestroy() {
    this.render.destroy()
    this.binding?.destroy()
  }
}

/** Retain one DOM root through exit; Angular continues to own creation/destruction. */
@Directive({ selector: '[joltIf]', standalone: true })
export class JoltIfDirective implements OnChanges, OnDestroy {
  @Input() joltIf = false
  @Input() joltIfEnter: AnimateValue = 'fadeIn'
  @Input() joltIfLeave: AnimateValue = 'fadeOut'
  @Input() joltIfRuntime?: WebRuntime
  private readonly template = inject(TemplateRef<unknown>)
  private readonly container = inject(ViewContainerRef)
  private view?: EmbeddedViewRef<unknown>
  private binding?: ReturnType<typeof animateBinding>
  private runtime?: WebRuntime
  private dirty = false
  private leaving = false
  private destroyed = false
  private epoch = 0
  private readonly render = afterEveryRender(() => this.reconcile())
  ngOnChanges() {
    if (this.destroyed) return
    this.epoch++
    this.dirty = true
    // Structural rendering also happens on the server. DOM animation waits for render.
    if (this.joltIf && !this.view)
      this.view = this.container.createEmbeddedView(this.template)
  }
  private reconcile() {
    if (!this.dirty || this.destroyed || !this.view) return
    this.dirty = false
    const roots = this.view.rootNodes.filter((node: Node) => node.nodeType === 1)
    if (
      roots.length !== 1 ||
      !(roots[0] instanceof roots[0].ownerDocument.defaultView.HTMLElement)
    )
      throw new Error('joltIf requires exactly one HTML root; wrap sibling roots.')
    if (!this.binding || this.runtime !== this.joltIfRuntime) {
      this.binding?.destroy()
      this.runtime = this.joltIfRuntime
      this.binding = animateBinding(roots[0], undefined, { runtime: this.runtime })
    }
    const epoch = this.epoch,
      interrupted = this.leaving || !this.joltIf
    this.leaving = !this.joltIf
    const input = this.joltIf ? this.joltIfEnter : this.joltIfLeave
    const value = interrupted ? fromCurrent(input) : input
    const animation = this.binding.update(value, true)
    if (!this.joltIf && animation)
      void animation.finished.then((completed) => {
        if (!completed || this.destroyed || this.epoch !== epoch || this.joltIf) return
        this.binding?.destroy()
        this.binding = undefined
        this.container.clear()
        this.view = undefined
        this.leaving = false
      })
  }
  ngOnDestroy() {
    this.destroyed = true
    this.epoch++
    this.render.destroy()
    this.binding?.destroy()
    this.container.clear()
    this.binding = undefined
    this.view = undefined
  }
}

/** Set up existing runtime resources after render, with transactional scope cleanup. */
@Directive({ selector: '[joltMotion]', standalone: true })
export class JoltMotionDirective implements OnDestroy {
  @Input({ required: true }) joltMotion!: MotionSetup
  @Input() joltRuntime?: WebRuntime
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef)
  private binding?: ReturnType<typeof motionBinding>
  private runtime?: WebRuntime
  private readonly render = afterEveryRender(() => {
    if (this.binding && (this.runtime !== this.joltRuntime || this.binding.disposed)) {
      this.binding.destroy()
      this.binding = undefined
    }
    if (!this.binding) {
      this.runtime = this.joltRuntime
      this.binding = motionBinding(this.element.nativeElement, this.joltMotion, {
        runtime: this.runtime,
      })
    } else this.binding.update(this.joltMotion)
  })
  ngOnDestroy() {
    this.render.destroy()
    this.binding?.destroy()
  }
}
