# Polish pass: four visible defects

The app works end to end (the copilot's own test passes 82/82), so keep everything that makes it work: the copilot
contract, the exact form markup, every `data-testid`, `scripts/check-copilot-contract.mjs` and the `build` script that
runs it. This change is visual only. Fix these four defects, seen at 375px and 1280px wide:

1. **Clinic header and footer are unreadable.** On every `/clinic` page the brand name, navigation links, search
   placeholder, Guest/Leave and the footer text are near-white on a white or very light background. Give the clinic its
   intended look (soft teal and warm white) with dark, readable text: at least 4.5:1 contrast for body text and links.
   Check the other four sites' headers and footers for the same problem.

2. **Pages scroll sideways on a phone.** The header search box (`.site-search-input`) has a fixed width (200px on the
   pension site, wider elsewhere), so at 375px the clinic, appliance, pricing and pension pages are 377–548px wide.
   On narrow screens, collapse search to an icon button that opens a full-width search row (or put it in the menu),
   so no page is ever wider than the screen from 360px up. The header must fit: logo, menu and search.

3. **Empty fields show red error borders before anyone types.** The rule
   `.copilot-form input:invalid:not(:placeholder-shown)` matches every empty required input without a placeholder (for
   example "Child's full name", "Your name", "Member number"), so they load red. Show the error style only after the
   visitor has interacted or tried to continue: use `:user-invalid` (with a class set on a failed Next/submit as
   fallback). Keep the browser's own validation.

4. **The form doesn't line up with its heading.** On desktop the page heading, intro and step indicator sit in one
   column and the form fields in a narrower column offset to the right. Put the heading, intro, notices, step indicator
   and the form in one aligned column (about 640px max), left-aligned together. Also, card grids with three cards leave
   an empty fourth column at 1280px: size them to their content (three across, centred, or full width).

Done means: `npm run build` (including the contract check) passes, no page scrolls sideways at 360px or 375px, the
clinic header and footer are clearly readable, no field is red on page load, and each form page reads as one aligned
column on desktop.
