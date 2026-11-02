/** Observe real insertion/removal, including a known detached tree or shadow root.
 * No frame polling or timeout can establish that a Vue/Suspense branch is live. */
export function observeConnection(
  element: HTMLElement,
  change: (connected: boolean) => void,
) {
  const document = element.ownerDocument
  const view = document.defaultView as (Window & typeof globalThis) | null
  if (!view || !(element instanceof view.HTMLElement))
    throw new TypeError('Web motion needs an HTMLElement in a live document.')
  let disposed = false
  let connected: boolean | undefined
  let roots = new Set<Node>()
  const observer = new view.MutationObserver(refresh)
  function refresh() {
    if (disposed) return
    const next = new Set<Node>([document])
    let node: Node = element
    for (;;) {
      const root = node.getRootNode()
      next.add(root)
      if (root instanceof view!.ShadowRoot) node = root.host
      else break
    }
    if (next.size !== roots.size || [...next].some((root) => !roots.has(root))) {
      observer.disconnect()
      roots = next
      for (const root of roots) observer.observe(root, { childList: true, subtree: true })
    }
    const attached = element.ownerDocument === document && element.isConnected
    if (attached !== connected) {
      connected = attached
      change(attached)
    }
  }
  // Let the caller retain the cancellation handle before a connected callback.
  queueMicrotask(refresh)
  return {
    refresh,
    dispose() {
      if (disposed) return
      disposed = true
      observer.disconnect()
      roots.clear()
    },
  }
}
