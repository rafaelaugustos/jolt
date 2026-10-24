import { createRouter } from 'vue-router-ns'
import Home from './Home.vue'
import Collection from './Collection.vue'
import Example from './Example.vue'
import Language from './Language.vue'
import Appearance from './Appearance.vue'

export const router = createRouter({
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/appearance', name: 'appearance', component: Appearance },
    { path: '/language', name: 'language', component: Language },
    { path: '/collection', name: 'collection', component: Collection },
    { path: '/example/:id', name: 'example', component: Example },
  ],
})
