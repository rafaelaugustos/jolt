import OrbitSignature from './OrbitSignature.vue'
import './orbit-signature.css'
import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import Clip from './Clip.vue'
import HomeVideos from './HomeVideos.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-hero-after': () => h(HomeVideos),
      'layout-bottom': () => h(OrbitSignature),
    }),
  enhanceApp({ app }) {
    app.component('Clip', Clip)
  },
} satisfies Theme
