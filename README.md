# guided-tour

Minimal, configurable single-page guided tours for React. See [spec.md](spec.md) for the full design.

```tsx
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

## Develop

```sh
yarn install
yarn dev        # sample dashboard at http://localhost:5173 (uses the library source directly)
yarn test       # library unit tests
yarn typecheck  # library + example
yarn build      # build the library to packages/guided-tour/dist
```

- `packages/guided-tour`: the library
- `examples/dashboard`: "Acme Analytics", a sample app with 3 tours and a dev panel (bottom-left) to start, stop and reset tours and inspect localStorage
