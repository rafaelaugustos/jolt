# Web press input and contribution verification (#283)

The experimental `createWebRuntime(document).press(target, values?, options?)` binds input to finite Web playback. Each binding owns a private contribution; application channels and other layers continue independently. Default feedback is scale 0.96 with a snappy spring. This implements input on top of #281/#282 without publishing another entry, importing a framework, or installing a permanent frame scheduler.

## Contract and input decisions

- A binding owns its input listeners and a reserved `jolt:press:` contribution. Application scale 1.1 becomes 1.056 while held; retargeting the base to 1.2 becomes 1.152; release/disposal preserves 1.2. Returning to neutral removes settled private values. Active private tracks are cancelled without cancelling base/other-layer tracks.
- Primary pointer events work on declared transformable HTML surfaces. Actual HTML buttons also observe Space/Enter. No click synthesis, default prevention, explicit pointer capture, focus changes or touch-action changes are introduced. Other elements remain pointer-only and retain their original roles/tab order; nested interactive controls are ignored. This preserves the browser's [button activation model](https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element).
- Document/window release listeners handle releases outside and cancellation. Browser implicit touch capture and scroll takeover remain intact, following [Pointer Events](https://www.w3.org/TR/pointerevents3/). Tests separate an actual Chromium touch-scroll gesture from deterministic synthetic delivery of pointercancel/lostpointercapture/window blur in all engines; those synthetic events do not prove OS gesture delivery in Firefox/WebKit.
- Feedback cancels on mouse exit, ancestor scroll, target/window blur, hidden document, native disabled state (including fieldsets), aria-disabled, target aria-busy, ancestor inert, and adapter-provided disabled/loading state. State flags affect feedback only. Components retain responsibility for activation/focus/loading semantics and normally map disabled/loading to a native disabled button.
- Binding disposal clears only its contribution and listeners. Context release/disposal or detachment also detaches input. Immediate synchronous disposal after DOM removal works before observer delivery. Shadow-root attributes/scroll and connected reparenting are supported. Replacement surfaces need a new binding.
- Existing runtime transactions, source clocks, interruption velocity and live reduced-motion policy are reused. Exactly-once completion/cancellation comes from finite playback handles. The public binding exposes pressed state, its latest animation handle, state updates and idempotent disposal. Generic portable refs, gestures and framework lifecycle adapters remain separate work.
- The finite runtime's static 2D CSS surface policy still applies. Dynamic classes, competing CSS transitions/animations and externally edited motion styles require release/rebinding; a component may declare an inner motion surface.

## Reproducible validation

Using Node 22 and installed Playwright browsers:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run web:press:typecheck
npm run web:press:test
npm run web:runtime:test
npm run web:proof:test
npm run build
npm ci --prefix benchmarks/native-app
npm run package:check
```

The local [validation record](web-press/validation.json) retains 73 passing browser cases and two explicitly skipped CDP touch-scroll cases (Firefox/WebKit). Coverage includes composition during press and release, native activation/form submission compared with an unbound button, repeated keys, focus loss, release outside, cancellation, disabled/loading transitions, interrupted spring velocity, stale handles, exactly-once results, settled/active cleanup, listener abortion, shadow DOM, invalid configuration, reduced motion and idle effects. The actual touch scroll test verifies scrollTop advances and no click is emitted.

The existing finite runtime (54 cases), composition proof (42 cases), and 1,586 unit tests pass. The packed-consumer check now drives press/release through the actual public entry in both Vite development and production, preserving application scale. Web-only installation, SSR/declaration isolation and native production bundles remain verified by that matrix. Native CI remains the simulator/emulator execution gate; this change does not alter native press behavior or claim physical-device performance.

## Recordings

Run `node benchmarks/web-press/record.mjs` with the fixture stopped. It records real Chromium pointer holds, release outside, Space/Enter and application keyboard actions, transcodes the original timing to H.264, decodes the whole result and asserts presented scale at each checkpoint. [Recording metadata](web-press/recording.json) records versions, source/video hashes and measured scales. The fixture is available with `npm run web:press` at port 4283.

`web-press-chromium.mp4` is embedded in all four translated guides. The existing English `motion-rfc-ios.mp4` and `motion-rfc-android.mp4` are preserved native composition references, reused from the [native Layers audit](motion-values-rfc.md); they do not show the browser implementation or a shared Mavis screen. All three clips were decoded and visually reviewed, including frames across their full durations. Documentation players are checked in the generated site, and the PR embeds the reviewed English recordings directly as playable attachments. Captions distinguish browser, simulator and emulator.
