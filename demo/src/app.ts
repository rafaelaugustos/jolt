import { createApp, registerElement } from 'nativescript-vue'
import { SVGView } from '@nativescript-community/ui-svg'
import { ReorderHandle, ReorderSurface } from '@rafaelaugusto/jolt/reorder'
import Jolt from '@rafaelaugusto/jolt/vue'
import App from './PreviewApp.vue'
import { router } from './showcase/router'
import { launchArgument } from './launch'
import { knownFolders } from '@nativescript/core'
import './native-elements'

registerElement('SVGView', () => SVGView)
registerElement('ReorderHandle', () => ReorderHandle)
registerElement('ReorderSurface', () => ReorderSurface)
const app = createApp(App).use(Jolt).use(router)
// Opt-in native audit: collect Vue setup/lifecycle failures for every routed example.
// This does not install an observer or run in the ordinary preview.
if (launchArgument('showcase-audit') !== undefined) {
  const file = knownFolders.documents().getFile('jolt-showcase-audit.json')
  let report: Record<string, { errors: string[] }> = {}
  try {
    report = JSON.parse(file.readTextSync() || '{}')
  } catch {
    /* first run */
  }
  const id = launchArgument('showcase-example') || 'home'
  report[id] = { errors: [] }
  file.writeTextSync(JSON.stringify(report))
  app.config.errorHandler = (error) => {
    report[id]!.errors.push(String(error))
    file.writeTextSync(JSON.stringify(report))
    console.error('SHOWCASE_AUDIT_ERROR', id, error)
  }
}
app.start()
