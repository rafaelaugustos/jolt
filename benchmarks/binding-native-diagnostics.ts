import { Application, isIOS, type View } from '@nativescript/core'
interface InputProbe {
  finish(): string
  cancel(): void
}
interface RetentionProbe {
  watch(view: unknown): void
  reset(): void
  snapshot(): string
}
declare const JoltBudgetInputProbe: {
  watchDelay(surface: UIView, delay: number): InputProbe
}
declare class JoltBudgetRetention {
  static new(): RetentionProbe
}
declare const org: {
  rafaelaugusto: {
    jolt: {
      fixture: {
        BudgetInputProbe: new (
          activity: android.app.Activity,
          view: android.view.View,
          delay: number,
        ) => InputProbe
        BudgetRetention: new () => RetentionProbe
      }
    }
  }
}
export const inputProbe = (view: View, delay: number): InputProbe =>
  isIOS
    ? JoltBudgetInputProbe.watchDelay(view.ios, delay)
    : new org.rafaelaugusto.jolt.fixture.BudgetInputProbe(
        Application.android.foregroundActivity,
        view.android,
        delay,
      )
export const retentionProbe = () => {
  const native = isIOS
    ? JoltBudgetRetention.new()
    : new org.rafaelaugusto.jolt.fixture.BudgetRetention()
  return {
    watch: (view: View) => native.watch(isIOS ? view.ios : view.android),
    reset: () => native.reset(),
    snapshot: (): Record<string, number> => JSON.parse(native.snapshot()),
  }
}
