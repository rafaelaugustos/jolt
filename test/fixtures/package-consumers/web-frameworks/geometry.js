/** Existing Web backends, owned by each real framework's scoped resource boundary. */
export function geometrySetup(scope, host, runtime) {
  host.innerHTML = `<section data-geometry><h2>Panels that make room.</h2><p>Measured snap points · nested scroll · focus return</p>
  <div class="geometry-panel-host" data-panel-host>
    <div class="geometry-panel-background" data-panel-background><span class="geometry-mountain">△</span><h3>A weekend away</h3><button data-panel-open>Open details</button></div>
    <div class="geometry-backdrop" data-panel-backdrop></div>
    <div class="geometry-panel" data-panel role="region" aria-label="Trip details"><div data-panel-handle>☰ &nbsp; Trip details</div>
      <div class="geometry-panel-scroll" data-panel-scroll><div data-panel-content>
        <div class="controls"><button data-panel-expand>Expand</button><button data-panel-compact>Compact</button><button data-panel-close>Close</button></div>
        <label>Add a note <input data-panel-note placeholder="Bring a camera"></label>
        ${Array.from({ length: 8 }, (_, i) => `<article><strong>Stop ${i + 1}</strong><p>A quiet trail, a warm meal and room to explore.</p></article>`).join('')}
      </div></div></div></div><output data-panel-status>closed</output>
  <h2>Follow the shape.</h2><p>Quadratic + cubic · arc-length progress · tangent orientation</p>
  <div class="geometry-curve"><svg viewBox="0 0 320 180" aria-hidden="true"><path d="M35 130 Q95 -10 160 90 C225 190 230 -10 285 50" fill="none" stroke="#dbff7a66" stroke-width="3" stroke-dasharray="5 4"/></svg><div data-curve-marker>➤</div></div>
  <div class="controls"><button data-curve-play>Follow curve</button><button data-curve-reverse>Reverse</button><button data-curve-cancel>Cancel</button></div><output data-curve-status>ready</output>
  <h3>Rows measured from their content</h3><div class="geometry-rows" data-measured-list></div><output data-measured-status></output>
  <div class="controls"><button data-measured-resize>Change text</button><button data-measured-reset>Reset order</button></div>
  <p>9 realized rows. Geometry changes cancel an active drag. CSS pixels; browser keyboard space depends on VisualViewport.</p></section>`
  const q = (selector) => host.querySelector(selector),
    abort = new AbortController()
  scope.add(() => host.replaceChildren())
  scope.add(() => abort.abort())
  const on = (selector, action) =>
    q(selector).addEventListener('click', action, { signal: abort.signal })
  const owner = { scope, host }
  owner.sheet = scope.bottomSheet(q('[data-panel]'), {
    host: q('[data-panel-host]'),
    handle: q('[data-panel-handle]'),
    snap: [220, '85%', 'content'],
    scrollView: q('[data-panel-scroll]'),
    content: q('[data-panel-content]'),
    backdrop: q('[data-panel-backdrop]'),
    returnFocus: q('[data-panel-open]'),
    label: 'Trip details height',
    onChange(point) {
      q('[data-panel-status]').textContent = point === null ? 'closed' : `open · ${point}`
      q('[data-panel-background]').inert = point !== null
    },
  })
  on('[data-panel-open]', () => {
    // The document may have scrolled since this in-page host was mounted.
    owner.sheet.remeasure()
    owner.sheet.open(220)
    q('[data-panel-handle]').focus({ preventScroll: true })
  })
  on('[data-panel-expand]', () => owner.sheet.expand())
  on('[data-panel-compact]', () => owner.sheet.snapTo(220))
  on('[data-panel-close]', () => owner.sheet.dismiss())
  let animation
  const play = (path) => {
    if (animation) scope.release(animation)
    q('[data-curve-status]').textContent = 'running'
    animation = scope.animate(
      q('[data-curve-marker]'),
      { path, orient: true },
      { duration: 2400, ease: 'linear' },
    )
    const current = animation
    animation.finished.then(() => {
      if (animation === current && !scope.disposed)
        q('[data-curve-status]').textContent = 'completed'
    })
  }
  runtime.set(q('[data-curve-marker]'), { x: 35, y: 130 })
  on('[data-curve-play]', () => play('M35 130 Q95 -10 160 90 C225 190 230 -10 285 50'))
  on('[data-curve-reverse]', () => play('M285 50 C230 -10 225 190 160 90 Q95 -10 35 130'))
  on('[data-curve-cancel]', () => {
    if (animation) scope.release(animation)
    animation = undefined
    q('[data-curve-status]').textContent = 'cancelled'
  })
  const original = Array.from({ length: 9 }, (_, i) => `Stop ${i + 1}`),
    list = q('[data-measured-list]')
  let keys = [...original],
    expanded = false
  const rows = new Map(
    keys.map((key) => {
      const row = document.createElement('div')
      row.className = 'geometry-row'
      row.dataset.measuredKey = key
      const text = document.createElement('div')
      text.innerHTML = `<strong>${key}</strong>`
      if (key === 'Stop 2')
        text.innerHTML +=
          '<p data-measured-description>A longer stop with room to explore.<br>Bring water and take a break.</p>'
      if (key === 'Stop 3') text.innerHTML += '<p>Coffee by the river.</p>'
      const handle = document.createElement('button')
      handle.dataset.measuredHandle = ''
      handle.textContent = '☰'
      handle.setAttribute('aria-label', `Move ${key}`)
      row.append(text, handle)
      return [key, row]
    }),
  )
  const render = () => {
    for (const key of keys) list.append(rows.get(key))
    q('[data-measured-status]').textContent = keys.slice(0, 3).join(', ')
  }
  render()
  owner.reorder = scope.reorder(list, {
    items: () => keys.map((key) => ({ key, target: rows.get(key) })),
    handle: '[data-measured-handle]',
    scrollContainer: list,
    onCommit({ key, toIndex }) {
      keys.splice(keys.indexOf(key), 1)
      keys.splice(toIndex, 0, key)
      render()
      owner.reorder.refresh()
    },
    onCancel({ reason }) {
      owner.cancelReason = reason
    },
  })
  on('[data-measured-resize]', () => {
    expanded = !expanded
    q('[data-measured-description]').innerHTML = expanded
      ? 'A longer stop with more room to explore.<br>Bring water and take a break.<br>The measured height follows this text.<br>No fixed row height is assumed.'
      : 'A longer stop with room to explore.<br>Bring water and take a break.'
    owner.reorder.refresh()
  })
  on('[data-measured-reset]', () => {
    owner.reorder.cancel()
    keys = [...original]
    render()
    owner.reorder.refresh()
    list.scrollTop = 0
  })
  ;(window.geometryOwners ??= []).push(owner)
}
