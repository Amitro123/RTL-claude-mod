// Pure text helpers for the rtl-toggle mod (no engine access, unit-testable).

// RIGHT-TO-LEFT MARK: a zero-width strong RTL character. Placed first in a
// block's content it becomes the first strong char, so renderers using
// automatic direction (dir=auto / UBA rule P2) give the block an RTL base
// direction and right alignment. Isolates (RLI...PDI) are not used because
// P2 skips isolate contents, leaving such blocks LTR-aligned.
export const RLM = '\u200F'
// Legacy controls: no longer emitted, still recognised by the double-mark
// guard so text marked by an older version is not marked again.
const LEGACY_RLI = '\u2067'
const LEGACY_RLE = '\u202B'

// Dominance is counted in WORDS (maximal runs of RTL letters or of Latin
// letters), not letters. A line is marked when it has at least one RTL word and
// rtlWords / (rtlWords + latinWords) >= MIN_RTL_WORD_SHARE, i.e. RTL words are
// at least as many as Latin words: a tie goes to RTL.
export const MIN_RTL_WORD_SHARE = 0.5

// Hebrew U+0590-05FF, Arabic U+0600-06FF, Arabic Supplement U+0750-077F,
// Hebrew presentation forms U+FB1D-FB4F, Arabic presentation forms-A
// U+FB50-FDFF and forms-B U+FE70-FEFF.
const RTL_RANGES = String.raw`\u0590-\u06FF\u0750-\u077F\uFB1D-\uFDFF\uFE70-\uFEFF`
const RTL_CHAR = new RegExp(`[${RTL_RANGES}]`)
const RTL_WORDS_G = new RegExp(`[${RTL_RANGES}]+`, 'g')
// Latin words: Basic Latin + Latin-1 Supplement + Latin Extended-A/B letters.
const LATIN_WORDS_G = /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F]+/g
const FIRST_STRONG = new RegExp(String.raw`[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F${RTL_RANGES}]`)

// Leading markdown prefix that must stay at column 0 of the rendered line:
// indentation, blockquote markers, then a list marker (with optional task
// checkbox) or an ATX heading marker.
const LIST_MARKER = String.raw`(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?`
const PREFIX_RE = new RegExp(String.raw`^([ \t]*(?:>[ \t]?)*[ \t]*(?:${LIST_MARKER}|#{1,6}[ \t]+)?)`)
const LIST_ITEM_RE = new RegExp(String.raw`^[ \t]*(?:>[ \t]?)*[ \t]*${LIST_MARKER}`)
// Link syntax removed before counting words (never from the output text):
// `](target)` of links/images (the bracket text stays), `][ref]` labels,
// <scheme://...> autolinks and bare http(s)/www URLs.
const LINK_NOISE_RES = [
  /\]\([^)]*\)/g,
  /\]\[[^\]]*\]/g,
  /<[A-Za-z][A-Za-z0-9+.-]*:\/\/[^>\s]*>/g,
  /https?:\/\/\S+/gi,
  /www\.\S+/gi,
]
const INDENTED_CODE_RE = /^(?: {4}|\t)/
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/

// Mark one line (no newline, no trailing \r) when RTL words are at least as many as
// Latin words but it starts with a Latin letter. Markdown prefixes stay in front of the RLM.
export function wrapLineIfNeeded(line: string): string {
  if (!RTL_CHAR.test(line)) return line // no RTL content at all
  if (line.trimStart().startsWith('|')) return line // table row: left untouched
  if (INDENTED_CODE_RE.test(line) && !LIST_ITEM_RE.test(line)) return line // indented code block

  const prefix = (PREFIX_RE.exec(line) ?? [''])[0]
  const rest = line.slice(prefix.length)
  if (rest.startsWith(RLM) || rest.startsWith(LEGACY_RLI) || rest.startsWith(LEGACY_RLE)) return line // already marked

  const first = FIRST_STRONG.exec(rest)
  if (!first || RTL_CHAR.test(first[0])) return line // empty, or already RTL-leading

  const countable = LINK_NOISE_RES.reduce((t, re) => t.replace(re, ' '), rest)
  const rtl = (countable.match(RTL_WORDS_G) ?? []).length
  const latin = (countable.match(LATIN_WORDS_G) ?? []).length
  if (rtl < 1 || rtl / (rtl + latin) < MIN_RTL_WORD_SHARE) return line // Latin-dominant

  return `${prefix}${RLM}${rest}`
}

// Rewrite a whole message: skips fenced code blocks (and their fence lines)
// and keeps CRLF endings intact.
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
