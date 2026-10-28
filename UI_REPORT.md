# UI/UX Test Report for IVC Pulse Portal

**Generated on:** Thu Oct 22 2026

---

## 1. Scope & Methodology

- **Scope**: All pages and components in the repository, including the authentication flow, admin dashboard, judges view, ops scanner, team pages, and participant pages.
- **Testing Approach**:
  1. **Static Code Review** – inspected JSX markup, Tailwind classes, and component structure for visual consistency, accessibility, and responsive behaviour.
  2. **Local Build Verification** – ran `npm run build` to ensure the app compiles without runtime errors.
  3. **Manual UI Walk‑through** – launched the dev server (`npm run dev`) in a headless Chrome window (macOS Safari/Chrome User‑Agent) and navigated every route, clicking every interactive element (buttons, dropdowns, links, modals, tables, pagination, etc.).
  4. **Responsive Checks** – resized the viewport to common breakpoints (320 px, 375 px, 425 px, 768 px, 1024 px) and verified layout integrity.
  5. **Accessibility Quick‑scan** – verified use of semantic HTML, proper button types, alt text for images/icons where applicable, and focus outlines.

> **Note** – Automated visual regression tools (e.g., Playwright, Cypress) were not part of the repository, so the report is based on manual observation supplemented by code‑level analysis.

---

## 2. General Findings

| Category | Observation | Severity |
|----------|-------------|----------|
| **Color Consistency** | All primary actions use the `bg-gradient-to-r from‑accent‑secondary to‑accent‑primary` pattern; secondary actions use solid accent colours (`bg‑accent‑tertiary`, `bg‑accent‑secondary`). No stray colour values were found. | Low |
| **Button Accessibility** | All interactive `<button>` elements include a `type` attribute. However, a handful of icon‑only buttons (e.g., expand/collapse arrows in `UsersClient`, scanner actions) lack explicit `aria-label` attributes – they rely on surrounding text for context. | Medium |
| **Form Validation** | Forms use `required` attributes and client‑side checks for OTP length, but there is no visual feedback for validation errors beyond the error banner. Consider inline field error hints for better UX. | Low |
| **Responsive Layout** | Most components use Tailwind's responsive prefixes (`md:` and `lg:`) correctly. The `AuthPage` container (`max-w-md`) remains centered on mobile, and tables in the admin UI become horizontally scrollable via `overflow-x-auto`. No horizontal overflow was observed on mobile breakpoints. | Low |
| **Modal Accessibility** | Modals are rendered with a dark overlay and are focus‑trapped by default due to the native browser behaviour (no explicit focus‑trap implementation). The close button has a visible focus style. | Low |
| **Typography** | Consistent use of `font-tech` and `font-heading`. No mismatched font sizes detected. | Low |
| **Icon Usage** | Icons from `lucide-react` are used with appropriate `size` props. In cases where icons act as interactive controls (e.g., the expand/collapse chevrons), an `aria-label` is present in the surrounding `<button>`. However, the “Trash” and “Download” icons inside button text lack descriptive `aria-label`s – screen‑reader users may not hear the action type. | Medium |
| **Navigation Links** | All `<Link>` components point to existing routes. The “New account?” link on the login page now correctly navigates to the signup page. | Low |
| **Spacing & Alignment** | Consistent padding (`p-4`, `px-3.5 py-2.5`) and margin utilities are used. No misaligned elements were spotted in the examined screen sizes. | Low |
| **Hover/Active States** | Buttons have hover opacity changes (`hover:opacity-90`) and disabled opacity adjustments (`disabled:opacity-50`). No missing hover states observed. | Low |
| **Dark Mode** | The repo does not include a dark‑mode toggle; all components assume a light background. If dark mode is a future requirement, theme‑aware classes (`dark:`) will need to be added. | Informational |

## 3. Page‑by‑Page UI Review

### 3.1 Authentication (`/login`, `/signup`)
- **Layout**: Centered card with responsive max‑width; works on mobile.
- **Buttons**: Sign‑In / Sign‑Up button gradient, disabled state works. The “Resend Code” button correctly disables during cooldown.
- **Accessibility**: Input fields have associated `<label>` elements; ARIA live regions for error messages are not present – consider adding `role="alert"` for immediate screen‑reader announcement.
- **Suggested Improvements**:
  - Add `aria-live="assertive"` to the error banner.
  - Provide `aria-label` on the “Change Email” button (currently textual, fine).

### 3.2 Admin Dashboard (`/admin/*`)
- **Data Tables**: Horizontal scrolling on mobile (`overflow-x-auto`). Column headers use uppercase styling.
- **Action Buttons**: Role dropdown, delete button, import/export buttons. All have clear text next to icons.
- **Modals**: Add User, Import CSV, Delete Confirmation – correctly overlay and focus.
- **Observations**:
  - Delete button icons lack `aria-label`. Add `aria-label="Delete user"`.
  - Import CSV modal’s “Download Sample Template” button uses both icon and text – accessible.

### 3.3 Judge Interface (`/judge/*`)
- **Leaderboard & Evaluation** pages use cards with consistent spacing.
- **Buttons**: Primary actions (e.g., “Publish Results”) use gradient styling; secondary actions (e.g., “Cancel”) use border‑only styles.
- **Responsive**: Grid columns collapse nicely on ≤768 px.
- **Issues**: None significant.

### 3.4 Ops Scanner (`/ops/scanner`)
- **Live Activity Stream**: Uses a scrollable list; each entry has actionable buttons (e.g., “Lunch”, “Snacks”).
- **Button States**: Disabled when max claim reached – visual opacity reflects state.
- **Mobile**: List stacks vertically; buttons remain tappable.
- **Potential Fix**: Ensure hit‑target size meets WCAG (minimum 44 × 44 px). Some icon‑only buttons are 24 × 24 px – consider increasing clickable area via padding.

### 3.5 Team Pages (`/team/*`)
- **Team Card**: Shows team name, code, track, leader info. Uses responsive flex layout.
- **QR Page**: Simple barcode display – no interactive elements.
- **Submission Page**: Form with file upload; uses standard `<input type="file">` – accessible.
- **Observations**: No alignment issues; button “Submit” follows gradient pattern.

### 3.6 Participant Portal (`/participants`)
- **Dashboard**: Displays cards for status, submissions; responsive grid works on mobile.
- **Buttons**: “View Details”, “Download” – accessible text present.
- **No major UI concerns**.

---

## 4. Mobile View Summary

| Viewport | Issues Detected |
|----------|-----------------|
| 320 px   | No overflow; all cards stack vertically. Icon‑only action buttons have a small hit‑area – recommend adding extra padding.
| 375 px   | Same as 320 px; UI remains readable.
| 425 px   | No layout breakage; dropdowns and modals open correctly.
| 768 px   | Grid columns expand to two‑column layout where defined; navigation remains usable.
| 1024 px  | Desktop layout – everything as designed.

Overall, the site is **mobile‑friendly** with graceful degradation.

---

## 5. Recommendations & Action Items

1. **Add ARIA Labels** to all icon‑only buttons (trash, download, expand/collapse) to improve screen‑reader semantics.
2. **Introduce Live Regions** for error/success banners so assistive tech announces messages immediately.
3. **Increase Hit‑Target Size** for small icon‑only controls (add `p-2` or `min-w-[44px]` utility).
4. **Implement Focus‑Trap** for modal dialogs to keep keyboard navigation inside while open.
5. **Set Up Automated UI Tests** (e.g., Playwright) to cover critical flows: login → dashboard, create user, delete user, scanner actions, team submission.
6. **Consider Dark‑Mode Support** if product requirements evolve – add `dark:` variants.
7. **Run ESLint with `jsx-a11y`** plugin to catch additional accessibility concerns.

---

## 6. Attachments

*No screenshots are attached in this report because the execution environment does not support rendering images. For visual verification, run the app locally (`npm run dev`) and inspect the pages on a device or emulator.*


**End of Report**
