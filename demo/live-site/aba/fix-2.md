# Fix: the call panel's controls fall off short phone screens

Keep everything else exactly as it is: the copilot contract, form markup, every `data-testid`, the contract check, and
the look. Only the call panel's phone layout changes.

On an iPhone 13/14 (390 × 664 CSS px visible), with the panel open in text mode, the bottom sheet is capped at about
60% of the height (398px) and starts at y=266, but its contents don't fit: the header, the promise line, the status
and the three capability chips take most of it, and the controls are pushed below the screen. Measured: mic row at
y=620–668, text box and Send at y=681–727, with the screen ending at 664. So a visitor can't type, and the Send button
can't be reached.

Make the sheet a column whose parts always fit inside it, at any phone height from 560px up:

- The header (name, promise, status, minimise/close) and the controls (mic, keyboard, End, and the text box with Send
  when typing) never shrink and are always fully on screen, with the safe-area inset at the bottom.
- The conversation is the only part that scrolls (`flex: 1; min-height: 0; overflow-y: auto`), and it stays scrolled
  to the newest message.
- On short screens (height under about 740px), make the header compact: the promise on one line, and the capability
  chips in a single row that scrolls sideways (or are hidden while the visitor is typing).
- Use `dvh`-based heights (with a `vh` fallback) so the sheet still fits when iOS's toolbar shows. When the on-screen
  keyboard opens, the text box must stay visible above it: use `visualViewport` to lift the sheet if needed.

Done means: at 390 × 664 and 375 × 560, with the panel open in text mode, `call-input`, `call-send`, `call-mic`,
`call-keyboard` and `call-end` are all fully inside the viewport and tappable, the newest message is visible, and
`npm run build` (including the contract check) passes.
