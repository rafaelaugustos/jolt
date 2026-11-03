import type { EffectHost } from './effect.js'
import type { InteractionHost } from './interaction.js'
import type { WebRuntime } from './public.js'

export type PlatformHost = EffectHost & InteractionHost & Pick<WebRuntime, 'sharedLayout'>
