# guided-tour

Minimal, configurable single-page guided tours for React.

- Peer deps: `react >= 18`, `react-dom >= 18`
- Runtime dep: `@floating-ui/dom`
- No app-specific imports. Everything comes in through props and config.

## Usage

```tsx
import 'guided-tour/styles.css';
import { TourProvider, defineTour, useTourSteps, useTourActions } from 'guided-tour';

// tours.ts
export const introTour = defineTour({
  id: 'dashboard-intro',
  autoStart: true,
  steps: [{ id: 'welcome', title: 'Welcome', content: 'A quick look around.' }, 'kpis', 'revenue-chart'],
});

// App.tsx
<TourProvider tours={[introTour]}>
  <App />
</TourProvider>

// KpiRow.tsx: declare steps inline, next to the UI they describe
const { Step } = useTourSteps(introTour);
<Step id="kpis" title="Key metrics" content="Your headline numbers." placement="bottom">
  <KpiCards />
</Step>

// anywhere
const { start, stop, reset } = useTourActions();
```

## Scripts

```sh
yarn test       # unit tests (vitest + jsdom)
yarn typecheck
yarn build      # dist/: ESM + CJS + .d.ts + styles.css
```

## Moving into another project

This folder is self-contained: its own `package.json`, `tsconfig.json` and build/test config, with no imports from outside it. Copy it as-is, e.g. to `libs/guided-tour/`, then pick one way to consume it.

**As a workspace package (recommended).** Add `libs/*` to the host's workspaces, add `"guided-tour": "*"` (or `workspace:*` on pnpm/Yarn 2+) to the app's dependencies, and install. Run `yarn build` in the package, or skip the build by aliasing to source (below).

**From source, no build step.** Point the bundler and TypeScript at `src/`:

```ts
// vite.config.ts
resolve: {
  alias: [
    { find: /^guided-tour\/styles\.css$/, replacement: path.resolve(__dirname, 'libs/guided-tour/src/styles.css') },
    { find: /^guided-tour$/, replacement: path.resolve(__dirname, 'libs/guided-tour/src/index.ts') },
  ],
},
```

```jsonc
// tsconfig.json
"paths": { "guided-tour": ["./libs/guided-tour/src/index.ts"] }
```

Then make sure the host has `@floating-ui/dom` installed.
