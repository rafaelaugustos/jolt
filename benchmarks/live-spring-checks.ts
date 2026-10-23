import { GridLayout, Label, isIOS, type View } from '@nativescript/core'
import {
  animate,
  bind,
  configure,
  motionScope,
  motionValue,
  set,
  springValue,
} from '@rafaelaugusto/jolt'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
export async function runLiveSpringChecks(first: View, second: View) {
  const samples: object[] = []
  const assert = (value: unknown, message: string) => {
    if (!value) throw new Error(message)
  }
  const nativeCount = () =>
    isIOS ? JoltLiveSpring.nodeCount() : org.rafaelaugusto.jolt.LiveSpring.nodeCount()
  const activeCount = () =>
    isIOS ? JoltLiveSpring.activeCount() : org.rafaelaugusto.jolt.LiveSpring.activeCount()
  const baseline = nativeCount()
  const scope = motionScope()
  const pointer = motionValue(0)
  const one = scope.add(springValue(pointer, { stiffness: 260, damping: 24 }))
  const two = scope.add(springValue(one, { stiffness: 260, damping: 24 }))
  const three = scope.add(springValue(two, { stiffness: 260, damping: 24 }))
  scope.use(() => bind(first, { x: three }))
  scope.use(() => bind(second, { y: one.to([0, 120], [0, 60]) }))
  const layoutProbe = new Label()
  layoutProbe.width = 40
  layoutProbe.height = 20
  layoutProbe.horizontalAlignment = 'left'
  layoutProbe.verticalAlignment = 'top'
  layoutProbe.marginLeft = 7
  layoutProbe.marginTop = 11
  const layoutValue = scope.add(springValue(motionValue(90), { duration: 0 }))
  scope.use(() => bind(layoutProbe, { x: layoutValue }))
  const parent = first.parent as GridLayout
  parent.addChild(layoutProbe)
  try {
    await wait(80)
    for (const width of [40, 65]) {
      layoutProbe.width = width
      await wait(80)
      const position = layoutProbe.getLocationRelativeTo(parent)
      assert(
        position && Math.abs(position.x - 97) < 1,
        `Layout shifted the live binding base: ${position?.x}`,
      )
    }
    assert(
      nativeCount() === baseline + 4,
      'Follower chain and layout probe did not retain four native nodes',
    )
    set(pointer, 120)
    await wait(240)
    const firstSample = [one.get(), two.get(), three.get()]
    samples.push({ chain: firstSample })
    assert(
      firstSample.every(Number.isFinite) &&
        firstSample[0]! > firstSample[2]! &&
        firstSample[2]! > 0,
      `No native chain lag: ${firstSample}`,
    )
    const position = one.get(),
      velocity = one.getVelocity()
    set(pointer, -80)
    assert(
      Math.abs(one.get() - position) < 0.001 &&
        Math.abs(one.getVelocity() - velocity) < 0.001,
      'Retarget reset native position or velocity',
    )
    await wait(180)
    assert(one.getVelocity() < 0, 'Follower did not reverse toward the new target')
    scope.suspend()
    const heldPosition = one.get(),
      heldVelocity = one.getVelocity()
    set(pointer, 30)
    await wait(120)
    assert(
      one.get() === heldPosition && one.getVelocity() === heldVelocity && !one.disposed,
      'Scope suspension did not preserve spring state',
    )
    scope.resume()
    await wait(120)
    const shake = scope.add(
      animate(
        first,
        { x: [0, 20, 0] },
        { layer: 'feedback', duration: 600, ease: 'linear' },
      ),
    )
    shake.pause()
    shake.progress = 0.5
    await wait(120)
    const nativeX = isIOS
      ? Number(
          (first.ios as UIView).layer
            .presentationLayer()!
            .valueForKeyPath('transform.translation.x'),
        )
      : (first.android as android.view.View).getTranslationX() /
        (first.android as android.view.View).getResources().getDisplayMetrics().density
    samples.push({ mixed: nativeX, base: three.get() })
    assert(
      Math.abs(nativeX - three.get() - 20) < 3,
      `Layer competed with live base: ${nativeX}, ${three.get()}`,
    )
    shake.stop()
    const timeline = scope.add(animate(pointer, 200, { duration: 1200, ease: 'linear' }))
    await wait(300)
    assert(
      one.get() > -80 && one.get() < 200 && one.getVelocity() > 0,
      'Follower did not follow the sampled native source timeline',
    )
    timeline.pause()
    const heldTarget = pointer.get()
    await wait(1800)
    assert(
      Math.abs(one.get() - heldTarget) < 0.02,
      'Pausing the source did not hold the native target',
    )
    timeline.stop()
    const nodeCount = nativeCount()
    for (let index = 0; index < 300; index++) set(pointer, index % 2 ? 120 : -80)
    assert(nativeCount() === nodeCount, 'Retargeting allocated new native spring nodes')
    const delayedUntil = Date.now() + 100
    while (Date.now() < delayedUntil) {
      /* Simulate a dropped UI frame. */
    }
    await wait(80)
    assert(
      [one.get(), two.get(), three.get(), one.getVelocity()].every(Number.isFinite),
      'Delayed frame destabilized native state',
    )
    set(pointer, 70)
    const deadline = Date.now() + 7000
    while ((one.moving || two.moving || three.moving) && Date.now() < deadline)
      await wait(80)
    assert(
      !three.moving && Math.abs(three.get() - 70) < 0.01,
      'Native follower did not settle',
    )
    await wait(80)
    assert(activeCount() === 0, 'Native display callback remained scheduled at rest')
    assert(scope.size >= 3, 'Rest incorrectly ended the retained subscription')
    first.requestLayout()
    set(first, { y: 12 })
    await wait(100)
    const restedX = isIOS
      ? Number(
          (first.ios as UIView).layer
            .presentationLayer()!
            .valueForKeyPath('transform.translation.x'),
        )
      : (first.android as android.view.View).getTranslationX() /
        (first.android as android.view.View).getResources().getDisplayMetrics().density
    assert(
      Math.abs(restedX - 70) < 1,
      'Layout or an unrelated transform reset a resting binding',
    )
    set(pointer, 20)
    await wait(180)
    assert(three.moving && three.get() < 70, 'Retained follower did not wake')
    configure({ reducedMotion: 'always' })
    set(pointer, 100)
    await wait(80)
    assert(Math.abs(three.get() - 100) < 0.001, 'Reduced motion did not settle the chain')
    configure({ reducedMotion: 'never' })
    const instant = scope.add(springValue(pointer, { duration: 0, initial: 0 }))
    assert(instant.get() === 100, 'Zero-duration follower did not jump')
    const mapped = scope.add(
      springValue(instant.to([100, 50, 50, 0], [0, 20, 40, 80]), { duration: 0 }),
    )
    for (const target of [100, 50, 49, 0, -10, 120]) {
      set(pointer, target)
      await wait(40)
      const expected = instant.to([100, 50, 50, 0], [0, 20, 40, 80]).get()
      assert(
        Math.abs(mapped.get() - expected) < 0.001,
        `Native repeated/descending mapping diverged at ${target}: ${mapped.get()} != ${expected}`,
      )
    }
  } finally {
    scope.dispose()
    parent.removeChild(layoutProbe)
    configure({ reducedMotion: 'never' })
  }
  await wait(80)
  assert(
    nativeCount() === baseline && activeCount() === 0,
    'Scope leaked native follower nodes or display callbacks',
  )
  return samples
}
