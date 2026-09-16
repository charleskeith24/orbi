#!/usr/bin/env node
/**
 * Renders the Orbi app icons (PWA manifest + Apple touch icon) from the official mark in
 * src/components/app-shell/orbi-logo.tsx, using the locally installed Google Chrome (playwright-core,
 * no browser download). Re-run after changing the logo:
 *
 *   node scripts/generate-icons.mjs
 *
 * Outputs
 *   public/icons/icon-192.png       purpose "any"      rounded tile, transparent corners
 *   public/icons/icon-512.png       purpose "any"      rounded tile, transparent corners
 *   public/icons/maskable-512.png   purpose "maskable" full-bleed tile, mark inside the 80% safe zone
 *   src/app/apple-icon.png          180×180            full-bleed tile (iOS rounds the corners itself)
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const LOGO_SOURCE = path.join(ROOT, "src/components/app-shell/orbi-logo.tsx")

/** The tile and ring colours: the light-theme logo (dark ink on white). */
const TILE = "#ffffff"
const INK = "#1f2328"

// Read the mark's geometry from the logo component so the icons can never drift from it.
const source = fs.readFileSync(LOGO_SOURCE, "utf8")
function constant(name) {
  const match = source.match(new RegExp(`const ${name} = "([^"]+)"`))
  if (!match) throw new Error(`Couldn't find ${name} in ${LOGO_SOURCE}`)
  return match[1]
}
const RING = constant("RING")
const ORBIT = constant("ORBIT")
const ORBIT_FROM = constant("ORBIT_FROM")
const ORBIT_TO = constant("ORBIT_TO")

/**
 * @param size   output size in px
 * @param mark   the mark's 64-unit viewBox as a share of the tile (the ring is centred)
 * @param radius tile corner radius as a share of the tile (0 = full-bleed square)
 */
function iconSvg({ size, mark, radius }) {
  const box = size * mark
  const offset = (size - box) / 2
  const r = size * radius
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="orbit" x1="2" y1="40" x2="54" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${ORBIT_FROM}"/>
      <stop offset="1" stop-color="${ORBIT_TO}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${TILE}"/>
  <svg x="${offset}" y="${offset}" width="${box}" height="${box}" viewBox="0 0 64 64">
    <path d="${RING}" fill="none" stroke="${INK}" stroke-width="8.5"/>
    <path d="${ORBIT}" fill="none" stroke="url(#orbit)" stroke-width="2.8" stroke-linecap="round"/>
    <circle cx="51" cy="16" r="5.2" fill="${ORBIT_TO}"/>
  </svg>
</svg>`
}

// The mark reaches ~31 units from the ring centre (orbit tail, satellite). For the maskable icon that
// has to stay inside the safe-zone circle (radius 40% of the tile): 31 × (0.64 × 512 / 64) ≈ 159px < 205px.
const ICONS = [
  { out: "public/icons/icon-192.png", size: 192, mark: 0.7, radius: 0.225 },
  { out: "public/icons/icon-512.png", size: 512, mark: 0.7, radius: 0.225 },
  { out: "public/icons/maskable-512.png", size: 512, mark: 0.64, radius: 0 },
  { out: "src/app/apple-icon.png", size: 180, mark: 0.7, radius: 0 },
]

const browser = await chromium.launch({ channel: "chrome", headless: true })
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const icon of ICONS) {
    await page.setViewportSize({ width: icon.size, height: icon.size })
    await page.setContent(
      `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head>` +
        `<body>${iconSvg(icon)}</body></html>`
    )
    const file = path.join(ROOT, icon.out)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: icon.size, height: icon.size } })
    console.log(`✓ ${icon.out} (${icon.size}×${icon.size})`)
  }
} finally {
  await browser.close()
}
