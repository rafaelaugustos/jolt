import { createRouter } from 'vue-router-ns'
import Home from './Home.vue'
import Collection from './Collection.vue'
import Example from './Example.vue'
import Language from './Language.vue'

export const router = createRouter({
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/language', name: 'language', component: Language },
    { path: '/collection', name: 'collection', component: Collection },
    { path: '/example/:id', name: 'example', component: Example },
  ],
})
