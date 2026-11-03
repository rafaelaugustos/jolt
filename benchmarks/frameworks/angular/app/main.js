import '@nativescript/angular/polyfills'
import '@angular/compiler'
import { Component, NO_ERRORS_SCHEMA, signal } from '@angular/core'
import {
  bootstrapApplication,
  NativeScriptCommonModule,
  runNativeScriptAngularApp,
} from '@nativescript/angular'
import {
  JoltAnimateDirective,
  JoltPressDirective,
  JoltIfDirective,
} from '@rafaelaugusto/jolt/angular'

class App {
  shown = signal(true)
  side = signal(false)
  flip() {
    this.side.update((value) => !value)
  }
  toggle() {
    this.shown.update((value) => !value)
  }
  cancelExit() {
    this.shown.set(false)
    setTimeout(() => this.shown.set(true), 120)
  }
}
Component({
  selector: 'ns-app',
  standalone: true,
  imports: [
    NativeScriptCommonModule,
    JoltAnimateDirective,
    JoltPressDirective,
    JoltIfDirective,
  ],
  schemas: [NO_ERRORS_SCHEMA],
  template: `<StackLayout padding="24" backgroundColor="#102922">
    <Label text="Angular · native ownership" color="#eff5da" fontSize="22" marginBottom="35"></Label>
    <GridLayout height="90" *joltIf="shown(); enter: 'fadeIn'; leave: ['fadeOut', { duration: 700 }]">
      <Label [joltAnimate]="{ x: side() ? 75 : -75 }" [joltPress]="{ scale: 0.94 }" text="NativeScript Angular" automationText="framework-card" width="180" height="90" color="#102922" backgroundColor="#d6e7b5" borderRadius="18" textAlignment="center"></Label>
    </GridLayout>
    <Button color="#eff5da" backgroundColor="#244b3b" height="48" marginBottom="8" text="Interrupt" automationText="framework-interrupt" (tap)="flip()" marginTop="30"></Button>
    <Button color="#eff5da" backgroundColor="#244b3b" height="48" marginBottom="8" text="Exit / reenter" automationText="framework-toggle" (tap)="toggle()"></Button>
    <Button color="#eff5da" backgroundColor="#244b3b" height="48" marginBottom="8" text="Cancel exit" automationText="framework-replace" (tap)="cancelExit()"></Button>
  </StackLayout>`,
})(App)
runNativeScriptAngularApp({ appModuleBootstrap: () => bootstrapApplication(App) })
