import { test, expect } from 'claude-code/testing'

const RLE = '‫'
const PDF = '‬'

// Hebrew-leading line: bidi algorithm already handles it, must stay unwrapped.
const HEBREW_LEADING = '## כותרת'
// English-leading line with embedded Hebrew later: the one case that needs wrapping.
const ENGLISH_LEADING_WITH_HEBREW = 'Mixed עברית text'
// Pure English: zero RTL characters, must never be wrapped.
const PURE_ENGLISH = '* `code span`'
// Hebrew-leading line with several separate embedded English terms: the
// bidi algorithm already renders this correctly, so it must stay unwrapped.
const HEBREW_LEADING_MULTI_ENGLISH = 'יש להריץ npm install ואז לבדוק ב-GitHub Actions את ה-CI'
// Punctuation/digits only, no letters at all: must be a no-op.
const PUNCTUATION_ONLY = '--- 12:34 --- 99%'
// Empty / whitespace-only lines: must not crash and must pass through unchanged.
const EMPTY_LINE = ''
const WHITESPACE_ONLY = '   '

const MIXED_MULTILINE = [HEBREW_LEADING, ENGLISH_LEADING_WITH_HEBREW, PURE_ENGLISH].join('\n')

for (const surface of ['terminal', 'desktop'] as const) {
  test(`English-leading line with embedded Hebrew gets wrapped (${surface})`, async ($, on) => {
    on('ui.render', { component: 'UserMessage' }, async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return Text({ children: e.props.text })
    })

    const band = await $.ui.mount({ plugin: 'rtl-toggle', surface, component: 'AbovePrompt', props: {} })
    await band.press({ key: 'rtl-toggle' })
    await band.unmount()

    const mounted = await $.ui.mount({
      plugin: 'rtl-toggle',
      surface,
      component: 'UserMessage',
      props: { text: ENGLISH_LEADING_WITH_HEBREW, origin: { kind: 'prompt' }, isExpanded: true },
    })
    const text = await mounted.find({ type: 'Text' })
    expect(text?.text?.startsWith(RLE)).toBe(true)
    expect(text?.text?.endsWith(PDF)).toBe(true)
  })

  test(`Hebrew-leading line is left unwrapped while enabled (${surface})`, async ($, on) => {
    on('ui.render', { component: 'UserMessage' }, async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return Text({ children: e.props.text })
    })

    const band = await $.ui.mount({ plugin: 'rtl-toggle', surface, component: 'AbovePrompt', props: {} })
    await band.press({ key: 'rtl-toggle' })
    await band.unmount()

    const mounted = await $.ui.mount({
      plugin: 'rtl-toggle',
      surface,
      component: 'UserMessage',
      props: { text: HEBREW_LEADING, origin: { kind: 'prompt' }, isExpanded: true },
    })
    const text = await mounted.find({ type: 'Text' })
    expect(text?.text).toBe(HEBREW_LEADING)
  })

  test(`Pure-English text is never wrapped, even while enabled (${surface})`, async ($, on) => {
    on('ui.render', { component: 'UserMessage' }, async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return Text({ children: e.props.text })
    })

    const band = await $.ui.mount({ plugin: 'rtl-toggle', surface, component: 'AbovePrompt', props: {} })
    await band.press({ key: 'rtl-toggle' })
    await band.unmount()

    const mounted = await $.ui.mount({
      plugin: 'rtl-toggle',
      surface,
      component: 'UserMessage',
      props: { text: PURE_ENGLISH, origin: { kind: 'prompt' }, isExpanded: true },
    })
    const text = await mounted.find({ type: 'Text' })
    expect(text?.text).toBe(PURE_ENGLISH)
  })

  test(`Mixed multi-line message only wraps the lines that need it (${surface})`, async ($, on) => {
    on('ui.render', { component: 'UserMessage' }, async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return Text({ children: e.props.text })
    })

    const band = await $.ui.mount({ plugin: 'rtl-toggle', surface, component: 'AbovePrompt', props: {} })
    await band.press({ key: 'rtl-toggle' })
    await band.unmount()

    const mounted = await $.ui.mount({
      plugin: 'rtl-toggle',
      surface,
      component: 'UserMessage',
      props: { text: MIXED_MULTILINE, origin: { kind: 'prompt' }, isExpanded: true },
    })
    const text = await mounted.find({ type: 'Text' })
    const lines = text?.text?.split('\n') ?? []
    expect(lines[0]).toBe(HEBREW_LEADING)
    expect(lines[1]?.startsWith(RLE)).toBe(true)
    expect(lines[1]?.endsWith(PDF)).toBe(true)
    expect(lines[2]).toBe(PURE_ENGLISH)
  })

  test(`UserMessage text is unchanged while disabled (${surface})`, async ($, on) => {
    on('ui.render', { component: 'UserMessage' }, async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return Text({ children: e.props.text })
    })

    // Toggle left at its default (false/off) - no press.
    const mounted = await $.ui.mount({
      plugin: 'rtl-toggle',
      surface,
      component: 'UserMessage',
      props: { text: MIXED_MULTILINE, origin: { kind: 'prompt' }, isExpanded: true },
    })
    const text = await mounted.find({ type: 'Text' })
    expect(text?.text).toBe(MIXED_MULTILINE)
  })

  test(`Hebrew-leading line with multiple embedded English terms stays unwrapped (${surface})`, async ($, on) => {
    on('ui.render', { component: 'UserMessage' }, async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return Text({ children: e.props.text })
    })

    const band = await $.ui.mount({ plugin: 'rtl-toggle', surface, component: 'AbovePrompt', props: {} })
    await band.press({ key: 'rtl-toggle' })
    await band.unmount()

    const mounted = await $.ui.mount({
      plugin: 'rtl-toggle',
      surface,
      component: 'UserMessage',
      props: { text: HEBREW_LEADING_MULTI_ENGLISH, origin: { kind: 'prompt' }, isExpanded: true },
    })
    const text = await mounted.find({ type: 'Text' })
    expect(text?.text).toBe(HEBREW_LEADING_MULTI_ENGLISH)
  })

  test(`Empty and whitespace-only lines pass through unchanged without crashing (${surface})`, async ($, on) => {
    on('ui.render', { component: 'UserMessage' }, async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return Text({ children: e.props.text })
    })

    const band = await $.ui.mount({ plugin: 'rtl-toggle', surface, component: 'AbovePrompt', props: {} })
    await band.press({ key: 'rtl-toggle' })
    await band.unmount()

    const emptyMounted = await $.ui.mount({
      plugin: 'rtl-toggle',
      surface,
      component: 'UserMessage',
      props: { text: EMPTY_LINE, origin: { kind: 'prompt' }, isExpanded: true },
    })
    const emptyText = await emptyMounted.find({ type: 'Text' })
    expect(emptyText?.text).toBe(EMPTY_LINE)

    const whitespaceMounted = await $.ui.mount({
      plugin: 'rtl-toggle',
      surface,
      component: 'UserMessage',
      props: { text: WHITESPACE_ONLY, origin: { kind: 'prompt' }, isExpanded: true },
    })
    const whitespaceText = await whitespaceMounted.find({ type: 'Text' })
    expect(whitespaceText?.text).toBe(WHITESPACE_ONLY)
  })

  test(`Punctuation/digits-only line with no letters is a no-op (${surface})`, async ($, on) => {
    on('ui.render', { component: 'UserMessage' }, async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return Text({ children: e.props.text })
    })

    const band = await $.ui.mount({ plugin: 'rtl-toggle', surface, component: 'AbovePrompt', props: {} })
    await band.press({ key: 'rtl-toggle' })
    await band.unmount()

    const mounted = await $.ui.mount({
      plugin: 'rtl-toggle',
      surface,
      component: 'UserMessage',
      props: { text: PUNCTUATION_ONLY, origin: { kind: 'prompt' }, isExpanded: true },
    })
    const text = await mounted.find({ type: 'Text' })
    expect(text?.text).toBe(PUNCTUATION_ONLY)
  })

  test(`AssistantMessage text is unchanged while disabled, regardless of content (${surface})`, async ($, on) => {
    on('ui.render', { component: 'AssistantMessage' }, async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return Text({ children: e.props.text })
    })

    // Toggle left at its default (false/off) - no press.
    for (const sample of [MIXED_MULTILINE, ENGLISH_LEADING_WITH_HEBREW, HEBREW_LEADING_MULTI_ENGLISH, EMPTY_LINE]) {
      const mounted = await $.ui.mount({
        plugin: 'rtl-toggle',
        surface,
        component: 'AssistantMessage',
        props: { text: sample, origin: { kind: 'prompt' }, isExpanded: true },
      })
      const text = await mounted.find({ type: 'Text' })
      expect(text?.text).toBe(sample)
    }
  })
}
