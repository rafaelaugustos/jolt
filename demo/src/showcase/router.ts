import { createRouter } from 'vue-router-ns'
import SharedNavigationDetail from './SharedNavigationDetail.vue'
import InteractiveNavigationDetail from './InteractiveNavigationDetail.vue'
import PredictiveBackDetail from './PredictiveBackDetail.vue'
import Home from './Home.vue'
import Collection from './Collection.vue'
import Example from './Example.vue'
import Language from './Language.vue'
import Appearance from './Appearance.vue'

export const router = createRouter({
  routes: [
    {
      path: '/predictive-back',
      name: 'predictive-back-detail',
      component: PredictiveBackDetail,
    },
    {
      path: '/interactive-navigation',
      name: 'interactive-navigation-detail',
      component: InteractiveNavigationDetail,
    },
    {
      path: '/interactive-navigation/nested',
      name: 'interactive-navigation-nested',
      component: InteractiveNavigationDetail,
    },
    {
      path: '/shared-navigation/:mode',
      name: 'shared-navigation-detail',
      component: SharedNavigationDetail,
    },
    { path: '/', name: 'home', component: Home },
    { path: '/appearance', name: 'appearance', component: Appearance },
    { path: '/language', name: 'language', component: Language },
    { path: '/collection', name: 'collection', component: Collection },
    { path: '/example/:id', name: 'example', component: Example },
  ],
})
