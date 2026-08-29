# Nourish — Calorie Tracking PWA — Project Checkpoint

**If you are a new Claude Code session opening this project cold — read this whole file before
doing anything else.** It exists specifically because chat history does not follow the user
between machines (see "Cross-machine continuity" below); this file is the hand-off.

_Last updated: composite Saved Foods shipped and confirmed, plus two post-ship bug fixes (form
data getting silently wiped mid-edit, and the edit screen scrolling to a disorienting position on
long lists). All four features requested so far (PDF export, live USDA lookup, real OCR, composite
Saved Foods) are done and confirmed working on the user's real device. No feature is in progress
right now — check with the user for what's next._

## Cross-machine continuity (why this file is here, in git)

The user (Ahmed) works on this project from two PCs (work and home) and wants to move between
them seamlessly. Two things were confirmed in conversation, worth knowing before assuming anything
carries over automatically:

- **A Claude Code session — desktop app or browser (claude.ai/code) — is bound to whichever
  machine's local resources it's actually running against, not portable across devices on its
  own.** Confirmed directly in this project: this session reads/writes `G:\My Drive\Personal\...`
  (a Google-Drive-Desktop drive letter specific to one physical Windows PC), runs a local Python
  HTTP server, calls local `git`/`gh`. A genuinely cloud-hosted, device-independent session
  couldn't do any of that. So opening Claude Code (browser or desktop) on the *other* PC starts a
  brand-new conversation with zero memory of this one, regardless of delivery method.
- **The project files already sync via Google Drive** (same folder, same path, on both PCs) — but
  Drive sync is eventually-consistent and can lag or conflict if a machine is closed before it
  finishes. **Git is the more reliable channel for the actual app code** (`pwa/` folder): push
  before stopping work on one machine, pull before starting on the other, and conflicts are
  handled properly instead of silently.
- **This file was moved from the project root into `pwa/` (this repo) specifically so it travels
  with the code via the same push/pull habit**, instead of depending on Drive's sync timing for
  the one document that's supposed to make hand-offs painless.

**Starting a session on a machine that hasn't touched this repo in a while:**
1. `cd` into `pwa/`, run `git pull` to get the latest code and this file.
2. Read this file in full.
3. Verify tooling on *that* machine before assuming it matches the other one — see "Known
   environment facts" below (git/`gh` auth, Python, Node absence, etc. are per-machine, not
   synced by Drive or git).
4. If `git push` fails with an auth error, that machine's `git`/`gh` credentials need setting up
   (e.g. `gh auth login`) — this only ever happened once on the original dev machine and isn't
   guaranteed present anywhere else.

## What this project is

A personal, local-first calorie/nutrition tracking web app ("Nourish") for the user (Ahmed,
Al Ain UAE, Android phone, goal: fat loss while preserving muscle). It's modeled directly on
a pre-existing Claude.ai **Project** Ahmed used to manually generate daily PDF nutrition
reports (real macro data, saved recipes, USDA references).

Two build phases happened, in order:
1. **Design prototype** (Artifact): `nourish-prototype.html` in project root, published as a
   Claude Artifact. Exploration/validation phase only — **not the active codebase**, kept for
   reference.
2. **Real app** (current, active): `pwa/` folder — a real installable PWA, hosted live. **This
   is what to keep developing.**

## Live deployment

- **Live URL (install via "Add to Home Screen"):** `https://ahmed-waheed91.github.io/nourish-pwa/`
  — this is a **permanent** link, safe to bookmark/reuse for reinstalls or new devices. Also set
  as the repo's "Website" field (`gh repo edit --homepage`) so it shows in GitHub's own "About"
  sidebar.
- **Source repo (must stay public — GitHub Pages free tier returns HTTP 422 for private repos):**
  `https://github.com/ahmed-waheed91/nourish-pwa`. **Git root is `pwa/` itself** (this file lives
  at the repo root, i.e. `pwa/plan.md`) **— not the parent project folder.**
- To ship an update: edit files in `pwa/`, then from `pwa/`: `git add -A && git commit -m "..."
  && git push`. Live within ~1–3 minutes (can verify with `curl`).
- Data never leaves the device on its own — everything is `localStorage`-based, no backend,
  except the two features that explicitly need network (live USDA lookup, OCR's one-time asset
  download) — nothing else should ever call out.

## Key user requirements / constraints

- **Local-first, no subscriptions, no accounts.** All personal data lives only in the browser's
  `localStorage`.
- User explicitly does **not** want fabricated/sample data presented as real anywhere in the
  app — this was a recurring early bug class (all fixed; see Development History below).
- Memory/Library (saved foods, ingredients, USDA refs) contains Ahmed's **real** recipes from
  his original Claude Project — intentionally never wiped by day-reset logic.
- **User's stated working preference**: when Ahmed asks a *question*, answer only — don't
  implement — until he explicitly confirms the plan. Direct instructions ("fix X", "implement
  Y") can proceed straight to implementation. (Recorded as a `feedback` memory in the assistant's
  cross-session memory system too, not just here — but that memory is local per-machine, see
  "Cross-machine continuity" above, so this file is the durable copy.)
- User wants features built **one at a time, confirming each works before moving to the next**.
  Four features have gone through this cycle so far, all confirmed done: (1) PDF export,
  (2) Live USDA API, (3) Real OCR, (4) Composite Saved Foods. No fifth feature is queued —
  ask the user what's next rather than assuming.

## Architecture decisions and why

- **PWA, not native.** No Node.js/npm on the original dev Windows machine (checked, absent) — a
  different machine may or may not have it, don't assume either way; one URL installs on any
  device; instant updates via git push, no reinstall/app-store friction.
- **Single-file vanilla JS app** (`pwa/index.html`, ~2700+ lines). No framework/build
  step/bundler — matches the no-Node constraint, keeps iteration fast (edit → push → live).
- **Render pattern:** one `App` object holds `state`; every mutation calls `App.render()`,
  which rebuilds `#stage`'s innerHTML from scratch. No virtual DOM/diffing.
  - **Consequence for any text input field:** never wire `oninput` directly to a state-mutating
    `render()` call — the full-innerHTML rebuild steals focus/cursor position on every keystroke.
    Established pattern: uncontrolled `<input>`/`<textarea>` with an explicit **Save** button that
    reads `.value` from the DOM only on click (`weight-input`, memory-form fields,
    `daily-note-input`). Live-updating fields (e.g. ingredient scaling) instead write directly to
    one DOM node's `textContent`, bypassing `render()`.
  - **A second, easy-to-miss variant of the same trap, hit while building the meal composer**:
    even without an `oninput`-triggers-render wire-up, if a form has *multiple intermediate
    actions* that each call `render()` before the user reaches a final Save (e.g. "add a
    component," "remove a component," "open a sub-form" — all mid-flow, all before Save), any
    uncontrolled input whose value was never synced back into state gets silently wiped the
    moment one of those intermediate renders fires, because the redraw pulls from the stale state
    value. Symptom looked exactly like "the title never saves" even though the save logic itself
    was correct — the data was gone before Save ever ran. **Fix pattern**: any multi-step form
    needs a `syncXDom()` step, called before every intermediate action's `render()`, that reads
    all live uncontrolled inputs back into state first. See `App.syncComposerDom()` for the
    reference implementation. Any future multi-step/wizard-style form should call something
    equivalent before each of its own intermediate renders, not just at final Save.
- **Scroll preservation:** `renderStage()` preserves scrollTop across re-renders on the *same*
  screen (`__lastStageKey` tracking), resets only on real navigation — **except** opening/closing
  an edit form or the meal composer, which use a one-shot `__scrollTopNext` flag to force-scroll
  to the top instead. Reason: those actions insert/remove a large block *above* the list, so
  preserving the raw old pixel offset lands the user at unrelated content further down a long
  list — confirmed as a real reported bug ("edit box is at the top, item is at the bottom, I'm
  lost in the middle"), fixed by scrolling to top whenever `openAddForm`/`editMemoryItem`/
  `closeForm`/`openComposer`/`closeComposer` run. Don't add new full-form open/close actions
  without setting `__scrollTopNext = true` before their `render()` call, or this bug returns for
  that new form.
- **Responsive split:** CSS `max-width:700px` media query switches from desktop "studio" chrome
  to a full-viewport mobile layout — required, since the base design was a desktop mockup.
- **Real day-by-day history model:**
  - `App.state.dayLog = { currentDate }` — real device-clock ISO date via `todayISO()`.
  - `App.state.dayHistory[]` — archived past days: `{date, calories, protein, carbs, fat, fiber,
    sugar, sodium, waterMl, weightKg, meals, note}`. `meals` = deep-cloned full item list; `note` =
    that day's free-text note. ⚠️ Deliberately named `dayHistory`, **not** `history` —
    `App.state.history` is unrelated History-*screen* UI state (`{view, openIdx,
    selectedDayNum}`); this exact naming collision was a real bug once, don't reintroduce it.
  - `App.checkDayRollover()` — archives the old day (only if it had activity) and resets
    `today.meals/waterMl/weightKg/dailyNote` when the real date has advanced. Called at boot,
    **and** on `visibilitychange`/`pageshow`/`focus` (`recheckDayOnResume()`, bottom of
    `index.html`) — needed because a backgrounded PWA can stay suspended across midnight without
    a full reload, so a boot-only check would miss the rollover.
  - `App.allRealDays()` — single source of truth for History/Trends/Export/Desktop:
    `[todayEntry(live), ...dayHistory reversed]`. Today-entry always carries live `.meals` and
    `.note` too, so callers can treat any day uniformly.
  - Backup JSON round-trips everything via `buildBackupPayload()`/`loadLocal()`/
    `handleImportFile()` — including `usdaApiKey` and `builtinFoodsSeeded` (added for the USDA
    feature; see below). Any new piece of top-level state that should survive export/import or a
    fresh page load must be added to all three of these functions, or it'll silently reset.

## Storage limits and safety net (confirmed + implemented)

- **Real, empirically-confirmed `localStorage` cap on the user's actual phone (Oppo/OnePlus
  CPH2649, via Chrome remote debugging): ~5MB** (fails between 4–6MB). Not from documentation —
  tested directly (`chrome://inspect#devices` → USB debug → fill `localStorage` in a loop, catch
  `QuotaExceededError`). If `chrome://inspect` ever shows the device stuck "Offline / pending
  authentication": use the Android SDK's `adb.exe` at
  `C:\Users\Ahmed\AppData\Local\Android\Sdk\platform-tools\adb.exe`, run `adb kill-server` then
  `adb start-server` to force a fresh phone-side authorization prompt. (This SDK path is specific
  to the original dev machine — verify/reinstall on a different machine if this is ever needed
  there.)
- **Storage-usage indicator**: `App.storageUsageBytes()` shown on the Export screen as "Device
  storage used: X of ~5 MB" with a bar, warning styling at ≥80%.
- **Auto-prune failsafe**: `saveLocal()` → on a real `setItem` failure, `freeSpaceAndRetry()`
  removes the *oldest* `dayHistory` entry and **actually retries the real `setItem` call**,
  looping until it succeeds or history is exhausted — reactive against the real browser response,
  not a pre-guessed size threshold (don't reintroduce a guessed-threshold version — an earlier
  draft did this and silently failed to trigger when usage was small but the browser still
  rejected the write). Only ever prunes `dayHistory`, never Memory/Library. Shows a dismissible
  banner on Today explaining what was removed ("like a security-camera drive").
- Note: `localStorage` (≈5MB) is a **separate quota from the Cache Storage API** used by the
  service worker — the ~22MB of OCR assets (see below) live in Cache Storage, not localStorage,
  and don't compete with this limit at all.

## PDF export — DONE, confirmed working by user on real device

- **Libraries**: jsPDF + jsPDF-AutoTable, vendored locally at `pwa/vendor/jspdf.umd.min.js` and
  `pwa/vendor/jspdf.plugin.autotable.min.js`, precached by `service-worker.js` — works fully
  offline once installed.
- **Exact template match**: rebuilt `exportPdf()`'s day-mode branch to match a real report PDF the
  user supplied exactly: plain white background (title centered black bold, date left, green rule
  — intentionally different from the on-screen colored banner), a bordered Daily Summary table
  (dark-green header, 8 rows Calories→Water, no Weight row), a green/gold/terracotta macro-split
  bar (deliberately different palette from the on-screen macro colors), and one bordered item
  table per meal (dark navy/slate header, distinct two-tone from the Daily Summary header — a real
  feature of the original, not an inconsistency) with a tinted bold "Meal total" row.
- **Helper functions** `pdfTargetRangeLabel(id)`, `pdfDetailLabel(id, value)`, `pdfStatusLabel(s)`
  exist *specifically* to match the original's exact wording and are **not** reused for on-screen
  UI (which has its own differently-phrased equivalents).
- **Sections removed per explicit user request**: Water Intake paragraph, mechanical per-nutrient
  "Notes & Observations" bullets, and the footer (target-ranges summary + disclaimer).
- **User's free-text note — kept, after a near-miss**: removing "Notes & Observations" initially
  also dropped the user's own note (it lived in the same section). Fixed: a plain **"Notes"**
  heading + raw text from `App.state.today.dailyNote` (via `entry.note`) prints after the meal
  tables, omitted when empty. Set only via the "Today's notes" textarea + **Save note** button
  (`App.saveDailyNote()`) — deliberately not live-bound.
- **Multi-page is normal and expected**: a full real day (4 meals, ~10 items) produces a 2-page
  PDF. One support back-and-forth was a false "missing content" report that turned out to be the
  user not scrolling past page 1. **If a future "missing content" report comes up, check page
  count / ask if they scrolled before assuming a code bug.**
- **One disclosed, deliberate deviation**: original's footer (now removed) showed calories as a
  range; this app's `defaultTargets()` only has a ceiling. Not fabricating a floor that isn't in
  Settings.

## Item-level history (implemented alongside PDF export)

`checkDayRollover()` archives a **deep-cloned full snapshot of `today.meals`** into each
`dayHistory` entry, and `note` too. `allRealDays()` exposes `.meals`/`.note` on the live
today-entry as well, so `exportPdf()` can itemize **any** day's meals. Days archived *before* this
change have no `.meals` field and correctly fall back to "Item-level detail isn't stored for this
day — totals only."

## Live USDA FoodData Central API — DONE, confirmed working by user on real device

- **Search order (local-first, exactly as requested)**: saved foods/built-in quick list → live
  USDA FoodData Central search → explicit "no connection" message only if both miss. Never hits
  the network if a local match exists.
- **API key lives only on-device**, entered via **Settings → USDA API key**, stored in
  `App.state.usdaApiKey`, round-tripped through the normal backup/localStorage system — never
  hardcoded, never committed to git. No key set → live search shows a clear inline warning with a
  direct "Add a USDA API key in Settings" button. Chosen deliberately over a GitHub
  Actions/Secrets build-injection approach after the user raised the concern of a key living in a
  public repo — a per-device key avoids that entirely.
- **`fetchUsdaFood(name, apiKey)`** queries FDC's `dataType` tiers in order — `Foundation` →
  `SR Legacy` → `Survey (FNDDS)` → `Branded` — stopping at the first hit. Fixes branded/derivative
  products (e.g. "Fish oil, salmon") outranking plain whole-food entries for a bare query like
  "salmon."
  - **Real bug fixed**: Foundation-tier foods report Energy under nutrient ids `2047`/`2048`
    (Atwater factors), not the usual `1008` — caused 0 kcal results until handled.
    `USDA_KCAL_IDS` checks all three ids in priority order.
- **The 17 built-in quick-reference items (`COMMON_FOODS`) are independently verified real USDA
  values** — checked one-by-one against live FDC records after the user asked; all matched
  exactly.
- **`COMMON_FOODS` is merged into the persisted `memory.usda` list** (`mergeCommonFoodsIntoUsda()`,
  dedup by base name so e.g. "Carrot" and "Carrot, raw" don't both appear) so built-in items are
  visible in Library/Add-food with full edit/delete.
  - **One-time migration via `builtinFoodsSeeded` flag**: fresh installs get the merge baked into
    default state; existing saved data gets migrated once on next `loadLocal()`/import, then the
    flag persists so a later user deletion of a built-in item isn't silently undone by re-seeding.
    ⚠️ Don't check `this.state.builtinFoodsSeeded` directly to decide whether to migrate — the
    in-memory default is already `true`, so that check always passes even for legacy data missing
    the field. Always derive the pre-load flag explicitly from the loaded JSON before deciding.
- **A real false alarm, resolved with evidence**: user asked "did you push my key to GitHub?"
  after it seemed to work with no key set. Investigated via `git log -p --all -S"<key>"` (zero
  matches) and `curl`-fetching the live deployed file (no key present) — proved nothing was
  pushed. Root cause: the built-in quick list resolves locally with no network/key at all, and the
  food tested ("Banana") happened to be on it. Lesson: when a "live" feature appears to work
  without expected setup, check whether a different, earlier code path is quietly satisfying the
  request before assuming the new path is broken/leaky.
- **Real, unrelated bug found and fixed while testing this feature**: `getOrCreateMeal()` matched
  on `m.id === mealName.toLowerCase()`, but meal ids always carry a random suffix, so that
  condition was never true — every add to a meal created a duplicate group. Fixed to match on
  `m.name` only.

## Real OCR for label photos — DONE, confirmed working

- **Tesseract.js 7 vendored locally** at `pwa/vendor/tesseract/` (~22MB: main lib, worker script,
  three WASM core variants — `lstm`/`simd-lstm`/`relaxedsimd-lstm` — and `eng.traineddata.gz`, the
  `4.0.0_fast` English model). No CDN, fully offline-capable once cached.
  `corePath`/`langPath`/`workerPath` all passed as **absolute URLs** (`vendorUrl()` helper) —
  required because Tesseract's worker runs from a blob URL by default, and relative paths don't
  reliably resolve from inside it.
  - **Deliberately NOT added to `service-worker.js`'s `PRECACHE`** — at ~22MB, eagerly downloading
    on every install was judged worse than a one-time lazy fetch on first actual use. The existing
    generic cache-first fetch handler already caches it after first fetch.
- **`runLabelOcr(imageDataUrl)`** creates a worker, recognizes, terminates — one-shot per photo.
- **`parseNutritionLabelText(text)`**: regex-per-nutrient heuristic — good enough for standard
  label layouts, not a robust parser. **By design, this only pre-fills the manual-entry form;
  nothing auto-saves.** The user reviews/corrects every field before saving — don't "improve" this
  into silent auto-save without re-confirming that's wanted.
- **Known open issue, not yet addressed**: user reported OCR accuracy is "really bad" on some
  real-world label photos during their own testing. User said to leave it as-is for now while they
  test more — **this is an open item to revisit if the user brings it back up**, not something to
  proactively "fix" without them asking, since the parsing heuristic and/or image preprocessing
  may need real changes once we know which labels/conditions fail.

## Composite Saved Foods — DONE, confirmed working

A "Saved food" can be built from multiple independently-scalable components (e.g. "Haleem with
Roti" = Haleem 150g + Chapati 100g), not just a single fixed number.

- **Data model**: `memory.foods[]` entries optionally carry a `components` array (each
  `{id, refKind:'ingredients'|'usda'|null, refId, name, unit, weight, per100}`). Presence of
  `components` is the sole signal an entry is composite — **legacy flat entries are completely
  untouched**. Never assume every `memory.foods` entry has a trustworthy flat `kcal` without
  checking — for composites it's a derived/cached value (see next point).
- **Live-linked with graceful fallback** (chosen over a permanent snapshot): `resolveComponentPer100(comp)`
  checks whether `comp.refId` still exists in `memory[comp.refKind]`; if yes, uses (and
  opportunistically refreshes `comp.per100`/`name`/`unit` from) the live current values. If the
  linked item was deleted, falls back to the last cached `per100` — always the most-recent-seen
  value, not a stale build-time snapshot. No cleanup logic runs at ingredient-delete time; the
  fallback resolves lazily at read time, which is why this is safe.
- **`refreshCompositeFoodTotals()` runs at the top of every `App.render()`**, recomputing each
  composite's top-level `kcal/p/c/f/fib/sugar/sodium`. Every existing render site that reads
  `f.kcal`/`macrosArrayFrom(f)` works for composites with zero changes — only *expanded* views
  needed composite-aware branches. Don't remove this hook without re-auditing every read site.
- **Building**: dedicated composer (`App.openComposer()`/`renderComposerForm`, Library → Saved
  foods → "Build from ingredients"), separate from the flat `renderMemoryForm`/`saveForm` (kept
  as-is for single-number entries like "Usual Breakfast"). No free-text/NLP parsing — components
  added by searching existing Ingredients+USDA or entering a new one manually (with a checkbox,
  default checked, to also save it as a standalone Ingredient).
- **No nesting**: a composite's components can only be raw Ingredients/USDA entries, never another
  composite Saved Food.
- **Logging** (Add Food → Saved tab): composite rows expand inline to show each component with an
  adjustable weight — always defaulting to the **saved** weight, never a remembered last-session
  tweak — and an aggregate total. Adding pushes **one meal item per component** (not one merged
  line) via `addComposedFoodToMeal()`, keeping item-level History/PDF exports properly itemized.
  Flat Saved Foods keep the original checkbox multi-select + bulk-add flow, unchanged.
- **Move to Ingredients disabled for composites** — no single per-100g shape to move into. Edit
  (pencil) routes to `openComposer(id)` instead of the flat form when `item.components` exists.

### Post-ship bug fixes (found during user testing, both fixed and confirmed)

1. **Meal title always saved as "Untitled meal"** (worked fine when editing an existing meal,
   broke on every new one). Root cause: this was the "multi-step form" DOM-sync trap described in
   Architecture decisions above — `composerAddComponentFromRef`/`composerRemoveComponent`/
   `composerToggleManual` all called `render()` before Save, none of them synced the Name/
   Description fields (or component weights) from the DOM first, so typing a title *then* adding
   a component silently wiped it. Fixed with `App.syncComposerDom()`, called at the top of all
   four composer actions that render mid-flow, before they mutate state.
2. **Manual "add a new ingredient" sub-form appeared to do nothing** — most likely cause: the
   tickbox ("also save as standalone ingredient") and the "Add component" button looked like they
   should be a single step, so the required button click was probably skipped. Fixed by relabeling
   the button ("Add this to the meal") and adding a caption explicitly stating that filling the
   form alone doesn't save anything — the button click is required regardless of the tickbox.
3. **Editing a memory item on a long list scrolled to a disorienting middle position** ("edit box
   is at the top, the item is at the bottom, I'm lost"). Root cause: `renderStage()`'s scroll
   preservation restores the *old pixel offset*, but opening a form inserts a large block above
   the list — same old offset now points at unrelated content further down. Fixed with a one-shot
   `__scrollTopNext` flag (see Architecture decisions above) that scrolls to top instead, set
   before `render()` in `openAddForm`/`editMemoryItem`/`closeForm`/`openComposer`/`closeComposer`.

## Limited Edition App — DONE, shipped as "BilliFit"

Ahmed wanted a second, functionally-identical copy of this app with only cosmetic differences (app
name, icon, color scheme, backgrounds). Decided (2026-08-27): a **separate GitHub repo + separate
GitHub Pages deployment**, not a password-gated toggle inside this app — a runtime popup can't
change the installed Home Screen name/icon (the browser reads `manifest.json` at install time,
before any in-page password check runs), and serving both "flavors" from one URL would mean one
shared `localStorage` origin, not two isolated copies.

- **Shipped as "BilliFit"** — live at `https://ahmed-waheed91.github.io/billifit-pwa/`, source at
  `https://github.com/ahmed-waheed91/billifit-pwa`. Full detail on exactly what was changed (color
  tokens, icon, cat background art, font) lives in **that repo's own `plan.md`** — don't duplicate
  it here, read it there if working on BilliFit.
- **A real cross-app conflict was found and fixed before the first push, worth remembering for any
  future fork of either app**: GitHub Pages project sites for the same username are all one
  origin (`ahmed-waheed91.github.io`, differing only by path), and browsers scope `localStorage`
  to origin, not path. This repo's `LOCAL_STORAGE_KEY` (`'nourish_backup_v2'`) is NOT automatically
  isolated from a same-origin sibling app just because it lives in a different repo — a naive copy
  would silently share/overwrite data with this app on the same phone. BilliFit's key was changed
  to `'billifit_backup_v1'` specifically to avoid this. **If this app's own storage key ever
  changes, or another fork is made, re-check this.**
- **Pushing a brand-new repo needs to be done by Ahmed directly, not by the assistant.** Claude
  Code's own safety classifier blocked `gh repo create ... --push` when the assistant attempted it
  — independent of normal chat-level permission approval, and not something the assistant can
  inspect or override. Ahmed ran it himself in his own terminal instead (needed `gh auth login`
  there first, and `cd /d` instead of `cd` in `cmd.exe` to cross drive letters). Expect this for
  any future new repo.

**Naming convention for all future discussion/work, starting now:**
- **"Original App"** = this app, this repo (`nourish-pwa`, this `pwa/` folder) — the **primary
  source**. All real functional development happens here first.
- **"Limited Edition App"** = "BilliFit" (`billifit-pwa` repo) — name/icon/colors/backgrounds
  differ, but logic/features/data model must stay identical to Original App.
- Whenever a change is requested, **explicitly confirm which one it targets** before touching
  anything — default assumption should never be silent.
- **Corrected 2026-08-28 (user's exact words): "any and all changes that change the way the app
  functions in any shape or form are for both editions. only the Aesthetic aspect is specific to
  the limited Edition."** So: any functional/behavioral/logic/data change applies to **both**
  Original and Limited Edition — implement in both, it is not "Original first, port later" as a
  separate or optional step. Only aesthetic changes (colors, icon, background art, name/branding)
  are Limited-Edition-only and must **never** be ported back to Original.
- **Shipped 2026-08-27.** See the "DONE, shipped as BilliFit" heading above for the live URL and
  what to read next if working on it.

## Explicitly NOT implemented / open yet

- No new feature is queued — all four requested features are complete. Ask the user what's next.
- **OCR accuracy** (see Real OCR section above) — user found it "really bad" in some real-world
  testing, explicitly asked to leave it as-is for now while they test more. Revisit if they raise
  it again; don't proactively rework the parsing without their input on what's actually failing.

## Known environment facts / limitations

- No Node.js/npm/bun on the **original** dev Windows machine — why the PWA is hand-written vanilla
  JS. Python 3.13 available there; `pip install pillow` works (used once for icon generation).
  Android SDK (Android Studio + platform-tools + `adb`) also present at
  `C:\Users\Ahmed\AppData\Local\Android\Sdk\`. **None of this is guaranteed on a different
  machine** — verify before assuming a tool is present when working from a new PC.
- `git`/`gh` push access is configured per-machine (via `gh auth login` or equivalent) — this was
  done once on the original dev machine. A different machine needs its own auth before `git push`
  will work, even if the Drive-synced files are already there.
- **Service worker registration fails inside the Claude Code Browser-pane test tool specifically**
  — confirmed testing-tool limitation, not a code bug (real deployed site shows `active:true`
  registrations fine). Test SW behavior on the real deployed URL, not locally.
- Local testing workflow: `python -m http.server <port>` in `pwa/` + Browser-pane
  `javascript_tool` direct state calls (`App.setScreen(...)`, calling methods directly, monkey-
  patching) rather than real clicks — more reliable than coordinate-based clicking in this tool.
  Always stop the server (`pkill -f "http.server <port>"`, or the PowerShell equivalent) when
  done.
- Real bugs hit and fixed this project (don't reintroduce): `App.state.history` naming collision;
  a reactive-vs-guessed-threshold bug in the storage failsafe; a day-rollover check that only ran
  once at boot instead of on every app resume; `getOrCreateMeal` matching on the wrong id format
  (created a duplicate meal group on every add); the composer DOM-sync trap and the edit-scroll
  trap (both above, under Composite Saved Foods).

## Development History (condensed)

Early session: stood up the whole PWA from scratch (manifest, service worker, icons, GitHub Pages
hosting), replaced all fabricated/seeded sample data with a real day-by-day model, fixed mobile-
viewport CSS and various UI bugs, added Move between Saved Foods/Ingredients. Then: confirmed real
localStorage limit by testing on-device, built the storage-usage indicator and auto-prune
failsafe, built real PDF export matching the user's original report exactly through several
rounds of feedback. Then: live USDA FoodData Central lookup with a per-device API key (chosen
after discussing and rejecting a GitHub-Secrets approach), fixed a kcal-parsing bug and a
duplicate-meal-group bug found along the way, made the built-in quick-reference foods genuinely
editable/deletable. Then: real OCR for label photos via a fully-vendored, offline-capable
Tesseract.js. Then: composite Saved Foods (multi-ingredient, independently-scalable meals) built
through several rounds of upfront design Q&A, followed by two rounds of real-device bug reports
(form data wiping mid-edit, disorienting scroll-to-middle on edit) — both root-caused and fixed.
Most recently: fixed the GitHub repo's blank "Website" field for install-link discoverability, and
moved this checkpoint file into the git repo (from the parent project folder) so it stays in sync
across the user's two development machines via the same git push/pull habit as the code, after
confirming that a Claude Code session itself (browser or desktop) does not carry over between
machines.

## Four functional features (2026-08-28) — implemented in both apps, not yet confirmed on device

Per the corrected Original-vs-Limited-Edition rule above, these are **functional** changes and were
implemented in **both** this app and BilliFit in the same pass (not "Original first, port later").
Built and self-verified (via `App.*` calls in the Browser-pane test tool, not real device testing
yet) in both `pwa/index.html` and `billifit-pwa/index.html`. Ask the user to confirm each works on
their real device before considering this fully shipped — this project's established pattern is
build → confirm on device → move on, per feature.

1. **Memory-only export/import** (Export screen → new "Share memory" section, below the existing
   full backup section): `App.buildMemoryOnlyPayload()` exports just `{ foods, ingredients, usda }`
   — no day history, targets, water/weight, USDA key, or PDF export log — so a Saved-foods/
   Ingredients/USDA library can be shared with another user without handing over personal tracking
   data. Import (`App.handleMemoryImportFile`) **merges**, never replaces: incoming items are
   matched against existing ones by **case-insensitive name**, within the same list only. Zero
   conflicts → merges immediately, no extra screen. Any conflicts → sets `App.state.memoryImport`
   and shows a dedicated review screen (`renderMemoryImportReview()`, only rendered when that state
   is set — checked at the very top of `renderExport()`) listing every conflicting item with a
   3-way **Skip / Add as duplicate / Overwrite** choice (defaults to Skip), applied all together via
   `App.applyMemoryImport()` — nothing is written to `state.memory` until "Apply import" is clicked,
   so Cancel is a true no-op. Also has an **"Apply to all" bulk row**
   (`App.setAllMemoryImportChoices(choice)`) above the conflict list — one tap sets every conflict's
   choice at once, still individually overridable afterward — added after the user asked whether
   bulk-resolving was possible rather than always doing it one item at a time.
   **Overwrite preserves the existing item's `id`** (only its fields are
   replaced) specifically so any composite Saved Food's component `refId` pointing at it keeps
   resolving — don't change this to use the incoming item's id. Fresh items (auto-added or
   duplicated) get a new id via `App.genId()`. Imported composite Saved Foods whose component
   `refId`s don't exist on the receiving device (near-certain, since ids aren't shared across
   devices) fall back to each component's cached `per100` snapshot automatically — this is the
   existing composite-food architecture already designed for exactly this case (see "Composite
   Saved Foods" section above), not new fallback logic.
2. **Cross-tab search in Add Food**: previously the search box's placeholder claimed it searched
   "saved foods, ingredients, USDA" but `filterRows()` only ever filtered whichever single tab's
   `#addfood-list` was currently rendered — misleading. Fixed by always rendering **all three**
   lists into the DOM at once inside `#addfood-groups` (each in its own `[data-kind]` wrapper,
   default-hidden except the active tab), and adding `App.filterAddFoodRows(query)`: on a non-empty
   query it shows all three groups, filters rows within each by `data-name` (same mechanism as
   before), and reveals a small `.src-tag` label per row (Saved/Ingredient/USDA, via the new
   `srcTag()` helper and `.pill-brand`/`.pill-neutral`/`.pill-usda` classes) so matches are
   attributable; clearing the query reverts to normal single-tab display. **This is deliberately
   still pure DOM manipulation, never a state-driven `render()` call** — see
   "Render pattern" → "never wire `oninput` directly to a state-mutating `render()`" earlier in this
   file; wiring the merged search through `render()` instead would reopen exactly that focus-loss
   bug. The USDA tab's "Quick lookup" card (`#addfood-quicklookup`) is hidden during an active
   search (it's a tab-specific feature, not part of the merged list) and restored when the query is
   cleared, also handled inside `filterAddFoodRows`.
3. **Delete a past day** (History → Day view): each non-today entry, once expanded, shows a
   "Delete this day" button leading to an inline confirm card (`App.requestDeleteDay`/
   `cancelDeleteDay`/`deleteDay`, mirroring the existing `memoryConfirmCard` pattern). Permanent,
   removes the entry from `state.dayHistory` by `date` — since History/Trends/Export all read from
   `allRealDays()` fresh on every render, the deletion disappears from all three immediately with
   no extra invalidation needed. Today itself is never deletable this way (it isn't archived yet).
4. **Removed the "Notes" tab from Memory & Library** entirely — Memory is now 3 tabs (Saved foods/
   Ingredients/USDA), not 4. That tab actually held two unrelated things: hardcoded `RULE_NOTES`
   cards (leftover AI-instruction text from when this app was manually driven via a Claude Project
   — genuinely dead weight, per the user) and a live bone-to-total-weight-ratio calculator
   (`boneEntries`/`addBoneEntry()`/`boneAvg`) — confirmed via full-codebase search that
   `boneEntries` was read **only** by that calculator's own display and backup round-tripping,
   nothing else, so removing it doesn't touch any macro/logging calculation. Both removed together
   per explicit user confirmation once this was explained. `renderLibrary()` now defensively resets
   `st.activeTab` back to `'foods'` if it's ever anything outside the 3 valid tabs (guards against a
   returning user's `localStorage` still holding `activeTab:'notes'` from before this change).

## Immediate next steps (pick up here)

The four features above are implemented and self-tested in both apps but **not yet confirmed by the
user on a real device** — that's the next step before considering them done. One open thread to
keep in mind if it comes back up: OCR accuracy on real-world label photos (user is still testing,
explicitly asked to leave it alone for now).
