/** A registry per runtime/context. Tokens prevent old cleanup from changing a newer owner. */
export function createOwnership<Target extends object, Property extends string>() {
  const revisions = new WeakMap<Target, Map<Property, symbol>>()
  return {
    get(target: Target, property: Property) {
      return revisions.get(target)?.get(property)
    },
    claim(target: Target, property: Property) {
      let tokens = revisions.get(target)
      if (!tokens) revisions.set(target, (tokens = new Map()))
      const token = Symbol(property)
      tokens.set(property, token)
      return token
    },
    invalidate(target: Target, properties?: readonly Property[]) {
      const tokens = revisions.get(target)
      for (const property of properties ?? tokens?.keys() ?? [])
        tokens?.set(property, Symbol(property))
    },
  }
}
