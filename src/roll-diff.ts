export interface Grapheme {
  text: string
  /** UTF-16 offsets, the units NSString locations and Java char indices use. */
  start: number
  end: number
}

export interface RollChange {
  /** The grapheme that rolls in, placed in the new text. */
  next: Grapheme
  /** The grapheme it replaces at the same position from the end, when there is one. */
  previous: Grapheme | undefined
}

export interface RollDiff {
  /** Positions that differ, from the last one backwards. */
  changes: RollChange[]
  /** Old graphemes to the left of the new text's first one; they roll out alone. */
  removed: Grapheme[]
}

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : undefined

export function graphemes(text: string): Grapheme[] {
  if (segmenter)
    return [...segmenter.segment(text)].map(({ segment, index }) => ({
      text: segment,
      start: index,
      end: index + segment.length,
    }))
  const pieces: Grapheme[] = []
  let offset = 0
  for (const character of text) {
    pieces.push({ text: character, start: offset, end: offset + character.length })
    offset += character.length
  }
  return pieces
}

/** Aligns both texts on their last grapheme, so the units digit stays put when the count grows. */
export function diffFromEnd(previous: string, next: string): RollDiff {
  const before = graphemes(previous)
  const after = graphemes(next)
  const changes: RollChange[] = []
  const removed: Grapheme[] = []
  const count = Math.max(before.length, after.length)
  for (let offset = 1; offset <= count; offset++) {
    const old = before[before.length - offset]
    const piece = after[after.length - offset]
    if (!piece) removed.push(old!)
    else if (!old || old.text !== piece.text) changes.push({ next: piece, previous: old })
  }
  return { changes, removed }
}
