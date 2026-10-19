// Deterministic raster targets for checking geometry, transparency and source changes.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
function crc(bytes) {
  let c = 0xffffffff
  for (const b of bytes) {
    c ^= b
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
  }
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type),
    length = Buffer.alloc(4),
    sum = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  sum.writeUInt32BE(crc(Buffer.concat([t, data])))
  return Buffer.concat([length, t, data, sum])
}
function png(target) {
  const width = target ? 256 : 384,
    height = target ? 384 : 256
  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 4 + 1) + 1 + x * 4,
        grid = x % 32 < 2 || y % 32 < 2,
        circle = Math.hypot(x - width / 2, y - height / 2) < 46
      const color = target
        ? [60 + x / 3, 180 - y / 3, 240 - x / 4, 255]
        : [230 - x / 4, 70 + y / 2, 100 + x / 3, 255]
      if (grid) color.splice(0, 3, 245, 245, 245)
      if (circle) color.splice(0, 3, 250, 210, 50)
      if (target && x < 64 && y < 64) color[3] = 0
      color.forEach((v, i) => (rows[offset + i] = Math.round(v)))
    }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
const dir = new URL('../demo/src/assets/', import.meta.url)
mkdirSync(dir, { recursive: true })
writeFileSync(new URL('image-grid.png', dir), png(false))
writeFileSync(new URL('image-target.png', dir), png(true))
