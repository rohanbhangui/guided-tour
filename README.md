# guided-tour

Minimal, configurable single-page guided tours for React. See [spec.md](spec.md) for the full design.

The library lives in [libs/guided-tour](libs/guided-tour) ([usage](libs/guided-tour/README.md)). The folder is self-contained, so you can copy it into another project's `libs/` as-is. The repo root is a small Vite app ("Acme Analytics") that uses the library the same way a host project would.

## Develop

```sh
yarn install
yarn dev        # demo at http://localhost:5173 (uses the library source directly)
yarn test       # library unit tests
yarn typecheck  # library + demo
yarn build      # build the library to libs/guided-tour/dist
```

The demo has 3 tours and a dev panel (bottom-left) where you can start, stop and reset tours and inspect localStorage.
