export const SHOWCASE_FORM_URL =
  'https://manager.getcortexlabs.com/api/v1/public/forms/frm_yefh1h3u7uki/submissions'

export interface AppCard {
  id: string
  name: string
  summary: string
  videoUrl: string
  appUrl: string | null
  author: string | null
}

export interface ShowcaseSubmission {
  appName: string
  summary: string
  videoUrl: string
  appUrl: string
  author: string
  email: string
  website: string
}

export class ShowcaseError extends Error {
  constructor(public readonly reason: 'invalid' | 'rate' | 'unavailable') {
    super(reason)
  }
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? value : null
  } catch {
    return null
  }
}

function card(value: unknown): AppCard | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as { id?: unknown; data?: Record<string, unknown> }
  const data = entry.data
  if (
    typeof entry.id !== 'string' ||
    !data ||
    typeof data.app_name !== 'string' ||
    typeof data.summary !== 'string'
  )
    return null
  const videoUrl = httpsUrl(data.video_url)
  if (!videoUrl) return null
  return {
    id: entry.id,
    name: data.app_name,
    summary: data.summary,
    videoUrl,
    appUrl: httpsUrl(data.app_url),
    author: typeof data.author === 'string' && data.author ? data.author : null,
  }
}

export function createShowcaseClient(
  options: { fetch?: typeof fetch; createId?: () => string } = {},
) {
  const request = options.fetch ?? ((...args) => globalThis.fetch(...args))
  const createId = options.createId ?? (() => crypto.randomUUID())
  let pending: { body: string; key: string } | undefined

  async function list(): Promise<AppCard[]> {
    const url = new URL(SHOWCASE_FORM_URL.replace(/\/submissions$/, '/entries'))
    const result: AppCard[] = []
    const seenEntries = new Set<string>()
    const seenCursors = new Set<string>()
    while (true) {
      const response = await request(url.toString(), { credentials: 'omit' })
      if (!response.ok) throw new ShowcaseError('unavailable')
      const page: { items?: unknown[]; nextCursor?: unknown } = await response.json()
      if (!Array.isArray(page.items)) throw new ShowcaseError('unavailable')
      for (const entry of page.items) {
        const app = card(entry)
        if (app && !seenEntries.has(app.id)) {
          result.push(app)
          seenEntries.add(app.id)
        }
      }
      if (!page.nextCursor) return result
      if (typeof page.nextCursor !== 'string' || seenCursors.has(page.nextCursor))
        throw new ShowcaseError('unavailable')
      seenCursors.add(page.nextCursor)
      url.searchParams.set('cursor', page.nextCursor)
    }
  }

  async function submit(input: ShowcaseSubmission): Promise<void> {
    const body = JSON.stringify({
      data: {
        app_name: input.appName.trim(),
        summary: input.summary.trim(),
        video_url: input.videoUrl.trim(),
        app_url: input.appUrl.trim(),
        author: input.author.trim(),
        email: input.email.trim(),
      },
      website: input.website,
    })
    // Keep the same key when retrying after a lost response. A successful
    // submission or changed input starts a new intentional submission.
    if (!pending || pending.body !== body) pending = { body, key: createId() }
    const response = await request(SHOWCASE_FORM_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': pending.key,
      },
      body,
    })
    if (response.status === 429) throw new ShowcaseError('rate')
    if (response.status === 400 || response.status === 422)
      throw new ShowcaseError('invalid')
    if (response.status !== 202) throw new ShowcaseError('unavailable')
    pending = undefined
  }

  return { list, submit }
}
