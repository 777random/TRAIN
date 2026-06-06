# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TRAIN is a German-language PWA workout tracker. Pure vanilla ES modules — no framework, no build step, no bundler. Open `index.html` in a browser to run it. All UI text is in German.

## Running the app

Open `index.html` directly in Chrome or Safari. There is no dev server, no `npm install`, no build command.

When editing CSS, bump the cache-buster version in `index.html`:
```html
<link rel="stylesheet" href="./styles.css?v=26">
```
This forces the Service Worker to serve the new stylesheet instead of the cached version.

## Git workflow

Commit and push to GitHub regularly throughout all work — after every logical unit of change, not just at the end. This ensures no work is ever lost and the history stays readable.

Commit message format: `type(scope): short description`
- `feat(ui): add weight progression chart`
- `fix(state): correct undo stack for SET_TOGGLE_DONE`
- `chore: bump CSS cache-buster to v27`

Push after every commit: `git push`

## Local milestone backups

After every milestone: copy all project files (except `backups/` and `.git/`) into `backups/TRAIN_<YYYY-MM-DD>_<milestone-name>/`. The `backups/` folder is gitignored. Then commit and push to GitHub.

## Architecture

### Module responsibilities

| File | Role |
|------|------|
| `state.js` | Single source of truth. All writes go through `dispatch()`. Subscribers are notified synchronously after every mutation. Persists to localStorage. |
| `ui.js` | All DOM rendering. Bootstrapped once by `mountApp(root)`. Re-renders targeted regions on every state change via `subscribe()`. |
| `timer.js` | Session clock + pause timer. Fully decoupled from `ui.js` via custom `window` events to avoid circular imports. |
| `backup.js` | JSON import/export and CSV export. |
| `registerSW.js` | Service Worker registration, storage-error event, SW-update event. |
| `dragdrop.js` | Minified third-party mobile drag-and-drop polyfill (do not edit). |
| `icons.js` | SVG icon strings, exported as named constants. |

### State layer (`state.js`)

Flux-like pattern: `dispatch(A.ACTION_TYPE, payload)` → `reduce()` → `persistState()` → `_notify()` → all subscribers called synchronously.

**Persistence is defence-in-depth:**
- Primary: `localStorage['train_v6']` — written on every mutation.
- Shadow: `localStorage['train_v6_shadow']` — debounced 500 ms after primary (crash safety).

**Undo:** 20-entry stack of deep-cloned snapshots. Navigation actions (`WEEK_NAVIGATE`, `SESSION_START`, etc.) are excluded from undo.

**Schema migration:** `migrate()` in `state.js` runs on every `loadState()`. Add a new `case` block when bumping `SCHEMA_VERSION`. Current version: `8`.

**State shape summary:**
```
{
  meta:           { schemaVersion, savedAt, createdAt }
  curIdx:         number           // index into weeks[]
  weeks:          Week[]
  customTemplate: DayTemplate[]    // user's reusable template
  settings:       { swipe, drag, heightCm, targetWeight }
}

Week   → { id, startDate, note, mode, days[], sessionLog[], bodyData }
Day    → { id, title, subtitle, warmup, cooldown, locked, markedDone, exercises[] }
Exercise → { name, note, pauseSec, metric, sets[], weightStep, nextWeekPlan, targetSets, targetReps }
Set    → { weight, reps, rpe, status ('pending'|'success'|'fail'), done }
```

`FACTORY_TEMPLATE` (frozen) defines the default 3-day program. `customTemplate` is the user's editable copy.

### UI layer (`ui.js`)

- `mountApp(root)` builds the static shell once (toolbar, tabs, modals, toast, storage warning).
- `subscribe()` calls `render(state)` on every dispatch. `render()` diffs by comparing the previous state snapshot — it only re-renders the region that actually changed (week header, day list, active day content, settings panel, etc.).
- All user interactions are handled via **event delegation**: one `click` listener and one `input` listener on `#app`, routing by `data-action` attributes. Never attach individual element listeners for set/exercise/day interactions.
- Transient UI state (open day index, active tab, drag source) lives in module-level variables in `ui.js`, never in `state.js`.

### Timer decoupling

`timer.js` imports only `state.js`. It communicates with `ui.js` exclusively through custom `window` events:
- `ui.js` → `timer.js`: `train:set-done`, `train:set-input`, `train:warmup-click`, `train:day-complete`
- `timer.js` → `ui.js`: `train:toast`, `train:show-update-banner`

Do not import `ui.js` from `timer.js` or vice versa.

### Adding a new action

1. Add the constant to the `A` object in `state.js`.
2. Add a `case` in the `reduce()` switch.
3. Call `dispatch(A.YOUR_ACTION, payload)` from `ui.js`.
4. If the action should not be undoable, add it to `_NO_UNDO`.
