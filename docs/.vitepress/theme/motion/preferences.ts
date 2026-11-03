import type { InjectionKey, Ref } from 'vue'

export const reduceMotionKey: InjectionKey<Ref<boolean>> = Symbol('site-reduce-motion')
