import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from '../benchmarks/native-app/node_modules/typescript/lib/typescript.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => JSON.parse(readFileSync(root + path, 'utf8'))
const manifest = read('package.json')
const entries = Object.entries(manifest.exports)
  .filter(([name]) => name !== './package.json')
  .map(([entry, value]) => ({
    entry,
    file: value.types.replace('./dist/', 'src/').replace(/\.d\.ts$/, '.ts'),
  }))
const program = ts.createProgram(
  [
    ...entries.map(({ file }) => root + file),
    root + 'src/types.ts',
    root + 'src/web/types.ts',
  ],
  {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    skipLibCheck: true,
  },
)
const checker = program.getTypeChecker()
const symbols = (file) =>
  checker.getExportsOfModule(
    checker.getSymbolAtLocation(program.getSourceFile(root + file)),
  )
const properties = (file, name) => {
  const symbol = symbols(file).find((s) => s.name === name)
  assert(symbol, `${file}: missing ${name}`)
  return checker
    .getPropertiesOfType(checker.getDeclaredTypeOfSymbol(symbol))
    .map((s) => s.name)
    .sort()
}
const inventory = {
  modules: entries.map(({ entry, file }) => ({
    entry,
    file,
    exports: symbols(file)
      .filter((s) => {
        if (
          s.declarations?.some(
            (d) =>
              ts.isExportSpecifier(d) && (d.isTypeOnly || d.parent.parent.isTypeOnly),
          )
        )
          return false
        const actual = s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s
        return !!(actual.flags & ts.SymbolFlags.Value)
      })
      .map((s) => s.name)
      .sort(),
  })),
  webRuntime: properties('src/web/public.ts', 'WebRuntime'),
  nativeKeyframes: properties('src/types.ts', 'Keyframes'),
  webKeyframes: properties('src/web/types.ts', 'Keyframes'),
}
if (process.argv.includes('--inventory')) {
  process.stdout.write(JSON.stringify(inventory, null, 2) + '\n')
} else {
  const matrix = read('benchmarks/capability-matrix.json')
  assert.deepEqual(
    inventory,
    matrix.inventory,
    'Public API changed: audit and update the capability matrix before accepting parity.',
  )
  const covered = new Set()
  for (const row of matrix.exports) {
    assert(
      ['published', 'partial', 'platform-specific', 'pending'].includes(row.webStatus),
      row.symbol,
    )
    assert(
      row.contract && row.evidence.length,
      `${row.symbol}: missing contract/evidence`,
    )
    for (const file of row.evidence)
      assert(existsSync(root + file), `${row.symbol}: missing ${file}`)
    if (['pending', 'partial'].includes(row.webStatus))
      assert(row.issues?.length, `${row.symbol}: missing tracked work`)
    const key = `${row.entry}:${row.symbol}`
    assert(!covered.has(key), `Duplicate ${key}`)
    covered.add(key)
  }
  assert.deepEqual(
    [...covered].sort(),
    inventory.modules.flatMap((m) => m.exports.map((s) => `${m.entry}:${s}`)).sort(),
  )
  for (const gap of matrix.contracts) {
    assert(gap.issues.length && gap.limit && gap.evidence.length, gap.id)
    for (const file of gap.evidence)
      assert(existsSync(root + file), `${gap.id}: missing ${file}`)
  }
  console.log(
    `Capability matrix: ${covered.size} exports, ${inventory.webRuntime.length} Web methods, ${matrix.contracts.length} explicit contract/acceptance limits. Baseline ${matrix.baseline.version}; this is inventory coverage, not a claim of complete parity.`,
  )
}
