import { test, expect } from 'claude-code/testing'

import { PDI, RLI, toRtl, wrapLineIfNeeded } from './rtl'

const HEBREW_LEADING = '## \u05DB\u05D5\u05EA\u05E8\u05EA' // "## <Hebrew word>"
const MIXED = 'Mixed \u05E2\u05D1\u05E8\u05D9\u05EA \u05DE\u05D0\u05D5\u05D3 \u05E9\u05DC\u05D5\u05DD text' // 3 Hebrew words vs 2 English
const PURE_ENGLISH = '* `code span`'
const HEBREW_LEADING_MULTI_ENGLISH =
  '\u05D9\u05E9 \u05DC\u05D4\u05E8\u05D9\u05E5 npm install \u05D5\u05D0\u05D6 \u05DC\u05D1\u05D3\u05D5\u05E7 \u05D1-GitHub Actions'
const ENGLISH_WITH_ONE_HEBREW = 'Use the flag --force, also known as \u05DB\u05E4\u05D9\u05D9\u05D4'
const PUNCTUATION_ONLY = '--- 12:34 --- 99%'
const ARABIC = 'Note: \u0645\u0631\u062D\u0628\u0627 \u0628\u0627\u0644\u0639\u0627\u0644\u0645 \u0647\u0630\u0627 \u0646\u0635'
const MIXED_MULTILINE = [HEBREW_LEADING, MIXED, PURE_ENGLISH].join('\n')
const LABEL_OFF = '\u05E2\u05D1\u05E8\u05D9\u05EA: \u05DB\u05D1\u05D5\u05D9'
const LABEL_ON = '\u05E2\u05D1\u05E8\u05D9\u05EA: \u05E4\u05E2\u05D9\u05DC'

// --- pure functions -------------------------------------------------------

test('wrapLineIfNeeded: Hebrew-dominant English-leading line is wrapped in isolates', () => {
  expect(wrapLineIfNeeded(MIXED)).toBe(`${RLI}${MIXED}${PDI}`)
})

test('wrapLineIfNeeded: English-dominant line with one Hebrew word is untouched', () => {
  expect(wrapLineIfNeeded(ENGLISH_WITH_ONE_HEBREW)).toBe(ENGLISH_WITH_ONE_HEBREW)
})

test('wrapLineIfNeeded: Hebrew-leading, pure English and punctuation lines are untouched', () => {
  for (const s of [HEBREW_LEADING, HEBREW_LEADING_MULTI_ENGLISH, PURE_ENGLISH, PUNCTUATION_ONLY, '', '   ']) {
    expect(wrapLineIfNeeded(s)).toBe(s)
  }
})

test('wrapLineIfNeeded: Arabic line is wrapped', () => {
  expect(wrapLineIfNeeded(ARABIC)).toBe(`${RLI}${ARABIC}${PDI}`)
})

test('wrapLineIfNeeded: Arabic presentation forms count as RTL', () => {
  const s = 'Note: \uFE8D\uFE8E\uFE8D\uFE8E\uFE8D\uFE8E'
  expect(wrapLineIfNeeded(s)).toBe(`${RLI}${s}${PDI}`)
})

test('wrapLineIfNeeded: already-wrapped line (RLI or legacy RLE) is not wrapped twice', () => {
  const once = wrapLineIfNeeded(MIXED)
  expect(wrapLineIfNeeded(once)).toBe(once)
  const legacy = `\u202B${MIXED}\u202C`
  expect(wrapLineIfNeeded(legacy)).toBe(legacy)
  expect(wrapLineIfNeeded(`- ${once}`)).toBe(`- ${once}`)
})

test('wrapLineIfNeeded: markdown prefixes stay at column 0', () => {
  for (const prefix of ['- ', '* ', '+ ', '1. ', '12) ', '# ', '### ', '> ', '> > ', '  - ', '- [x] ', '1. ']) {
    expect(wrapLineIfNeeded(prefix + MIXED)).toBe(`${prefix}${RLI}${MIXED}${PDI}`)
  }
})

test('wrapLineIfNeeded: table rows and indented code are left untouched', () => {
  for (const s of [`| ${MIXED} | b |`, `  | ${MIXED} |`, `    ${MIXED}`, `\t${MIXED}`]) {
    expect(wrapLineIfNeeded(s)).toBe(s)
  }
})

test('wrapLineIfNeeded: nested (4-space) list item is still wrapped after its prefix', () => {
  expect(wrapLineIfNeeded(`    - ${MIXED}`)).toBe(`    - ${RLI}${MIXED}${PDI}`)
})

test('toRtl: fenced code blocks and fence lines are untouched', () => {
  for (const f of ['```', '~~~', '````']) {
    const text = [MIXED, `${f}ts`, MIXED, f, MIXED].join('\n')
    const lines = toRtl(text).split('\n')
    expect(lines[0]).toBe(`${RLI}${MIXED}${PDI}`)
    expect(lines.slice(1, 4)).toEqual([`${f}ts`, MIXED, f])
    expect(lines[4]).toBe(`${RLI}${MIXED}${PDI}`)
  }
})

test('toRtl: a shorter or different fence does not close a block', () => {
  const text = ['````', '```', MIXED, '~~~~', MIXED, '````', MIXED].join('\n')
  const lines = toRtl(text).split('\n')
  expect(lines.slice(0, 6)).toEqual(['````', '```', MIXED, '~~~~', MIXED, '````'])
  expect(lines[6]).toBe(`${RLI}${MIXED}${PDI}`)
})

test('toRtl: CRLF puts the isolate end before the carriage return', () => {
  expect(toRtl(`${MIXED}\r\nplain\r\n`)).toBe(`${RLI}${MIXED}${PDI}\r\nplain\r\n`)
})

// --- through the engine ---------------------------------------------------

for (const surface of ['terminal', 'desktop'] as const) {
  // Hooks beneath the plugin: the test stands in for the engine's own drawing. Call before using `$`.
  function setup(on: any) {
    for (const c of ['UserMessage', 'AssistantMessage'] as const) {
      on('ui.render', { component: c }, async ($: any, e: any) => $.ui.resolve(e).Text({ children: e.props.text }))
    }
    on('ui.render', { component: 'AbovePrompt' }, async ($: any, e: any) =>
      $.ui.resolve(e).Text({ children: 'engine band' }),
    )
  }

  // Press the band's toggle button once.
  async function enable($: any) {
    const band = await $.ui.mount({ plugin: 'rtl-toggle', surface, component: 'AbovePrompt', props: {} })
    await band.press({ key: 'rtl-toggle' })
    await band.unmount()
  }

  // Mount `component` with `text` and return the drawn text.
  async function render($: any, component: 'UserMessage' | 'AssistantMessage', text: string) {
    const mounted = await $.ui.mount({
      plugin: 'rtl-toggle',
      surface,
      component,
      props: { text, origin: { kind: 'prompt' }, isExpanded: true },
    })
    return (await mounted.find({ type: 'Text' }))?.text
  }

  // Enabled toggle, then render.
  async function renderEnabled(on: any, $: any, component: 'UserMessage' | 'AssistantMessage', text: string) {
    setup(on)
    await enable($)
    return render($, component, text)
  }

  test(`UserMessage: Hebrew-dominant English-leading line gets wrapped (${surface})`, async ($, on) => {
    expect(await renderEnabled(on, $, 'UserMessage', MIXED)).toBe(`${RLI}${MIXED}${PDI}`)
  })

  test(`AssistantMessage wraps when enabled (${surface})`, async ($, on) => {
    expect(await renderEnabled(on, $, 'AssistantMessage', MIXED)).toBe(`${RLI}${MIXED}${PDI}`)
  })

  test(`Mixed multi-line message only wraps the lines that need it (${surface})`, async ($, on) => {
    const lines = (await renderEnabled(on, $, 'UserMessage', MIXED_MULTILINE))?.split('\n')
    expect(lines).toEqual([HEBREW_LEADING, `${RLI}${MIXED}${PDI}`, PURE_ENGLISH])
  })

  test(`List item, heading and blockquote prefixes stay at column 0 (${surface})`, async ($, on) => {
    const text = [`- ${MIXED}`, `# ${MIXED}`, `> ${MIXED}`].join('\n')
    const lines = (await renderEnabled(on, $, 'AssistantMessage', text))?.split('\n')
    expect(lines).toEqual([`- ${RLI}${MIXED}${PDI}`, `# ${RLI}${MIXED}${PDI}`, `> ${RLI}${MIXED}${PDI}`])
  })

  test(`Fenced code block content is untouched (${surface})`, async ($, on) => {
    const text = ['```', MIXED, '```'].join('\n')
    expect(await renderEnabled(on, $, 'AssistantMessage', text)).toBe(text)
  })

  test(`English-dominant sentence with one Hebrew word is untouched (${surface})`, async ($, on) => {
    expect(await renderEnabled(on, $, 'AssistantMessage', ENGLISH_WITH_ONE_HEBREW)).toBe(ENGLISH_WITH_ONE_HEBREW)
  })

  test(`Arabic line is wrapped (${surface})`, async ($, on) => {
    expect(await renderEnabled(on, $, 'AssistantMessage', ARABIC)).toBe(`${RLI}${ARABIC}${PDI}`)
  })

  test(`Already-wrapped line is not double-wrapped (${surface})`, async ($, on) => {
    const wrapped = `${RLI}${MIXED}${PDI}`
    expect(await renderEnabled(on, $, 'AssistantMessage', wrapped)).toBe(wrapped)
  })

  test(`CRLF line keeps the carriage return outside the isolate (${surface})`, async ($, on) => {
    expect(await renderEnabled(on, $, 'AssistantMessage', `${MIXED}\r\nx`)).toBe(`${RLI}${MIXED}${PDI}\r\nx`)
  })

  test(`Table row is left untouched (${surface})`, async ($, on) => {
    const row = `| ${MIXED} | x |`
    expect(await renderEnabled(on, $, 'AssistantMessage', row)).toBe(row)
  })

  test(`Hebrew-leading, pure-English, punctuation, empty and blank lines are untouched (${surface})`, async ($, on) => {
    setup(on)
    await enable($)
    for (const s of [HEBREW_LEADING, HEBREW_LEADING_MULTI_ENGLISH, PURE_ENGLISH, PUNCTUATION_ONLY, '', '   ']) {
      expect(await render($, 'UserMessage', s)).toBe(s)
    }
  })

  test(`Text is unchanged while disabled (${surface})`, async ($, on) => {
    setup(on)
    for (const component of ['UserMessage', 'AssistantMessage'] as const) {
      expect(await render($, component, MIXED_MULTILINE)).toBe(MIXED_MULTILINE)
    }
  })

  test(`AbovePrompt composes with the band beneath and its label reflects state (${surface})`, async ($, on) => {
    setup(on)
    const band = await $.ui.mount({ plugin: 'rtl-toggle', surface, component: 'AbovePrompt', props: {} })
    expect((await band.find({ type: 'Text' }))?.text).toBe('engine band')
    expect((await band.find({ key: 'rtl-toggle' }))?.text).toBe(LABEL_OFF)
    await band.press({ key: 'rtl-toggle' })
    expect((await band.find({ key: 'rtl-toggle' }))?.text).toBe(LABEL_ON)
    await band.unmount()
  })
}
