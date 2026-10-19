// Pure text helpers for the rtl-toggle mod (no engine access, unit-testable).

// Bidi isolate controls. An isolate (RLI ... PDI) sets the base direction of
// the enclosed text without reordering anything around it, unlike the legacy
// embeddings (RLE/PDF).
export const RLI = '\u2067'
export const PDI = '\u2069'
// Legacy embedding controls: no longer emitted, still recognised by the
// double-wrap guard so text wrapped by an older version is not wrapped again.
const LEGACY_RLE = '\u202B'

// Fraction of a line's letters (RTL + Latin only) that must be RTL for the
// line to be wrapped. 0.5 means RTL letters must outnumber Latin letters.
export const RTL_DOMINANCE_THRESHOLD = 0.5

// Hebrew U+0590-05FF, Arabic U+0600-06FF, Arabic Supplement U+0750-077F,
// Hebrew presentation forms U+FB1D-FB4F, Arabic presentation forms-A
// U+FB50-FDFF and forms-B U+FE70-FEFF.
const RTL_RANGES = String.raw`\u0590-\u06FF\u0750-\u077F\uFB1D-\uFDFF\uFE70-\uFEFF`
const RTL_CHAR = new RegExp(`[${RTL_RANGES}]`)
const RTL_CHARS_G = new RegExp(`[${RTL_RANGES}]`, 'g')
// Basic Latin + Latin-1 Supplement + Latin Extended-A/B letters.
const LATIN_LETTERS_G = /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F]/g
const FIRST_STRONG = new RegExp(String.raw`[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F${RTL_RANGES}]`)

// Leading markdown prefix that must stay at column 0 of the rendered line:
// indentation, blockquote markers, then a list marker (with optional task
// checkbox) or an ATX heading marker.
const LIST_MARKER = String.raw`(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?`
const PREFIX_RE = new RegExp(String.raw`^([ \t]*(?:>[ \t]?)*[ \t]*(?:${LIST_MARKER}|#{1,6}[ \t]+)?)`)
const LIST_ITEM_RE = new RegExp(String.raw`^[ \t]*(?:>[ \t]?)*[ \t]*${LIST_MARKER}`)
const INDENTED_CODE_RE = /^(?: {4}|\t)/
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/

// Wrap one line (no newline, no trailing \r) when it is predominantly RTL but
// starts with a Latin letter. Markdown prefixes stay in front of the isolate.
export function wrapLineIfNeeded(line: string): string {
  if (!RTL_CHAR.test(line)) return line // no RTL content at all
  if (line.trimStart().startsWith('|')) return line // table row: left untouched
  if (INDENTED_CODE_RE.test(line) && !LIST_ITEM_RE.test(line)) return line // indented code block

  const prefix = (PREFIX_RE.exec(line) ?? [''])[0]
  const rest = line.slice(prefix.length)
  if (rest.startsWith(RLI) || rest.startsWith(LEGACY_RLE)) return line // already wrapped

  const first = FIRST_STRONG.exec(rest)
  if (!first || RTL_CHAR.test(first[0])) return line // empty, or already RTL-leading

  const rtl = (rest.match(RTL_CHARS_G) ?? []).length
  const latin = (rest.match(LATIN_LETTERS_G) ?? []).length
  if (rtl / (rtl + latin) <= RTL_DOMINANCE_THRESHOLD) return line // English-dominant

  return `${prefix}${RLI}${rest}${PDI}`
}

// Rewrite a whole message: skips fenced code blocks (and their fence lines)
// and keeps CRLF endings outside the isolate.
export function toRtl(text: string): string {
  let fence: { char: string; length: number } | null = null

  return text
    .split('\n')
    .map(raw => {
      const hasCr = raw.endsWith('\r')
      const line = hasCr ? raw.slice(0, -1) : raw
      const m = FENCE_RE.exec(line)

      if (fence) {
        if (m && m[1][0] === fence.char && m[1].length >= fence.length && m[2].trim() === '') fence = null
        return raw
      }
      if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
        fence = { char: m[1][0], length: m[1].length }
        return raw
      }

      return wrapLineIfNeeded(line) + (hasCr ? '\r' : '')
    })
    .join('\n')
}
