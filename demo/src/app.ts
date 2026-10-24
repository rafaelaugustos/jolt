import { createApp, registerElement } from 'nativescript-vue'
import { SVGView } from '@nativescript-community/ui-svg'
import Jolt from '@rafaelaugusto/jolt/vue'
import App from './PreviewApp.vue'
import { router } from './showcase/router'

registerElement('SVGView', () => SVGView)
createApp(App).use(Jolt).use(router).start()
