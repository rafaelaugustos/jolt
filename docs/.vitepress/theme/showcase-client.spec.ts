import { describe, expect, it, vi } from 'vitest'
import {
  createShowcaseClient,
  SHOWCASE_FORM_URL,
  type ShowcaseSubmission,
} from './showcase-client'

const input: ShowcaseSubmission = {
  appName: 'My app',
  summary: 'Made with Jolt',
  videoUrl: 'https://example.com/demo.mp4',
  appUrl: 'https://example.com',
  author: 'Ada',
  email: 'ada@example.com',
  website: '',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const entry = (id: string) => ({
  id,
  data: {
    app_name: 'My app',
    summary: 'Made with Jolt',
    video_url: 'https://example.com/demo.mp4',
    app_url: 'https://example.com',
    author: 'Ada',
    email: 'must-not-reach-the-card@example.com',
  },
})

describe('Orbit showcase integration', () => {
  it('maps the fields and sends without credentials or an email API key', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json({ id: 'delivery' }, 202))
    const client = createShowcaseClient({
      fetch: request,
      createId: () => 'submission-001',
    })
    await client.submit(input)
    expect(request).toHaveBeenCalledWith(SHOWCASE_FORM_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'submission-001',
      },
      body: JSON.stringify({
        data: {
          app_name: input.appName,
          summary: input.summary,
          video_url: input.videoUrl,
          app_url: input.appUrl,
          author: input.author,
          email: input.email,
        },
        website: '',
      }),
    })
  })

  it('reuses the key after a lost response but starts a new key after success', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Connection lost after acceptance'))
      .mockResolvedValue(json({ id: 'delivery' }, 202))
    const createId = vi
      .fn()
      .mockReturnValueOnce('submission-001')
      .mockReturnValueOnce('submission-002')
    const client = createShowcaseClient({ fetch: request, createId })
    await expect(client.submit(input)).rejects.toThrow('Connection lost')
    await client.submit(input)
    await client.submit(input)
    const keys = request.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get('Idempotency-Key'),
    )
    expect(keys).toEqual(['submission-001', 'submission-001', 'submission-002'])
  })

  it('starts a new key when the visitor corrects the submission', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 400))
      .mockResolvedValueOnce(json({}, 202))
    const createId = vi
      .fn()
      .mockReturnValueOnce('submission-001')
      .mockReturnValueOnce('submission-002')
    const client = createShowcaseClient({ fetch: request, createId })
    await expect(client.submit(input)).rejects.toMatchObject({
      reason: 'invalid',
    })
    await client.submit({
      ...input,
      videoUrl: 'https://example.com/correct.mp4',
    })
    expect(new Headers(request.mock.calls[1]![1]?.headers).get('Idempotency-Key')).toBe(
      'submission-002',
    )
  })

  it.each([
    [429, 'rate'],
    [400, 'invalid'],
    [422, 'invalid'],
    [403, 'unavailable'],
    [500, 'unavailable'],
    [200, 'unavailable'],
  ])(
    'handles HTTP %s without claiming the submission was saved',
    async (status, reason) => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(json({}, status as number))
      const client = createShowcaseClient({
        fetch: request,
        createId: () => 'submission-001',
      })
      await expect(client.submit(input)).rejects.toMatchObject({ reason })
    },
  )

  it('loads every public page, removes duplicates and never adds contact data to cards', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ items: [entry('a')], nextCursor: 'next+/=' }))
      .mockResolvedValueOnce(json({ items: [entry('a'), entry('b')] }))
    const cards = await createShowcaseClient({ fetch: request }).list()
    expect(cards.map((app) => app.id)).toEqual(['a', 'b'])
    expect(cards[0]).toEqual({
      id: 'a',
      name: 'My app',
      summary: 'Made with Jolt',
      videoUrl: input.videoUrl,
      appUrl: input.appUrl,
      author: 'Ada',
    })
    expect(new URL(request.mock.calls[1]![0] as string).searchParams.get('cursor')).toBe(
      'next+/=',
    )
    expect(request.mock.calls.every(([, init]) => init?.credentials === 'omit')).toBe(
      true,
    )
  })

  it('does not render unsafe links or entries with hidden required showcase fields', async () => {
    const missingName = entry('hidden')
    delete (missingName.data as Record<string, unknown>).app_name
    const unsafeVideo = entry('unsafe')
    unsafeVideo.data.video_url = 'javascript:alert(1)'
    const optional = entry('optional')
    optional.data.app_url = 'javascript:alert(1)'
    optional.data.author = ''
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ items: [missingName, unsafeVideo, optional] }))
    const cards = await createShowcaseClient({ fetch: request }).list()
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      id: 'optional',
      appUrl: null,
      author: null,
    })
  })

  it('stops if pagination repeats a cursor', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => json({ items: [], nextCursor: 'same' }))
    await expect(createShowcaseClient({ fetch: request }).list()).rejects.toMatchObject({
      reason: 'unavailable',
    })
    expect(request).toHaveBeenCalledTimes(2)
  })
})
