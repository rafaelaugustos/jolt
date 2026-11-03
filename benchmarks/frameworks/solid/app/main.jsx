import { Application } from '@nativescript/core'
import { createSignal, createRoot } from 'solid-js'
import { document, registerAllElements } from 'dominative'
import { createElement, insertNode } from '@dominative/solid'
import { animate, press } from '@rafaelaugusto/jolt/solid'

registerAllElements()
const page = document.body
page.backgroundColor = '#102922'
const layout = createElement('stacklayout')
layout.padding = 24
insertNode(page, layout)
const title = createElement('label')
Object.assign(title, {
  text: 'Solid · native ownership',
  color: '#eff5da',
  fontSize: 22,
  marginBottom: 35,
})
insertNode(layout, title)
let disposeCard,
  card,
  side = false
const [position, setPosition] = createSignal({ x: -75 })
function mount() {
  createRoot((dispose) => {
    disposeCard = dispose
    card = (
      <label
        use:animate={position()}
        use:press={{ scale: 0.94 }}
        text="Solid / DOMiNATIVE"
        automationText="framework-card"
        width={180}
        height={90}
        color="#102922"
        backgroundColor="#d6e7b5"
        borderRadius={18}
        textAlignment="center"
      />
    )
    insertNode(layout, card, layout.children[1])
  })
}
function unmount() {
  disposeCard?.()
  disposeCard = undefined
  if (card) layout.removeChild(card)
  card = undefined
}
for (const [text, id, action] of [
  [
    'Interrupt',
    'framework-interrupt',
    () => {
      side = !side
      setPosition({ x: side ? 75 : -75 })
    },
  ],
  ['Unmount / remount', 'framework-toggle', () => (card ? unmount() : mount())],
  [
    'Replace directive',
    'framework-replace',
    () => {
      unmount()
      mount()
    },
  ],
]) {
  const button = createElement('button')
  Object.assign(button, {
    color: '#eff5da',
    backgroundColor: '#244b3b',
    height: 48,
    marginBottom: 8,
    text,
    automationText: id,
  })
  button.on('tap', action)
  insertNode(layout, button)
}
mount()
page.on('navigatedFrom', unmount)
Application.run({ create: () => document.documentElement })
