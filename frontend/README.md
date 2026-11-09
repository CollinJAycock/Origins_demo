# Frontend

React 19 + TypeScript single-page app for managing events and registrations, built with Vite,
React Router, TanStack Query and Tailwind CSS. See the [root README](../README.md) for the full
setup, including running the API.

## Scripts

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server on http://localhost:5173 (expects the API on http://localhost:5080) |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build on http://localhost:4173 |
| `npm test` | Run the unit and component tests once (`npm run test:watch` to watch) |
| `npm run lint` | Lint with oxlint (warnings fail the run) |

## Configuration

| Variable | Used by | Default |
| --- | --- | --- |
| `API_PROXY_TARGET` | `dev`/`preview` proxy for `/api` | `http://localhost:5080` |
| `VITE_API_BASE_URL` | Build: API origin when the app is not served behind the proxy | same origin |

## Layout

```
src/
  api/          fetch client (ApiError, problem details), DTO types, endpoint functions
  queries/      query keys, QueryClient defaults, query and mutation hooks
  components/   ui/ primitives, layout/, events/, registrations/
  pages/        one component per route
  lib/          dates, validation, URL state, form and toast helpers
  test/         Vitest setup, fixtures and render helpers
```
