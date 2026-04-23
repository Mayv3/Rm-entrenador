# AGENTS

## Repo shape
- This repo is split into two independent Node projects: `frontend/` (Next.js app) and `backend/` (Express API). There is no root `package.json`.
- Install and run commands inside each folder, not from repo root.

## Fast start commands
- Frontend: `cd frontend && npm install && npm run dev` (Next dev server, default port `3000`).
- Backend: `cd backend && npm install && npm run dev` (nodemon `server.js`, default port `3002`).
- Frontend production check: `cd frontend && npm run build`.
- Backend smoke check: `GET /ping` should return `{ ok: true, message: "Pong" }`.

## Verification reality (important)
- There is no test suite configured in either package (`package.json` has no `test` script).
- `frontend/next.config.mjs` disables build blocking for lint/type errors (`eslint.ignoreDuringBuilds` and `typescript.ignoreBuildErrors` are `true`).
- Do not trust `npm run build` alone for correctness; run `cd frontend && npm run lint` and, when touching TS-heavy code, `cd frontend && npx tsc --noEmit`.

## Entrypoints and auth flow
- Frontend app root `frontend/app/page.tsx` redirects to `/portal`.
- Admin flow uses local credentials via `frontend/app/login/page.tsx` -> `POST /api/login` (`frontend/app/api/login/route.ts`) and stores `localStorage.isAuthenticated`.
- Student portal uses NextAuth Google OAuth via `frontend/app/api/auth/[...nextauth]/route.ts`; sign-in page is `/portal/login`.

## Backend architecture notes
- Main API wiring lives in `backend/server.js`; add/modify routes there.
- Data layer is Supabase (`backend/lib/supabase.js`) and controllers under `backend/controllers/`.
- `backend/controllers/planificacionesController.js` uses in-memory cache (`backend/lib/cache.js`). Any mutation affecting planificaciones/ejercicios must invalidate relevant cache keys (`cache.del(...)` / `cache.delByPrefix("plan:")`).

## Environment variables used by runtime
- Frontend requires: `NEXT_PUBLIC_URL_BACKEND`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `LOGIN_USERNAME`, `LOGIN_PASSWORD`.
- Backend requires: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, Google service-account vars used in `server.js` (`GOOGLE_PROJECT_ID`, `GOOGLE_PRIVATE_KEY`, etc.), plus mailing vars (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`) for reminder endpoints.

## Data/ops scripts
- One-off data scripts live in `backend/scripts/` and are run directly with Node (examples inside file headers):
  - `node backend/scripts/seedBaseTotal.js`
  - `node backend/scripts/seedBaseMov.js`
  - `node backend/scripts/migrateMovilidadImages.js`
  - `node backend/scripts/fix-ultima-antro.js`
