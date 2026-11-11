import { describe, expect, it } from 'vitest'
import {
  MAX_TEXT_GRAPHEMES,
  isVisiblePiece,
  staggeredStart,
  textPieces,
} from '../src/core/text-pieces.js'

describe('text pieces', () => {
  it('splits letters into graphemes and keeps spaces in the order', () => {
    expect(textPieces('é 👩🏽‍💻', 'letter')).toEqual([
      { text: 'é', start: 0, end: 1, group: 0 },
      { text: ' ', start: 1, end: 2, group: 1 },
      { text: '👩🏽‍💻', start: 2, end: 9, group: 2 },
    ])
  })
  it('splits words with punctuation and spaces as their own pieces', () => {
    expect(
      textPieces('Hello, world!', 'word').map(({ text, group }) => [text, group]),
    ).toEqual([
      ['Hello', 0],
      [',', 1],
      [' ', 2],
      ['world', 3],
      ['!', 4],
    ])
  })
  it('draws nothing for whitespace and staggers by position', () => {
    expect(textPieces('a b', 'letter').map(isVisiblePiece)).toEqual([true, false, true])
    expect(staggeredStart(3, 35, 100)).toBe(205)
    expect(MAX_TEXT_GRAPHEMES).toBe(256)
  })
})
