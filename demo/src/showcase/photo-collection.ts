declare const JoltSharedLayoutFlight: { activeCount(): number }
declare const JoltInteractiveNavigation: { recognizerCount(): number }
import {
  Application,
  File,
  isIOS,
  knownFolders,
  type Frame,
  type Image,
  type ListView,
  type View,
} from '@nativescript/core'
import { computed, nextTick, ref, shallowRef } from 'nativescript-vue'
import {
  sharedNavigationEntry,
  resolveListTarget,
  type SharedNavigationEntry,
  type SharedNavigationEntryEvent,
} from '@rafaelaugusto/jolt/shared-navigation'
import { configure } from '@rafaelaugusto/jolt'
import { findView, launchArgument } from '../launch'

export interface CollectionPhoto {
  key: string
  src: string
  title: string
  note: string
  height: number
}
const originals = (): CollectionPhoto[] =>
  Array.from({ length: 60 }, (_, i) => ({
    key: `place-${i + 1}`,
    src: i % 2 ? '~/assets/studio/dunes.png' : '~/assets/studio/cove.png',
    title: i % 2 ? 'Quiet dunes' : 'Cala Serena',
    note: i % 2 ? 'A softer kind of silence.' : 'Somewhere worth coming back to.',
    height: i % 3 === 0 ? 212 : 180,
  }))
export const collectionPhotos = shallowRef(originals())
export const collectionRows = computed(() =>
  Array.from({ length: Math.ceil(collectionPhotos.value.length / 2) }, (_, i) =>
    collectionPhotos.value.slice(i * 2, i * 2 + 2),
  ),
)
export const selectedPhoto = shallowRef<CollectionPhoto>()
export const collectionStatus = ref('Find a place. Make it yours.')
export const collectionReduced = ref(false)
export const collectionAudit = () => launchArgument('collection-audit') !== undefined
export let collectionList: ListView | undefined
export let collectionEntry: SharedNavigationEntry | undefined
export let collectionGate = () => true
export const setCollectionList = (view: ListView) => {
  collectionList = view
}
export function releaseCollection() {
  collectionEntry?.dispose()
  collectionEntry = undefined
  collectionList = undefined
}
export const photoTag = (key: string) => `collection:${key}`
const events: SharedNavigationEntryEvent[] = [],
  snapshots: object[] = []
let commits = 0,
  resolvedTag: string | undefined,
  requestKey: string | undefined
export function resetCollection() {
  collectionPhotos.value = originals()
  collectionStatus.value = 'Find a place. Make it yours.'
  void nextTick(() => {
    const list = collectionList
    if (!list) return
    if (isIOS) list.ios.layoutIfNeeded()
    list.scrollToIndex(0)
    if (isIOS) {
      list.ios.layoutIfNeeded()
      list.ios.setContentOffsetAnimated(
        CGPointMake(0, -list.ios.adjustedContentInset.top),
        false,
      )
    }
  })
}
export function moveSelected() {
  const current = selectedPhoto.value
  if (!current) return
  collectionPhotos.value = [
    ...collectionPhotos.value.filter((p) => p.key !== current.key),
    current,
  ]
  collectionStatus.value = 'Moved. The way back follows.'
}
export function removeSelected() {
  collectionPhotos.value = collectionPhotos.value.filter(
    (p) => p.key !== selectedPhoto.value?.key,
  )
  collectionStatus.value = 'Removed. Still a graceful way back.'
}
export function auditCollection(frame: Frame) {
  if (!collectionAudit()) return
  const tags: object[] = []
  const geometry = (native: UIView) => {
    const r = native.convertRectToView(native.bounds, null)
    return {
      x: r.origin.x,
      y: r.origin.y,
      w: r.size.width,
      h: r.size.height,
      hidden: native.hidden,
      alpha: native.alpha,
      window: !!native.window,
      type: String(native.class()),
    }
  }
  const visit = (v: View) => {
    if (v.sharedTransitionTag && v.nativeViewProtected)
      tags.push({
        tag: v.sharedTransitionTag,
        visible: isIOS
          ? !v.nativeViewProtected.hidden
          : v.nativeViewProtected.getVisibility() === 0,
        frame: isIOS ? geometry(v.nativeViewProtected) : undefined,
      })
    v.eachChildView((c) => {
      visit(c)
      return true
    })
  }
  visit(frame.currentPage)
  const native = isIOS ? undefined : (org.rafaelaugusto.jolt as any)
  const snapshot = {
    state: collectionEntry?.state,
    page: frame.currentPage.id,
    depth: frame.backStack.length,
    key: requestKey,
    index: collectionPhotos.value.findIndex((p) => p.key === requestKey),
    resolvedTag,
    tags,
    flights: isIOS
      ? JoltSharedLayoutFlight.activeCount()
      : native.SharedLayoutFlight.activeCount(),
    inputs: isIOS
      ? JoltInteractiveNavigation.recognizerCount()
      : native.PredictiveBackSession.callbackCount(),
    retained: isIOS ? 0 : native.SharedNavigationScene.retainedCount(),
    cells:
      isIOS && collectionList?.ios
        ? (() => {
            const cells = []
            const list = collectionList.ios as UITableView
            for (let i = 0; i < list.visibleCells.count; i++) {
              const cell = list.visibleCells.objectAtIndex(i)
              cells.push({
                index: list.indexPathForCell(cell)?.row,
                ...geometry(cell),
                children: cell.contentView.subviews.count,
                content: geometry(cell.contentView),
              })
            }
            return cells
          })()
        : undefined,
  }
  snapshots.push(snapshot)
  const directory = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
  File.fromPath(directory + '/jolt-collection.json').writeTextSync(
    JSON.stringify({ ...snapshot, commits, events, snapshots }),
  )
}
export async function openCollectionPhoto(
  image: Image,
  photo: CollectionPhoto,
  router: {
    push: (path: string, options: object) => unknown
    back: (options?: object) => Promise<unknown>
  },
  route = '/return-photo/',
) {
  if (collectionEntry && collectionEntry.state !== 'disposed') return
  selectedPhoto.value = photo
  requestKey = photo.key
  resolvedTag = undefined
  configure({ reducedMotion: collectionReduced.value ? 'always' : 'user' })
  const frame = image.page.frame
  collectionEntry = sharedNavigationEntry(frame, {
    tag: photoTag(photo.key),
    spring: { duration: 420, bounce: 0 },
    canBegin: () => collectionGate(),
    returnTarget: {
      key: photo.key,
      timeout: 2000,
      async resolve(context) {
        const list = collectionList
        if (!list || !collectionPhotos.value.some((p) => p.key === context.key)) return
        const view = await resolveListTarget(context, {
          list,
          indexOf: (key) => {
            const i = collectionPhotos.value.findIndex((p) => p.key === key)
            return i < 0 ? -1 : Math.floor(i / 2)
          },
          viewForKey: (key) =>
            findView(
              list,
              (v) =>
                v.sharedTransitionTag === photoTag(key) &&
                v.getLocationInWindow() !== undefined,
            ),
        })
        resolvedTag = view?.sharedTransitionTag
        return view
      },
      fallbackFocus: (page) =>
        findView(page, (v) => v.automationText === 'collection-heading'),
    },
    back: async (options) => {
      commits++
      return (await router.back(options)) === undefined
    },
    onState(event) {
      if (collectionAudit()) events.push(event)
      if (event.outcome === 'cancelled')
        collectionStatus.value = 'Changed your mind. Your place is still here.'
      void Promise.resolve().then(() => auditCollection(frame))
      if (event.state === 'disposed' && collectionAudit())
        setTimeout(() => auditCollection(frame), 700)
    },
  })
  await collectionEntry.open((options) => router.push(route + photo.key, options))
  auditCollection(frame)
}
