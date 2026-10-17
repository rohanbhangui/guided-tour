# Guided Tour — Spec

> Status: **v0.1 implemented** (M0–M3 mostly done, see §13). Working document, expect changes.

## 1. Summary

A React library for **single-page guided tours**: a sequence of popovers that point at parts of the current screen ("this is your revenue chart", "filter the table here") with a spotlight on the target element. Steps are declared inline in the JSX next to the element they point at (`<Step id="revenue-chart" title="…" content="…"><RevenueChart /></Step>`). A small tour definition sets their order. Tours are registered with a drop-in `<TourProvider>` and controlled through `useTourActions()` / `useTour()`.

Whether a user has already seen a tour is stored in `localStorage`, so each tour shows **once** per browser unless it is reset.

The repo also ships a **sample dashboard app** that we use to develop, demo and test the library.

## 2. Goals / Non-goals

**Goals**
- Drop-in: wrap the app in one provider, list the step order, wrap target elements in `<Step>`, done.
- Configurable from day one: content, placement, styling, keyboard behaviour, persistence and lifecycle hooks are all overridable.
- Easy, typed syntax for defining tours and steps (string or React node content).
- Show-once behaviour via `localStorage`, with explicit `stop` and `reset` controls.
- Accessible (keyboard, focus management, screen readers).
- Minimal footprint: no added DOM and no re-renders of the host app while idle, and a tiny bundle (§9).

**Non-goals (v1)**
- Multi-page / cross-route tours.
- Server-side persistence of tour state (but the storage layer is pluggable so this can come later).
- A visual tour builder / no-code editor.
- Analytics integrations (exposed via lifecycle callbacks instead).

## 3. Repo layout

The repo is laid out like the project the library will end up in: the library sits in `libs/guided-tour/`, and the repo root is a small Vite (React + TS) demo app that consumes it. Yarn (v1) workspaces (`libs/*`) install the library's dependencies. The demo imports the library's source directly through an alias, so edits show up live without a build step. **TypeScript everywhere**.

- `strict: true`. The library has its own standalone `tsconfig.json`, `package.json` and build/test config, so `libs/guided-tour` can be copied into another repo without edits.
- All public types are exported (`TourDefinition`, `ConfigStep`, `StepOptions`, `StepTarget`, `TourStorage`, `KeyboardOptions`, `TourActions`, etc.) so consumers get full autocomplete.
- The library has no app-specific imports and nothing outside its own folder. Everything it needs comes in through props and config.

```
guided-tour/
├── libs/
│   └── guided-tour/          # the library: copy this folder to move it
│       ├── src/
│       ├── test/
│       ├── README.md
│       ├── package.json
│       └── tsconfig.json
├── src/                      # demo app (Acme Analytics dashboard)
├── index.html
├── vite.config.ts
├── spec.md
└── package.json
```

- Build: `tsup` (ESM + CJS + `.d.ts`), CSS shipped as a separate importable file.
- Peer deps: `react >= 18`, `react-dom >= 18`.
- Runtime dep: `@floating-ui/dom` for popover positioning (flip, shift, arrow, auto-update on scroll/resize). This is the only dependency (see §9).

## 4. Public API

### 4.1 Two ways to declare steps

Defining every step in one config array that points at elements by CSS selector works, but it pulls the content away from the UI it describes. Selectors break silently when markup changes, and positioning has to guess at elements it can't see. So **inline steps are the main way to declare steps**: each step lives in the JSX next to the element it describes and gets a real ref to it. Config steps stay available for steps that have no element to point at (welcome and finish screens).

| | Inline (`useTourStep` / `<TourStep>`) | Config (`steps: [...]`) |
|---|---|---|
| Target | ref to the actual element | selector / ref / function |
| Content lives | next to the UI it describes | in a central tour file |
| Best for | anything anchored to an element | centered intro/outro steps |

A tour can mix both. The tour definition sets the **order**, and inline steps fill in the content.

### 4.2 Defining a tour

`defineTour` is an identity helper that exists for type inference and dev-time validation.

```tsx
import { defineTour } from 'guided-tour';

export const dashboardTour = defineTour({
  id: 'dashboard-intro',      // unique — also used for the storage key
  version: 1,                 // bump to re-show the tour to everyone
  autoStart: true,            // start on mount if not already seen
  // Order of steps by id. Strings = inline steps registered from components.
  // Objects = config steps defined right here.
  steps: [
    { id: 'welcome', title: 'Welcome to Acme', content: "Here's a 30-second look around." },
    'sidebar',
    'kpis',
    'revenue-chart',
    'orders-table',
    { id: 'done', title: "You're all set", content: 'Replay this anytime from the Help menu.' },
  ],
});
```

Typed step ids: `defineTour` infers the id union from `steps`, so `<Step id="revnue-chart">` (typo) is a compile error. The same goes for `start(tour, { step })` (§4.9).

### 4.3 Inline steps

There are three ways to write an inline step, and they share one implementation. Every step is registered by a `<TourStep>` element when it mounts. The other two forms are shortcuts for writing that element.

**A. Bound `<Step>` component (recommended).** Call the hook once per component, and it returns a `<Step>` component already bound to the tour. Wrap any element with it:

```tsx
import { useTourSteps } from 'guided-tour';
import { dashboardTour } from '../tours';

function Overview() {
  const { Step } = useTourSteps(dashboardTour);

  return (
    <>
      <Step id="kpis" title="Key metrics" content="Your four headline numbers, updated hourly.">
        <KpiRow />
      </Step>

      <Step
        id="revenue-chart"
        title="Revenue"
        content={<>Hover for daily totals. Use <kbd>7D / 30D / 90D</kbd> to change the range.</>}
        placement="left"
      >
        <RevenueChart />
      </Step>

      {/* conditional and inside .map() are fine, it's just JSX */}
      {hasOrders && (
        <Step id="orders-table" content="Search, filter and sort every order here.">
          <OrdersTable />
        </Step>
      )}
    </>
  );
}
```

- `<Step>` is `<TourStep tour={dashboardTour}>` with the tour already filled in, so you don't pass it on every step.
- `id` is typed against the tour's step ids, so a typo doesn't compile.
- One hook call per component no matter how many steps it declares. The `Step` component's identity is stable (memoized per tour), so it never remounts its children.
- Outside a running tour it adds no DOM and costs almost nothing (it passes the child through with a ref merged into it).

**B. `useTourStep` ref hook.** Use this when wrapping is awkward, e.g. the target is the component's own root element:

```tsx
function RevenueChart() {
  const tourRef = useTourStep(dashboardTour, 'revenue-chart', { title: 'Revenue', content: '…' });
  return <Card ref={tourRef}>…</Card>;
}
```

**C. Standalone `<TourStep>`.** The underlying primitive. It works without the hook, e.g. in a component that only has one step:

```tsx
<TourStep tour={dashboardTour} id="sidebar" title="Navigation" placement="right"
  content="Jump between Overview, Orders and Customers here.">
  <Sidebar />
</TourStep>
```

**How the ref gets attached.** By default `<TourStep>` merges its ref into its only child (Radix `Slot`-style), so no extra DOM is added. That needs the child to accept a ref: a DOM element, a `forwardRef` component, or any component on React 19 (where `ref` is a regular prop). If the child can't take a ref, pass `wrapper="div"` (or `"span"`) and a wrapper element is rendered and measured instead. In development, if no element ever reaches the ref, a warning tells you to use `wrapper`.

`tour` can be the tour object (gives typed ids) or the tour id string. Prefer the object: the string form isn't type-checked.

**One element, several tours.** Nest them: `<Step id="kpis" …><OtherTourStep id="metrics" …><KpiRow /></OtherTourStep></Step>`.

### 4.4 How ordering and registration work

- **Order comes from the tour definition**, not from the order components mount. Inline steps register with the provider on mount and unregister on unmount, keyed by `tourId + stepId`.
- **Step count is known up front** (`steps.length`), so "3 of 7" and the dots don't jump around as components mount.
- **Step not mounted when reached** (e.g. inside a closed drawer, or a collapsed sidebar): the tour runs that step's `onBeforeShow` from the **tour definition**, then waits up to `waitTimeout` for the step to register. An inline step can't open its own drawer because its code isn't mounted yet. So the definition can give a step's id together with an `onBeforeShow` and leave out the content, and the inline step supplies the content once it mounts:
  ```ts
  steps: [..., { id: 'theme-toggle', onBeforeShow: () => openSettingsDrawer() }, ...]
  ```
  An object with no `content` is merged with the inline step of the same id. An object with `content` is a self-contained config step. If it never registers, the `missingTarget` strategy applies (§4.7).
- **Same step registered twice** (two mounted copies of a component): dev warning, and the most recently mounted one wins.
- **Step id that is declared but never used** (listed in `steps` but never rendered by any `<Step>` / `useTourStep` / `<TourStep>`): dev warning when the tour starts and reaches it.
- **Content updates live**: inline step props are read on every render, so content can depend on component state (e.g. "You have 3 unread notifications").
- **Ad-hoc tours without a step list** (nice-to-have): give inline steps an `order` number instead, and the tour sorts whatever is registered. The catch is that the step count can change as things mount, so this is opt-in.

### 4.5 Step shape

Every step has the same options whether it's declared inline or in config. The only difference is the target: an inline step's target is always the element it's attached to.

```ts
type StepTarget =
  | string                         // CSS selector — config steps only
  | React.RefObject<HTMLElement | null>
  | (() => HTMLElement | null);    // escape hatch

// `<Step>` props are `id` + StepOptions; its target is always the element it wraps.
interface ConfigStep extends StepOptions {
  id: string;                      // required — used for ordering, goTo('id'), analytics
  target?: StepTarget;             // config steps only; omitted → centered step, no spotlight
}

interface StepOptions {
  title?: React.ReactNode;
  content?: React.ReactNode;       // string or any React node; omit to merge with the inline step (§4.4)
  placement?: Placement;           // preset string or object, see §4.6 (default 'auto')
  spotlight?: boolean;             // cut a hole around the target; default true when target exists
  overlay?: boolean;               // per-step override of the tour's overlay
  highlight?: boolean;             // per-step override of the tour's highlight ring
  width?: number | string;         // per-step popover width override
  spotlightPadding?: number;       // px around target, default 8
  spotlightRadius?: number;        // px, default 6
  interactive?: boolean;           // can the user click the highlighted element? default false ('click'/'manual' steps: true)
  advanceOn?: 'next' | 'click' | 'manual'; // how the user moves past this step; default 'next' (see below)
  scrollIntoView?: boolean | ScrollIntoViewOptions; // default true
  showPrev?: boolean;              // per-step overrides of tour-level UI flags
  showClose?: boolean;
  nextLabel?: React.ReactNode;
  prevLabel?: React.ReactNode;
  onBeforeShow?: (ctx: StepContext) => void | Promise<void>; // e.g. open a drawer first
  onAfterShow?: (ctx: StepContext) => void;
}
```

**Action steps (`advanceOn`).** Some steps should only move on once the user *does* something ("click a filter to continue"). This is a per-step option, not a separate kind of tour, so one tour can mix normal and action steps freely.

| `advanceOn` | Moves on when | Next button / → / Enter | Target clickable |
|---|---|---|---|
| `'next'` (default) | the user presses Next | yes | only if `interactive` |
| `'click'` | the user clicks the target (or anything inside it) | disabled / ignored | always |
| `'manual'` | your code calls `advance(tour, stepId)` (§4.9), e.g. after a form submits or a filter applies | disabled / ignored | yes, unless `interactive: false` |

```tsx
<Step id="orders-filters" advanceOn="click" content="Click a status chip to filter the table.">
  <FilterChips />
</Step>

// 'manual': advance only when the thing actually happened
const { advance } = useTourActions();
const onSaved = () => advance(settingsTour, 'settings-save'); // no-op unless that step is the one showing
```

- **The step can't be skipped from the tour UI.** Next is shown but disabled (so it's clear an action is expected), → / Enter do nothing, and the progress dots can't jump past it. Back, close and hold-Esc still work, so the user is never trapped.
- **Programmatic calls still work.** `next()` / `goTo()` from your code aren't blocked; the rule is about the tour's own UI.
- **`'click'` advances after your click handler runs**, so the next step sees the updated app state (e.g. the drawer the click opened).
- **`'click'` with no target** (missing, or `missingTarget: 'center'`) falls back to `'next'` with a dev warning, so the tour can't get stuck.
- **`'manual'` with the action outside the target**: the overlay blocks clicks outside the spotlight, so set `overlay: false` on that step.
- The popover should say what to do ("Click a status chip…"), since the disabled Next button alone doesn't.
- Dots can only skip ahead to steps they know are action steps: config entries, and inline steps that are mounted or have been mounted. To be certain, also put `advanceOn` on the step's entry in the tour definition: `{ id: 'orders-filters', advanceOn: 'click' }`.

### 4.6 Positioning

`placement` takes either a **preset string** (the common case) or an **object** for fine control.

```ts
type PlacementPreset =
  | 'top' | 'top-start' | 'top-end'
  | 'right' | 'right-start' | 'right-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'left' | 'left-start' | 'left-end'
  | 'auto'      // pick the side with the most room (default)
  | 'center';   // centered in the viewport (default for steps with no target)

type Length = number | `${number}px` | `${number}%`; // number = px; % = of the reference box

type Placement =
  | PlacementPreset
  | AnchoredPlacement
  | InsetPlacement;

/** Beside the target, like the presets but with tunable offsets. */
interface AnchoredPlacement {
  side: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end'; // default 'center'
  offset?: Length;   // gap between target and popover, default 12
  shift?: Length;    // nudge along the edge (+ = toward end), default 0
  flip?: boolean;    // switch to the opposite side if out of view, default true
}

/** CSS-style insets, as if the reference box were `position: relative`. */
interface InsetPlacement {
  top?: Length; right?: Length; bottom?: Length; left?: Length;
  relativeTo?: 'target' | 'viewport'; // default 'target'
}
```

**Examples**

```ts
placement: 'right-start'
placement: { side: 'right', align: 'start', offset: 40 }          // 40px gap to the right
placement: { side: 'bottom', shift: -24 }                         // below, nudged 24px left
placement: { top: 0, right: 40 }                                  // inside target, 40px from its right edge
placement: { top: '100%', left: 0 }                               // flush under the target's bottom-left corner
placement: { bottom: 24, right: 24, relativeTo: 'viewport' }      // pinned bottom-right of the screen
```

**Inset semantics.** The values mean what they would in CSS for an absolutely positioned child of the reference box. `right: 40` puts the popover's right edge 40px inside the target's right edge. Negative values push it outside the box. `%` is a percentage of the reference box's width (for left/right) or height (for top/bottom). Inset placement doesn't flip and hides the arrow by default, because you asked for an exact spot. It is still clamped so it never goes off-screen.

**Why there's no `position: relative` (and nothing injected).**
- The popover and spotlight render in a **portal on `document.body`** with `position: fixed`. Their coordinates are computed from the target's `getBoundingClientRect()` and updated on scroll, resize, and target size changes (floating-ui `autoUpdate` + `ResizeObserver`).
- So every placement, including the "relative to the parent" inset form, is pure arithmetic on the measured rectangle. The library **never writes styles to your elements**.
- Injecting `position: relative` would be fragile:
  - It can break layouts that rely on `static` positioning.
  - It changes stacking contexts and which element absolutely positioned children are placed against.
  - The popover would still be clipped by any ancestor with `overflow: hidden` and lose z-index battles.
- Rendering in a portal avoids all of that, and the target's DOM stays untouched.
- **Escape hatch:** `portalContainer` on the provider takes a DOM element (default `document.body`, read at mount, so it's still SSR-safe) for apps that need the popover inside a specific root (e.g. a shadow DOM or an iframe-hosted app).

### 4.7 Tour shape

```ts
interface TourDefinition {
  id: string;
  version?: number;                  // default 1
  steps: Array<string | ConfigStep>; // string = inline step id, object = config step
  autoStart?: boolean;               // default false
  autoStartDelay?: number;           // ms, default 0 — lets the page settle
  // UI options (all overridable at provider level too)
  progress?: 'dots' | 'counter' | 'both' | 'none'; // default 'counter' ("3 of 7")
  maxDots?: number;                  // default 5; past this, dots become a sliding window with shrinking edge dots
  width?: number | string;           // popover width (px or CSS length); default content-sized up to 360px
  showClose?: boolean;               // default true
  showPrev?: boolean;                // default true (hidden on step 1 regardless)
  dismissOnOverlayClick?: boolean;   // default false
  overlay?: boolean;                 // darken the page; default true. false = popover-only, page stays clickable
  highlight?: boolean;               // glowing ring around the target edge; default true (--gt-ring-color/-width/-glow)
  keyboard?: KeyboardOptions;        // see §6
  missingTarget?: 'skip' | 'center'; // after waiting `waitTimeout`; default 'skip'
  waitTimeout?: number;              // ms to wait for a target to appear, default 3000 (0 = don't wait)
  // lifecycle
  onStart?: (ctx) => void;
  onStepChange?: (ctx) => void;
  onComplete?: (ctx) => void;        // finished last step
  onDismiss?: (ctx) => void;         // closed early (X, Esc, stop())
}
```

### 4.8 Provider

```tsx
import { TourProvider } from 'guided-tour';
import 'guided-tour/styles.css';

<TourProvider
  tours={[dashboardTour, ordersTableTour]}
  storage={localStorageAdapter({ prefix: 'guided-tour' })} // default
  defaults={{ progress: 'both', keyboard: { escape: 'hold' } }}
  components={{ Popover: MyPopover }}  // optional slot overrides, see §7
  disabled={isE2E}                      // kill switch
  portalContainer={rootEl}               // optional DOM element; defaults to document.body
>
  <App />
</TourProvider>
```

- Registers tours; warns in dev on **duplicate `id`s** (keys must be unique).
- Handles `autoStart` tours on mount: starts the first registered auto-start tour whose storage entry is absent. **Only one tour runs at a time.** If several auto-start tours are due, they run one after another in `tours` order: the next starts when the current one completes or is dismissed (after its own `autoStartDelay`).
- A manual `start(tour)` while another tour is running ends the running one without recording it, so an auto-start tour interrupted this way shows again on the next load.
- Renders the overlay/popover into a portal on `document.body` (or `portalContainer`).
- SSR-safe: no `window`/`localStorage` access during render.
- **Required.** Every hook (`useTour`, `useTourActions`, `useActiveStep`, `useTourSteps`) and every `<Step>` must be rendered inside a `<TourProvider>`. Used outside one, it throws on first render, in dev and production: `[guided-tour] useTourActions must be used inside <TourProvider>.` (the message names the hook). This can't be a TypeScript error: whether a provider sits above a component depends on where it's rendered at runtime, not on its types.

### 4.9 `useTourActions()` / `useTour()` hooks

`useTourActions()` returns only the actions below and never re-renders. `useTour()` returns the same actions plus the state fields, and re-renders when the tour starts, stops or changes step.

```ts
const tour = useTour();

tour.start(dashboardTour);                     // start (even if already seen)
tour.start(dashboardTour, { step: 2 });        // start at a step (index, or a step id of that tour)
tour.next();
tour.prev();
tour.goTo(4);                                  // index or step id
tour.stop();                                   // end the active tour now, mark as dismissed
tour.reset(dashboardTour);                     // clear its storage entry so it shows again
tour.reset();                                  // clear all registered tours
tour.reset(dashboardTour, { restart: true });  // clear + start immediately
tour.advance(dashboardTour, 'kpis');           // next(), but only if that step is the one showing (for advanceOn: 'manual')

tour.activeTourId;    // string | null
tour.stepIndex;       // number
tour.totalSteps;      // number
tour.isActive;        // boolean
tour.hasSeen(dashboardTour); // boolean — read from storage
```

Tours are always passed as their `defineTour` object, never as an id string, so a wrong tour or a wrong `step` id is a compile error. The id string appears once, inside `defineTour`.

**`stop` vs `reset`**
| | Ends active tour | Writes storage | Will auto-show again |
|---|---|---|---|
| `stop()` | yes | `dismissed` | no |
| `reset(tour)` | yes, if it's the active one | removes entry | yes (next mount / `restart: true`) |

`stop({ persist: false })` ends the tour without writing storage (it will auto-show again next load).

### 4.10 Convenience helpers

- `mergeRefs(...refs)`: combines a tour ref with your own refs.
- *Planned:* `<TourTrigger tour={ordersTour}>Take the tour</TourTrigger>`, a button that calls `start`.

## 5. Persistence

- Default adapter: `localStorage`.
- Key format: `` `${prefix}:${tourId}:v${version}` `` → e.g. `guided-tour:dashboard-intro:v1`.
  - Tour `id` must be unique across the app; `version` lets us re-show a changed tour without touching ids.
- Value (JSON):
  ```json
  { "status": "completed" | "dismissed", "step": 4, "updatedAt": "2026-10-13T12:00:00Z" }
  ```
- Show rule: an `autoStart` tour shows **only if no entry exists** for its key. Both `completed` and `dismissed` suppress it. (Open question: should `dismissed` resume from `step` instead?)
- Storage access is wrapped in try/catch; if `localStorage` is unavailable (private mode, blocked), fall back to in-memory and behave as "not seen".
- Pluggable adapter interface so we can swap in server/user-profile storage later:
  ```ts
  interface TourStorage {
    get(key: string): TourRecord | null | Promise<TourRecord | null>;
    set(key: string, value: TourRecord): void | Promise<void>;
    remove(key: string): void | Promise<void>;
  }
  ```

## 6. Keyboard & dismissal

| Action | Default |
|---|---|
| Next | `→` or `Enter` |
| Previous | `←` |
| Close / dismiss | X button in corner |
| Quick exit | **Hold `Esc` for ~500 ms** (progress ring on the X while held) |

```ts
interface KeyboardOptions {
  enabled?: boolean;               // default true
  arrows?: boolean;                // default true
  escape?: 'tap' | 'hold' | false; // default 'hold'
  escapeHoldMs?: number;           // default 500
}
```

Rationale for hold-Esc default: a single Esc tap is easy to hit accidentally (e.g. closing a dropdown inside an `interactive` step). `'tap'` is available for people who prefer it. Esc-triggered exits call `stop()` → recorded as `dismissed`.

## 7. UI & customization

**Default popover anatomy**
```
┌──────────────────────────────────┐
│ Title                        [X] │
│                                  │
│ Content (string or ReactNode)    │
│                                  │
│ ● ● ◉ ○ ○      3 of 7  [Back][Next] │
└──────────────────────────────────┘
```
- Last step's Next button reads "Done" and completes the tour.
- Arrow pointing at the target.
- Dim overlay with a rounded cutout (SVG mask) around the target; overlay animates between steps.

**Customization layers** (from lightest to heaviest):
1. **CSS variables** — `--gt-accent`, `--gt-radius`, `--gt-overlay-color`, `--gt-z-index`, `--gt-popover-width`, etc. Light/dark aware.
2. **`classNames` prop** — per-part class names (`overlay`, `ring`, `floating`, `popover`, `header`, `title`, `content`, `footer`, `progress`, `dots`, `dot`, `counter`, `button`, `primaryButton`, `close`, `arrow`) for Tailwind/CSS modules users.
3. **Component slots** — `components={{ Popover }}` receives the step + controls as props (`PopoverProps`; `DefaultPopover` is exported to wrap or extend). Props include `advanceOn` (disable your Next button unless it's `'next'`) and `canGoTo(index)` (disable dots the user can't jump to; `goTo` already ignores them). *Planned:* finer slots `Dots`, `Controls`, `CloseButton`.
4. **Headless** — build your own UI from `useTour()` + `useActiveStep()` (returns the active tour/step ids, index, total, target element and the step's resolved options).

**Labels / i18n** — `labels={{ next, prev, done, close, stepCounter: (i, n) => \`${i} of ${n}\`, goToStep: (i) => \`Go to step ${i}\` }}` on provider (defaults exported as `DEFAULT_LABELS`).

## 8. Behaviour details

- On step change: run `onBeforeShow` (awaited) → resolve target → scroll into view → position popover → focus popover.
- Popover repositions on scroll, resize and target size changes (`autoUpdate` from floating-ui + `ResizeObserver`).
- Positioning never mutates target styles; see §4.6.
- Target not found → follow `missingTarget` strategy; log a dev warning.
- Target removed mid-step → same as missing.
- Clicks on the overlay are blocked; clicks on the highlighted target are blocked unless `interactive: true`.
- Page scroll stays enabled (we scroll the target into view rather than locking).
- Respects `prefers-reduced-motion` (no animated transitions).

## 9. Footprint & performance

The tour must never get in the way of the host app. When no tour is running, it should cost close to nothing. When one is running, it should only re-render its own UI.

**DOM**
- **Idle, no tour active: 0 added DOM nodes.** `<TourProvider>` renders just `children`. The portal container is created on `start()` and removed on `stop()` or completion.
- **`<Step>` adds 0 DOM nodes.** It merges a ref into its child and adds no wrapper. The opt-in `wrapper="div"` is the only exception.
- **No changes to your elements.** No added attributes, classes, inline styles or `position` changes (§4.6).
- **Active: one small portal.** One overlay `<svg>` with a mask cutout for the spotlight, plus one popover. It doesn't grow with the number of steps, because only the current step is rendered.

**Rendering**
- **Registering steps doesn't cause re-renders.** Steps register their element and props in a mutable registry (a `Map` held in a ref), not in React state. Mounting 50 `<Step>`s re-renders nothing.
- **The app tree never re-renders when the step changes.** Tour state lives in a small external store. Only the tour's own portal UI and components that opt in through `useTour()` / `useActiveStep()` subscribe to it (via `useSyncExternalStore`). `<Step>` doesn't subscribe at all.
- **One stable context + an external store.** The context value (the controller) never changes identity; state lives in the store. `useTourActions()` reads only the stable actions, so a component that only calls `start()` never re-renders because of the tour.
- **Step content is read lazily.** It's only rendered when that step becomes active.

**Listeners & work**
- `scroll`, `resize` and `keydown` listeners, the `ResizeObserver` and position updates are attached **only while a tour is active**, and only for the current target. Idle cost: no listeners.
- Position updates run in `requestAnimationFrame` and are throttled to one per frame.
- `localStorage` is read once per tour on provider mount, then cached in memory.

**Bundle**
- Budget: **≤ 8 KB min+gzip** for the library, excluding `@floating-ui/dom`. Currently ~8.6 KB (esbuild minify + gzip), slightly over. *Planned:* enforce with `size-limit` in CI.
- Use `@floating-ui/dom` (smaller) instead of `@floating-ui/react`.
- Tree-shakeable ESM. `sideEffects` is limited to the CSS file. No other runtime deps.
- *Planned:* lazy-load the default popover UI on first `start()` (opt-in `lazyUI` prop), so the initial bundle only contains the provider and `<Step>`.
- CSS: one small file. All classes are prefixed `gt-`, with no global resets or element selectors.

## 10. Accessibility

- Popover: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (title) and `aria-describedby` (content).
- Focus moves to the popover on each step; Tab is trapped within the popover (not on `interactive` steps, which also drop `aria-modal`); restored to the previously focused element on exit.
- Step counter announced via `aria-live="polite"`.
- Close and nav buttons have accessible labels; all controls reachable by Tab.
- Visible focus rings; meets WCAG AA contrast with default theme.

## 11. Sample app — "Acme Analytics" dashboard

Vite + React + TS at the repo root (`src/`, `index.html`). Fake data, no backend. Deliberately busy so tours have real things to point at and real edge cases to handle.

**Layout**
- **Sidebar**: logo, nav (Overview, Orders, Customers, Settings), collapse toggle.
- **Top bar**: global search, date-range picker, notifications bell (dropdown), help menu ("Replay tour", "Reset all tours"), avatar menu.
- **KPI row**: Revenue, Orders, Conversion, Churn cards with sparklines.
- **Main chart**: revenue over time with 7D / 30D / 90D toggle.
- **Orders table**: search, status filter chips, sortable columns, pagination, row actions menu.
- **Activity feed**: right column, scrollable.
- **Settings drawer**: slides in from the right (tests `onBeforeShow` opening UI before a step).

**Tours to build**
1. `dashboard-intro` — auto-start, ~7 steps across sidebar → KPIs → chart → table → help menu, ends with a centered step.
2. `orders-table` — manual, started from a "?" button on the table; includes an action step (`advanceOn: 'click'`, "click a status chip to continue").
3. `settings` — manual; first step opens the drawer via `onBeforeShow`.

**Dev panel** (bottom-left, dev only): shows current storage entries, buttons for `start`/`stop`/`reset` per tour, toggle for Esc mode. Doubles as our manual test harness.

**Edge cases the sample should exercise**: target below the fold, target inside a scroll container, target near viewport edges, collapsed sidebar (target hidden), window resize mid-tour, dark mode.

## 12. Testing

- **Unit** (Vitest + React Testing Library): step navigation, storage read/write/reset, autoStart rules, duplicate-id warning, keyboard handling (incl. hold-Esc timing with fake timers), missing-target strategies, action steps (`advanceOn`), auto-start queueing, hooks throwing outside `<TourProvider>`.
- **Footprint** (§9): idle provider adds 0 DOM nodes; `<Step>` adds 0 DOM nodes; mounting steps and advancing the tour causes 0 re-renders of sibling/app components (React Profiler assertions); `size-limit` budget in CI.
- **E2E** (Playwright against the sample app): first visit shows tour, reload doesn't, reset shows it again, Esc-hold exits, positioning snapshots at a few viewport sizes.
- **a11y**: `axe` checks in E2E.

## 13. Milestones

1. ✅ **M0 — Scaffold**: library in `libs/guided-tour`, sample dashboard at the repo root (static UI, fake data).
2. ✅ **M1 — Core**: provider, `defineTour`, `useTour`, default popover + overlay, next/prev/close, counter + dots, localStorage persistence, autoStart.
3. ✅ **M2 — Polish**: hold-Esc, arrow keys, focus management, scroll/resize handling, missing-target strategies, animations, overlay/highlight options.
4. 🟡 **M3 — Customization**: CSS vars, `classNames`, `components.Popover` slot, `useActiveStep`, labels are done. Still to do: `lazyUI`, finer slots (`Dots`, `Controls`, `CloseButton`), and ad-hoc `order`-based tours.
5. 🟡 **M4 — Hardening**: 27 unit tests (incl. footprint, StrictMode, action steps, tour queueing and compile-time type checks). Bundle is ~8.6 KB min+gzip (excluding floating-ui), just over budget. Still to do: Playwright E2E in CI, axe a11y pass, `size-limit` in CI, publish config.

## 14. Open questions

1. **Esc behaviour** — hold-to-exit by default, or plain tap? Should tap-Esc do anything (e.g. nothing, or same as X)?
2. **Dismissed vs completed** — should a dismissed tour resume where it left off next time, or stay suppressed forever like now?
3. **Progress indicator default** — counter ("3 of 7"), dots, or both?
4. **Imperative API outside React** — do we want a `tourStore.start(tour)` usable from non-component code (e.g. after an API call), or is the hook enough?
5. **Styling approach** — ship plain CSS + variables (proposed), or go unstyled-by-default?
6. ~~**Overlay**~~: resolved. There are separate `overlay` (dim) and `highlight` (ring) options per tour and per step.
7. **Package name** — `guided-tour`? Something else?
8. ~~**Naming**~~: resolved. `<Step>` from `useTourSteps(tour)` for steps; `useTourActions()` for actions and `useTour()` for actions + state, kept separate so placing steps never subscribes to state.
9. **Ad-hoc ordering** — do we need tours without a step list (ordered by an `order` number, §4.4), or is requiring the list in the definition fine?
