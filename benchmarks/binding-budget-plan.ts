/** Workloads are explicit so a missing/edited case cannot silently change a report. */
export interface BudgetCase {
  id: string
  path: 'value' | 'view'
  views: number
  properties: 1 | 3
  layers: number
  playback: 'finite' | 'loop' | 'window'
  observe: boolean
}

export const budgetCases: readonly BudgetCase[] = [
  ...[1, 16, 64, 200].map((views): BudgetCase => ({
    id: `value-${views}-x`,
    path: 'value',
    views,
    properties: 1,
    layers: 0,
    playback: 'finite',
    observe: false,
  })),
  ...[16, 64, 200].map((views): BudgetCase => ({
    id: `value-${views}-x-scale`,
    path: 'value',
    views,
    properties: 3,
    layers: 0,
    playback: 'finite',
    observe: false,
  })),
  ...(['value', 'view'] as const).flatMap((path) =>
    [2, 4, 8].map((layers): BudgetCase => ({
      id: `${path}-16-layers-${layers}`,
      path,
      views: 16,
      properties: 3,
      layers,
      playback: 'finite',
      observe: false,
    })),
  ),
  ...(['value', 'view'] as const).flatMap((path) => [
    {
      id: `${path}-64-loop`,
      path,
      views: 64,
      properties: 3 as const,
      layers: 2,
      playback: 'loop' as const,
      observe: false,
    },
    ...[1, 16, 64].map((views): BudgetCase => ({
      id: `${path}-${views}-window`,
      path,
      views,
      properties: 3,
      layers: 2,
      playback: 'window',
      observe: false,
    })),
  ]),
  {
    id: 'value-64-observed',
    path: 'value',
    views: 64,
    properties: 3,
    layers: 0,
    playback: 'finite',
    observe: true,
  },
]

export const budgetSettings = {
  warmups: 2,
  preparations: 7,
  trials: 3,
  finiteDurationMs: 1800,
  finiteWindowMs: 2200,
  endlessWindowMs: 8800,
  idleWindowMs: 600,
  baseX: 24,
  baseScale: 1.25,
} as const

export function layerDuration(item: BudgetCase, index: number): number {
  return item.playback === 'finite'
    ? budgetSettings.finiteDurationMs
    : item.playback === 'loop'
      ? [800, 1200][index % 2]!
      : [701, 709][index % 2]!
}
