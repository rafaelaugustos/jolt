import { graphemes, type Grapheme } from './roll-diff.js'

export type TextGrouping = 'letter' | 'word'

/** A grapheme or word segment, with its position in text order. */
export interface TextPiece extends Grapheme {
  group: number
}

/** Text effects split at most this many graphemes. */
export const MAX_TEXT_GRAPHEMES = 256

/**
 * Letters are extended grapheme clusters. Words are the Unicode word segments the
 * platform reports, with spaces and punctuation as pieces of their own.
 */
export function textPieces(text: string, by: TextGrouping): TextPiece[] {
  if (by === 'letter') return graphemes(text).map((part, group) => ({ ...part, group }))
  const pieces: TextPiece[] = []
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) {
    let start = 0
    for (const [segment] of text.matchAll(/\s+|\S+/gu)) {
      pieces.push({
        text: segment,
        start,
        end: start + segment.length,
        group: pieces.length,
      })
      start += segment.length
    }
    return pieces
  }
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
  for (const { segment, index } of segmenter.segment(text))
    pieces.push({
      text: segment,
      start: index,
      end: index + segment.length,
      group: pieces.length,
    })
  return pieces
}

/** Whitespace keeps its place in the order but draws nothing. */
export function isVisiblePiece(piece: Pick<TextPiece, 'text'>): boolean {
  return piece.text.trim() !== ''
}

/** Milliseconds from the start of the effect until the piece at `index` begins. */
export function staggeredStart(index: number, stagger: number, delay: number): number {
  return delay + index * stagger
}
