import './orbit-signature.css'
import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent } from 'vue'
import type { Theme } from 'vitepress'
import Clip from './Clip.vue'
import ShowcaseBoard from './ShowcaseBoard.vue'
import MotionLayout from './motion/MotionLayout.vue'
import './showcase.css'
import './custom.css'
import './motion/motion.css'
import './motion/experience.css'

export default {
  extends: DefaultTheme,
  Layout: MotionLayout,
  enhanceApp({ app }) {
    app.component('Clip', Clip)
    app.component('ShowcaseBoard', ShowcaseBoard)
    app.component(
      'MotionHome',
      defineAsyncComponent(() => import('./motion/MotionHome.vue')),
    )
    app.component(
      'RecipeLibrary',
      defineAsyncComponent(() => import('./motion/RecipeLibrary.vue')),
    )
    app.component(
      'RecipeDetail',
      defineAsyncComponent(() => import('./motion/RecipeDetail.vue')),
    )
  },
} satisfies Theme
