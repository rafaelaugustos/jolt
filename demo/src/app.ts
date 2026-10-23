import { createApp, registerElement } from 'nativescript-vue'
import { SVGView } from '@nativescript-community/ui-svg'
import Jolt from '@rafaelaugusto/jolt/vue'
import App from './App.vue'

registerElement('SVGView', () => SVGView)
createApp(App).use(Jolt).start()
