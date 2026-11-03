// @dominative/solid 0.0.4-alpha.1 does not forward the universal `use` helper.
// Point the JSX transform at this module to preserve Solid directive ownership.
export * from '@dominative/solid'
import { untrack } from 'solid-js'
export const use = (directive, element, accessor) =>
  untrack(() => directive(element, accessor))
