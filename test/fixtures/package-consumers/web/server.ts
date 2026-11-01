import { createWebRuntime } from '@rafaelaugusto/jolt/web'

// SSR imports and renders without constructing a document-owned runtime.
export const render = () => `<main data-motion="${typeof createWebRuntime}"></main>`
