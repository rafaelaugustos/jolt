import '@angular/compiler'
import {
  Component,
  InjectionToken,
  inject,
  signal,
  provideZonelessChangeDetection,
} from '@angular/core'
import {
  JoltAnimateDirective,
  JoltPressDirective,
  JoltIfDirective,
} from '@rafaelaugusto/jolt/web/angular'
export const MOTION = new InjectionToken('fixture.motion', {
  providedIn: 'root',
  factory: () => undefined,
})
export class App {
  runtime = inject(MOTION)
  x = signal(0)
  visible = signal(true)
  generation = signal(0)
  renders = signal(0)
  taps = signal(0)
  increment(signal) {
    signal.update((n) => n + 1)
  }
  reduce() {
    this.runtime.configure({ reducedMotion: 'always' })
  }
}
Component({
  selector: 'app-root',
  standalone: true,
  imports: [JoltAnimateDirective, JoltPressDirective, JoltIfDirective],
  template: `<main><div class="badge">JOLT · ANGULAR DOM</div><h1>Motion follows your component</h1>
    <p>Interrupt, replace or remove the card. Each component owns its motion.</p>
    <div class="controls">
      <button (click)="x.set(160)">Move</button><button (click)="x.set(-60)">Interrupt</button>
      <button (click)="increment(renders)">Rerender</button><button (click)="increment(generation)">Replace</button>
      <button (click)="visible.set(!visible())">Toggle</button><button (click)="reduce()">Reduce motion</button>
    </div>
    <div class="stage">
      @for (identity of [generation()]; track identity) {
        <button *joltIf="visible(); enter: 'fadeIn'; leave: ['fadeOut',{duration:400}]; runtime: runtime" class="card" data-card [joltAnimate]="[{x:x()},{duration:650,ease:'linear'}]" [joltPress]="{scale:.92}" [joltRuntime]="runtime" (click)="increment(taps)">Press me</button>
      }
    </div>
    <div class="status"><span>Actions <output data-taps>{{taps()}}</output></span><span>Renders <output data-renders>{{renders()}}</output></span><span>Identity <output>{{generation()}}</output></span></div>
  </main>`,
})(App)
export { provideZonelessChangeDetection }
