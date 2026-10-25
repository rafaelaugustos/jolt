import { Image, type Page, type View } from '@nativescript/core'

export function find(page: Page | undefined, tag: string): View[] {
  const matches: View[] = []
  const visit = (view: View) => {
    // Nested Frames own their own identities and navigation.
    if (view !== page && (view.typeName === 'Frame' || view.typeName === 'Page')) return
    if (view.sharedTransitionTag === tag && !view.sharedTransitionIgnore)
      matches.push(view)
    view.eachChildView((child) => {
      visit(child)
      return true
    })
  }
  if (page) visit(page)
  return matches
}
export const radius = (view: View) =>
  typeof view.borderRadius === 'number' ? view.borderRadius : 0
export function supportedImage(view: View): view is Image {
  return (
    view instanceof Image &&
    !!view.imageSource &&
    !view.isLoading &&
    (view.stretch === 'aspectFill' || view.stretch === 'aspectFit') &&
    !view.tintColor
  )
}
