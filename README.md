# RTL Toggle

A Claude Code mod that corrects the reading order of chat messages which mix
English and Hebrew (or other right-to-left) text.

## Problem

Standard Unicode bidi handling renders a line correctly when the line's first
strong-directional character already matches its intended direction. It does
not always do so for a Latin-leading line with Hebrew embedded further in:
the Hebrew segment can end up visually shifted or reordered relative to the
surrounding English text. For example, a line such as:

```
Mixed עברית text
```

may render with the Hebrew word out of position relative to the English
words around it, even though the underlying text is correct. This mod
detects that specific case and corrects the rendering.

## How it works

The mod adds a button labeled **עברית** above the prompt. Pressing it toggles
a session-scoped setting that controls whether message text is rewritten
before display.

While the toggle is on, every line of every `UserMessage` and
`AssistantMessage` is inspected individually:

- A line that contains a Hebrew/Arabic character, and whose first
  strong-directional character is **not** itself Hebrew/Arabic (i.e. an
  English-leading line with embedded RTL text), is wrapped in Unicode bidi
  control characters (RLE … PDF) so the embedded segment renders in correct
  order.
- A line that already starts with Hebrew/Arabic text is left untouched — the
  bidi algorithm already renders it correctly, and rewriting it would be
  redundant.
- A line with no RTL characters at all (pure English or code) is left
  untouched.

While the toggle is off, no message text is modified.

## Usage

1. Open Claude Code with this mod enabled.
2. Click the **עברית** button above the prompt to turn the correction on or
   off. The button's label reflects the current state (`עברית: פעיל` /
   `עברית: כבוי`).
3. Messages are re-rendered according to the rules above for as long as the
   toggle stays on, for the duration of the session.

### Before / after

| Toggle off | Toggle on |
|---|---|
| ![Toggle off: embedded Hebrew renders out of order](./assets/toggle-off.png) | ![Toggle on: embedded Hebrew renders in correct order](./assets/toggle-on.png) |

## Known limitation

This mod can only change the *character-level* reading order of text within
a line, using Unicode bidi control characters. It cannot change which side a
markdown bullet marker or other block-level element is aligned to. A
list item or block that would normally render with its marker on the English
(left) side stays on that side even when the toggle is on and the line's
content is otherwise corrected. This is a limitation of the mod API itself:
`BoxProps`, `TextProps`, and `MarkdownProps` expose no `dir`, `direction`, or
`textAlign` prop — confirmed against the current `claude-code.d.ts` — so
there is no supported way for this mod to control block-level alignment.

## Testing

Unit tests live in `hooks/rtl-toggle.test.ts` and cover both the `terminal`
and `desktop` surfaces. Run them with:

```
claude plugin test <path-to-this-folder>
```

## Install

```
/plugin install rtl-toggle --marketplace Amitro123/RTL-claude-mod
```
