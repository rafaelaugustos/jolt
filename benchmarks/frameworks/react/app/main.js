import React, { useRef, useState } from 'react'
import { start } from 'react-nativescript'
import { useAnimate, usePress } from '@rafaelaugusto/jolt/react'

const h = React.createElement
function Card({ value, identity }) {
  const ref = useRef(null)
  useAnimate(ref, value)
  usePress(ref, { scale: 0.94 })
  return h('label', {
    ref,
    key: identity,
    text: 'React NativeScript',
    automationText: 'framework-card',
    width: 180,
    height: 90,
    color: '#102922',
    backgroundColor: '#d6e7b5',
    borderRadius: 18,
    textAlignment: 'center',
  })
}
function App() {
  const [shown, show] = useState(true),
    [side, move] = useState(false),
    [identity, replace] = useState(0)
  return h(
    'stackLayout',
    { padding: 24, backgroundColor: '#102922' },
    h('label', {
      text: 'React · native ownership',
      color: '#eff5da',
      fontSize: 22,
      marginBottom: 35,
    }),
    shown && h(Card, { key: identity, identity, value: { x: side ? 75 : -75 } }),
    h('button', {
      color: '#eff5da',
      backgroundColor: '#244b3b',
      height: 48,
      marginBottom: 8,
      text: 'Interrupt',
      automationText: 'framework-interrupt',
      onTap: () => move(!side),
      marginTop: 30,
    }),
    h('button', {
      color: '#eff5da',
      backgroundColor: '#244b3b',
      height: 48,
      marginBottom: 8,
      text: shown ? 'Unmount' : 'Remount',
      automationText: 'framework-toggle',
      onTap: () => show(!shown),
    }),
    h('button', {
      color: '#eff5da',
      backgroundColor: '#244b3b',
      height: 48,
      marginBottom: 8,
      text: 'Replace ref',
      automationText: 'framework-replace',
      onTap: () => replace(identity + 1),
    }),
  )
}
start(h('page', { actionBarHidden: true }, h(App)))
