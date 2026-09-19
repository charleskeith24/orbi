/**
 * DEV-ONLY sample "photos" for the fixtures (Circles members, Admin → Users): a flat illustrated silhouette
 * on a tinted background, as an SVG data URL — obviously not a real person. Used only by
 * `./fixture-api.ts` and `features/admin/api/fixture-api.ts`, which never load in production.
 */

/** Background / figure pairs. Illustration colors inside an image, not UI tokens. */
const TINTS: [string, string][] = [
  ["#dbeafe", "#3b6fb6"],
  ["#fde7d4", "#b8622a"],
  ["#d5f2ee", "#2f8a7c"],
  ["#fdf1c7", "#a8841c"],
  ["#f6dcec", "#a2447a"],
  ["#dff3d8", "#4b8a3a"],
  ["#e7e1fb", "#6650b3"],
  ["#fbdcdc", "#b04545"],
]

/** A sample avatar image (SVG data URL), picked by `index`. */
export function samplePhoto(index: number): string {
  const [bg, fg] = TINTS[((index % TINTS.length) + TINTS.length) % TINTS.length]
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    `<rect width="64" height="64" fill="${bg}"/>`,
    `<circle cx="32" cy="25" r="11" fill="${fg}" opacity="0.85"/>`,
    `<path d="M10 64c2-13 11-21 22-21s20 8 22 21z" fill="${fg}" opacity="0.85"/>`,
    "</svg>",
  ].join("")
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
