import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { toRtl } from './rtl'

// Session-scoped toggle state (NOT a module-level variable, which would be
// lost on hot reload). Declared in ../types/index.d.ts under 'rtl-toggle'.
const rtlEnabled = atom({ plugin: 'rtl-toggle', key: 'enabled' } as const, false)

// The live claude-code.d.ts exposes no layout-level direction prop on Box,
// Text or Markdown, so affected lines are wrapped in bidi isolates (see rtl.ts).

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // Compose with whatever sits beneath (surveys, other mods) instead of
    // replacing it: a hook that answers without `next` suppresses them.
    const below = await next(e)
    if (e.props.hasSurvey) return below

    const enabled = await read($, rtlEnabled)
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {below}
        <Box justifyContent="flex-end">
          <Button
            key="rtl-toggle"
            label={enabled ? 'עברית: פעיל' : 'עברית: כבוי'}
            variant="primary"
            onPress={() => update($, rtlEnabled, v => !v)}
          />
        </Box>
      </Box>
    )
  })

  for (const component of ['UserMessage', 'AssistantMessage'] as const) {
    on('ui.render', { component }, async ($, e, next) => {
      if (!(await read($, rtlEnabled))) return next(e)

      return next({ ...e, props: { ...e.props, text: toRtl(e.props.text) } })
    })
  }
}
