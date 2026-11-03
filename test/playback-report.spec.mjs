import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { PlaybackReport } from '../benchmarks/playback-report'

it('reconstructs every native sample from the reviewed report using append-only messages', () => {
  const original = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL(
          '../benchmarks/results/playback-efficiency/2026-11-03-android.json.gz',
          import.meta.url,
        ),
      ),
    ),
  )
  const { batches, playback, retention, ...header } = original
  const writer = new PlaybackReport()
  writer.accept({ type: 'start', header: { ...header, phase: 'checking' } })
  for (const value of batches)
    writer.accept({ type: 'append', collection: 'batches', value })
  for (const { frames, ...value } of playback)
    writer.accept({
      type: 'append',
      collection: 'playback',
      value,
      framesJSON: JSON.stringify(frames),
    })
  for (const value of retention)
    writer.accept({ type: 'append', collection: 'retention', value })
  expect(writer.accept({ type: 'patch', value: { phase: 'done' } })).toEqual(original)
})

it('rejects missing/duplicate initialization and malformed native samples', () => {
  const writer = new PlaybackReport()
  expect(() => writer.accept({ type: 'patch', value: {} })).toThrow('Start')
  writer.accept({ type: 'start', header: {} })
  expect(() => writer.accept({ type: 'start', header: {} })).toThrow('already')
  expect(() =>
    writer.accept({ type: 'append', collection: 'playback', value: {}, framesJSON: '{' }),
  ).toThrow()
  expect(writer.accept({ type: 'patch', value: {} }).playback).toEqual([])
})
