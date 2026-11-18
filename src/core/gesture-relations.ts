/** Relationships apply to recognizers, not to animation/property ownership. */
export type GestureRelationKind = 'simultaneous' | 'waitFor' | 'block'
export type GestureRecognizerKind = 'pan' | 'pinch' | 'rotate' | 'tap' | 'longPress'
export interface GestureRelation {
  gesture: object
  other: object
  relation: GestureRelationKind
  kind?: GestureRecognizerKind
  otherKind?: GestureRecognizerKind
}
export interface GestureRelations {
  readonly disposed: boolean
  dispose(): void
}
export interface GestureEndpoint {
  readonly disposed: boolean
  readonly active: boolean
  connect(other: GestureEndpoint, kind: GestureRelationKind): () => void
}
const endpoints = new WeakMap<object, (kind?: GestureRecognizerKind) => GestureEndpoint>()
const edges = new Set<{
  a: GestureEndpoint
  b: GestureEndpoint
  kind: GestureRelationKind
}>()
export function forgetGestureEndpoint(endpoint: GestureEndpoint) {
  for (const edge of edges)
    if (edge.a === endpoint || edge.b === endpoint) edges.delete(edge)
}
export function registerGestureEndpoints(
  controller: object,
  resolve: (kind?: GestureRecognizerKind) => GestureEndpoint,
) {
  endpoints.set(controller, resolve)
  return () => {
    if (endpoints.get(controller) === resolve) endpoints.delete(controller)
  }
}
export function gestureEndpoint(
  controller: object | undefined,
  kind?: GestureRecognizerKind,
): GestureEndpoint {
  const endpoint = controller && endpoints.get(controller)?.(kind)
  if (!endpoint || endpoint.disposed)
    throw new TypeError('The Jolt recognizer must be mounted and enabled.')
  return endpoint
}
/** Declare between mounted controllers. No relationships are changed during a contact. */
export function gestureRelations(
  relations: readonly GestureRelation[],
): GestureRelations {
  if (!Array.isArray(relations) || !relations.length || relations.length > 128)
    throw new RangeError('Declare 1..128 gesture relationships.')
  const pending = relations.map((item) => {
    if (!item || !['simultaneous', 'waitFor', 'block'].includes(item.relation))
      throw new TypeError('Unknown gesture relationship.')
    const a = endpoints.get(item.gesture)?.(item.kind),
      b = endpoints.get(item.other)?.(item.otherKind)
    if (!a || !b || a.disposed || b.disposed || a === b)
      throw new TypeError('Relationships need distinct, mounted Jolt recognizers.')
    if (a.active || b.active)
      throw new Error('Declare relationships before contact begins.')
    return { a, b, kind: item.relation }
  })
  const all = [...edges]
    .filter((edge) => !edge.a.disposed && !edge.b.disposed)
    .concat(pending)
  const waiting = new Map<GestureEndpoint, Set<GestureEndpoint>>()
  for (const edge of all) {
    if (edge.kind === 'simultaneous') continue
    const [a, b] = edge.kind === 'waitFor' ? [edge.a, edge.b] : [edge.b, edge.a]
    if (!waiting.has(a)) waiting.set(a, new Set())
    waiting.get(a)!.add(b)
    if (
      all.some(
        (candidate) =>
          candidate.kind === 'simultaneous' &&
          ((candidate.a === a && candidate.b === b) ||
            (candidate.a === b && candidate.b === a)),
      )
    )
      throw new TypeError('A recognizer pair cannot be both simultaneous and ordered.')
  }
  const done = new Set<GestureEndpoint>(),
    visiting = new Set<GestureEndpoint>()
  const visit = (node: GestureEndpoint) => {
    if (visiting.has(node))
      throw new TypeError('Gesture failure requirements must not contain cycles.')
    if (done.has(node)) return
    visiting.add(node)
    for (const other of waiting.get(node) ?? []) visit(other)
    visiting.delete(node)
    done.add(node)
  }
  for (const node of waiting.keys()) visit(node)
  const releases: (() => void)[] = []
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const release of releases.reverse()) release()
    for (const edge of pending) edges.delete(edge)
  }
  try {
    for (const edge of pending) {
      releases.push(edge.a.connect(edge.b, edge.kind))
      edges.add(edge)
    }
  } catch (error) {
    dispose()
    throw error
  }
  return {
    get disposed() {
      return disposed
    },
    dispose,
  }
}

/** Browser arbitration. Native adapters execute the same directed failure policy in platform code. */
export class GestureArbiter implements GestureEndpoint {
  disposed = false
  private phase: 'idle' | 'possible' | 'active' | 'failed' | 'recognized' = 'idle'
  private contact: number | undefined
  private ready?: () => void
  private links = new Set<{
    a: GestureArbiter
    b: GestureArbiter
    kind: GestureRelationKind
  }>()
  private releaseCoordination?: () => void
  constructor(
    private readonly cancelInput: () => void,
    private readonly coordinate?: () => () => void,
  ) {}
  private refreshCoordination() {
    if (this.links.size && !this.releaseCoordination)
      this.releaseCoordination = this.coordinate?.()
    else if (!this.links.size) {
      this.releaseCoordination?.()
      this.releaseCoordination = undefined
    }
  }
  get active() {
    return this.phase === 'possible' || this.phase === 'active'
  }
  get coordinated() {
    return this.links.size > 0
  }
  connect(other: GestureEndpoint, kind: GestureRelationKind) {
    if (!(other instanceof GestureArbiter))
      throw new TypeError('Gesture runtimes must match.')
    const link = { a: this, b: other, kind }
    this.links.add(link)
    other.links.add(link)
    this.refreshCoordination()
    other.refreshCoordination()
    return () => {
      this.links.delete(link)
      other.links.delete(link)
      this.refreshCoordination()
      other.refreshCoordination()
      this.reject()
      other.reject()
    }
  }
  begin(contact: number) {
    if (this.disposed) return
    this.contact = contact
    this.phase = 'possible'
    this.ready = undefined
  }
  request(ready: () => void): boolean {
    if (this.disposed || this.phase === 'failed' || this.phase === 'recognized')
      return false
    if (this.phase === 'active') return true
    this.ready = ready
    return this.resolve()
  }
  private resolve(): boolean {
    if (!this.ready || this.phase !== 'possible') return false
    for (const link of this.links) {
      if (link.kind === 'simultaneous') continue
      const waits = link.kind === 'waitFor' ? link.a : link.b
      const other = link.kind === 'waitFor' ? link.b : link.a
      if (waits !== this || other.disposed || other.contact !== this.contact) continue
      if (other.phase === 'active' || other.phase === 'recognized') {
        this.reject()
        return false
      }
      if (other.phase === 'possible' && link.kind === 'waitFor') return false
    }
    this.phase = 'active'
    const ready = this.ready
    this.ready = undefined
    for (const link of [...this.links]) {
      const loser =
        link.kind === 'block' && link.a === this
          ? link.b
          : link.kind === 'waitFor' && link.b === this
            ? link.a
            : undefined
      if (loser && loser.contact === this.contact) loser.reject()
    }
    if (!this.disposed && this.phase === 'active') ready()
    return this.phase === 'active'
  }
  fail() {
    if (this.disposed || this.phase === 'failed' || this.phase === 'recognized') return
    this.phase = 'failed'
    this.ready = undefined
    for (const link of [...this.links]) (link.a === this ? link.b : link.a).resolve()
  }
  finish() {
    if (this.phase === 'active') {
      this.phase = 'recognized'
      this.ready = undefined
    } else this.fail()
  }
  private reject() {
    if (!this.active) return
    this.phase = 'failed'
    this.ready = undefined
    this.cancelInput()
  }
  dispose() {
    if (this.disposed) return
    this.reject()
    this.disposed = true
    for (const link of [...this.links]) {
      const other = link.a === this ? link.b : link.a
      other.reject()
      other.links.delete(link)
      other.refreshCoordination()
    }
    this.links.clear()
    this.ready = undefined
    this.refreshCoordination()
    forgetGestureEndpoint(this)
  }
}
