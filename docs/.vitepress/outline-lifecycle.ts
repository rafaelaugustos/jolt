import type { Plugin } from 'vite'

/** VitePress 1.6's debounced outline callback can run after its refs unmount. */
export function outlineLifecycle(): Plugin {
  return {
    name: 'jolt-outline-lifecycle',
    enforce: 'pre',
    transform(code, id) {
      if (
        !id
          .split('?')[0]
          .replaceAll('\\', '/')
          .endsWith('/vitepress/dist/client/theme-default/composables/outline.js')
      )
        return
      const signature = 'function activateLink(hash) {'
      if (!code.includes(signature))
        throw new Error(
          'VitePress outline changed: review or remove the outline lifecycle guard.',
        )
      return code.replace(
        signature,
        `${signature}\n        if (!container.value || !marker.value) return;`,
      )
    },
  }
}
