import * as solid from 'solid-js'

/** Package peers also cover imperative consumers. Binding support is narrower. */
export function requireSolid1Binding(entry: string) {
  // Solid 2 separates dependency computation from effects. Running the Solid 1
  // callback form there can perform work in the wrong phase without an error.
  if ('createTrackedEffect' in solid)
    throw new Error(
      `${entry} requires Solid 1.x. Solid 2 is supported for imperative Jolt imports, not these bindings. Use @rafaelaugusto/jolt in NativeScript or @rafaelaugusto/jolt/web in a browser and own disposal in your component.`,
    )
}
