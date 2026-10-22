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

The mod adds a button above the prompt. Its label shows the current state
(`עברית: פעיל` on, `עברית: כבוי` off); pressing it toggles a session-scoped setting. The
button is drawn alongside whatever else the band shows (surveys, other mods).

While the toggle is on, every line of every `UserMessage` and
`AssistantMessage` is inspected individually. A line gets a single leading
**RLM** (RIGHT-TO-LEFT MARK, U+200F, a zero-width strong RTL character) only
when all of these hold:

- it starts (after any markdown prefix) with an LTR letter;
- RTL words are at least as many as LTR words. A word is a maximal run of
  RTL letters or of LTR letters, so `ב-GitHub` is one RTL plus one LTR word.
  RTL letters are every block Unicode assigns to right-to-left scripts
  (Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic, Adlam, ... and
  their presentation forms); any other letter is LTR, so Russian, Greek or
  accented Latin count exactly like English. The share must be >=
  `MIN_RTL_WORD_SHARE` (0.5): a tie goes to RTL, and an English or Russian
  sentence with one Hebrew word is left alone. Inline code spans (`` `x` ``),
  link targets `](...)`, reference labels `][ref]`, `<scheme://...>`
  autolinks and bare `http(s)://` / `www.` URLs are ignored when counting
  (the text itself is never changed).

Everything else is untouched:

- Hebrew/Arabic-leading lines (the bidi algorithm already handles them) and
  lines with no RTL text.
- Lines inside fenced code blocks (``` or ~~~), including fences inside
  blockquotes and list items, and the fence lines themselves.
- Indented (4 spaces / tab) code lines and table rows (`|`); table rows are
  skipped entirely rather than wrapped per cell.
- Lines already marked (RLM, or the legacy RLI/RLE from older versions).

The markdown prefix (indentation, `>` quotes, `-`/`*`/`+`/`1.` list markers,
task checkboxes, `#` headings) stays at column 0; the RLM is inserted after it.
Nothing is appended, so CRLF endings are unaffected.

Why an RLM and not an isolate (RLI ... PDI): renderers that auto-detect block
direction (`dir=auto`, Unicode Bidi Algorithm rule P2) pick the direction from
the first strong character, and P2 skips everything inside an isolate. An
isolate-wrapped line therefore had correct internal order but stayed
left-aligned. A leading RLM is itself the first strong character, so the block
gets an RTL base direction and right alignment, exactly like a line that starts
with Hebrew.

While the toggle is off, no message text is modified.

## Usage

1. Open Claude Code with this mod enabled.
2. Click the button above the prompt, or run `/rtl`, to turn the correction
   on or off. The command works on every surface, including VS Code and
   mobile, which may not show the button:
   - `/rtl` toggles
   - `/rtl on` / `/rtl off` set the state
   - `/rtl status` reports it
3. Messages are re-rendered according to the rules above for as long as the
   toggle stays on, for the duration of the session.

## Performance

Messages are redrawn far more often than they change (every streamed chunk
redraws the growing answer). The mod therefore:

- returns text with no RTL character untouched after a single scan;
- caches finished results (LRU, bounded to ~4M characters in total);
- reuses the already-converted complete lines when the next text extends the
  previous one, so a streaming answer only converts its newest line(s);
- uses only patterns that stay linear on adversarial input (long whitespace
  runs, thousands of `](` or `<a://` on one line).

On a 1MB message a redraw dropped from ~35ms to well under 1ms.

### Before / after

| Toggle off | Toggle on |
|---|---|
| ![Toggle off: embedded Hebrew renders out of order](./assets/toggle-off.png) | ![Toggle on: embedded Hebrew renders in correct order](./assets/toggle-on.png) |

## Known limitation

The mod API exposes no `dir`, `direction` or `textAlign` prop (`BoxProps`,
`TextProps`, `MarkdownProps`), so block alignment is controlled indirectly via
the leading RLM. On surfaces that auto-detect direction per block (the desktop
app) this works: paragraphs, headings, list items and blockquotes whose first
strong character is the RLM are right-aligned with RTL base direction. In the
terminal the result depends on the terminal's own bidi support: many
terminals do not implement the bidi algorithm at all, and the RLM is
invisible there but cannot change alignment.

Toggling only affects messages rendered after the press: messages already on
screen keep the layout they were drawn with until they are rendered again.

Word counting treats any run of letters as one word, so `don't` counts as
two words, `v2` as one (the digit is ignored), and a run of CJK characters
without spaces as a single word. The first two are pinned by a
"known limitation" test.

## Testing

The text rules are pure functions in `hooks/rtl.ts`, tested directly and through
the engine in `hooks/rtl-toggle.test.ts` (both `terminal` and `desktop` surfaces). Run them with:

```
claude plugin test <path-to-this-folder>
```

## Install

```
/plugin install rtl-toggle --marketplace Amitro123/RTL-claude-mod
```

## License

[MIT](./LICENSE). PRs welcome.
