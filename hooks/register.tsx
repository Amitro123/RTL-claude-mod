import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// Session-scoped toggle state (NOT a module-level variable, which would be
// lost on hot reload). Declared in ../types/index.d.ts under 'rtl-toggle'.
const rtlEnabled = atom({ plugin: 'rtl-toggle', key: 'enabled' } as const, false)

// Unicode bidi control characters used to force proper RTL shaping of mixed
// Hebrew/English text. The live claude-code.d.ts (BoxProps/TextProps/
// MarkdownProps, grepped for `direction`/`textAlign`/`dir`) exposes no
// layout-level direction prop on Box, Text, or Markdown — only flexDirection
// (child layout order, not text shaping) and text color/weight/wrap props.
// So this falls back to wrapping affected lines in RLE (U+202B) / PDF
// (U+202C): the Unicode Bidi Algorithm then lays the Hebrew out right-to-left
// while embedded English runs stay LTR within it.
const RLE = '‫'
const PDF = '‬'

// Hebrew + Arabic letter ranges: presence of any of these is what makes a
// line "RTL content" at all.
const RTL_CHAR = /[֐-׿؀-ۿ]/
// First *strong* directional character in a line: a Hebrew/Arabic or Latin
// letter. Punctuation, digits, whitespace, and markdown markup (`*`, `-`,
// `` ` ``, `#`, list markers, etc.) are skipped automatically because they
// simply don't match this class.
const STRONG_DIRECTIONAL_CHAR = /[A-Za-z֐-׿؀-ۿ]/

// Per-line: wrap only a line that (a) contains at least one Hebrew/Arabic
// character, AND (b) whose first strong-directional character is NOT
// Hebrew/Arabic (i.e. an English-leading line with embedded RTL text later —
// the one case the Unicode Bidi Algorithm does not already handle on its
// own). A line with zero RTL characters is left completely untouched, even
// when the toggle is on. A Hebrew-leading line is also left untouched: the
// bidi algorithm already renders it correctly, and wrapping it would be
// redundant markup.
function wrapLineIfNeeded(line: string): string {
  if (line.startsWith(RLE)) return line // already wrapped, avoid double-wrap
  if (!RTL_CHAR.test(line)) return line // no RTL content at all - no-op
  const first = line.match(STRONG_DIRECTIONAL_CHAR)
  if (!first || RTL_CHAR.test(first[0])) return line // already RTL-leading
  return `${RLE}${line}${PDF}`
}

function toRtl(text: string): string {
  return text.split('\n').map(wrapLineIfNeeded).join('\n')
}

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const enabled = await read($, rtlEnabled)
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box justifyContent="flex-end">
        <Text bold>{enabled ? 'עברית: פעיל' : 'עברית: כבוי'} </Text>
        <Button
          key="rtl-toggle"
          label="עברית"
          variant="primary"
          onPress={() => update($, rtlEnabled, v => !v)}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const enabled = await read($, rtlEnabled)
    if (!enabled) return next(e)

    return next({ ...e, props: { ...e.props, text: toRtl(e.props.text) } })
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const enabled = await read($, rtlEnabled)
    if (!enabled) return next(e)

    return next({ ...e, props: { ...e.props, text: toRtl(e.props.text) } })
  })
}
