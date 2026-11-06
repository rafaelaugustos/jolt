/** Numeric sample budgets, shared by explicit native/browser property adapters. */
export const propertyLimits = Object.freeze({
  components: 64,
  memberSamples: 262144,
  groupSamples: 1048576,
})
export function checkPropertySamples(samples: number, components: number) {
  if (samples * components > propertyLimits.memberSamples)
    throw new RangeError(
      'Property animation exceeds its 262144 sampled-component budget.',
    )
}
export function checkPropertyGroupSamples(components: number) {
  if (components > propertyLimits.groupSamples)
    throw new RangeError('Property group exceeds its 1048576 sampled-component budget.')
}
