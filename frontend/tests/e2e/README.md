# Tests E2E — Portal alumno (Playwright)

## Setup

```bash
cd frontend
npm install
npx playwright install chromium
```

## Correr

```bash
# headless
npm run test:e2e

# UI mode (recomendado para debug)
npm run test:e2e:ui

# headed
npm run test:e2e:headed

# un solo proyecto
npx playwright test --project=chromium-desktop
npx playwright test --project=chromium-mobile
```

## Cómo funciona

- `playwright.config.ts` levanta `npm run dev` con `NEXT_PUBLIC_URL_BACKEND=http://test-api.local`.
- Tests usan página `/__test__/portal?studentId=1` (gated por `NODE_ENV !== production`).
- Backend mockeado via `page.route("**/test-api.local/**")` en `fixtures/mock-plan.ts`.
- No requiere auth ni backend real. No toca DB.

## Cobertura

- Carga inicial plan / hoja / semanas
- Navegación semana → día → check-in → ejercicios
- Orden por categoría
- Estado salud: lógica excluyente excelente vs otros
- Inputs serie: enteros, decimales (`.` y `,`), clamp min/max, no-numéricos
- Save mutation (autosave 8s) — verifica payload PUT
- Plan vacío, sesión previa, cambio de semana refetch
- Edge cases: negativos, ceros, toggles
