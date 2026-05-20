import { test, expect, Page, BrowserContext } from "@playwright/test"
import { setupMockApi, PORTAL_URL } from "./fixtures/mock-plan"

// Scroll-restore behavior when alumno uses the app as installed PWA on mobile.
// Reproduces: open day → scroll to last ejercicios → lock screen / switch app → return.
// Must land back at same scrollY, not at top.

const PIXEL_VIEWPORT = { width: 412, height: 915 }

async function setMobileViewport(page: Page) {
  await page.setViewportSize(PIXEL_VIEWPORT)
}

async function gotoLongDay(page: Page) {
  await setupMockApi(page, { extraEjercicios: 12 })
  await page.goto(PORTAL_URL)
  await expect(page.getByText("Plan Test")).toBeVisible()
  await page.getByRole("button", { name: /Semana\s+1/i }).click()
  await expect(page.getByText("Elegí un día")).toBeVisible()
  await page.getByRole("button", { name: /Día\s+1/i }).click()
  await expect(page.getByText("¿Cómo estás hoy?")).toBeVisible()
  await page.getByRole("button", { name: /¡Estoy excelente!/ }).click()
  await expect(page.getByText("Press plano barra")).toBeVisible()
  // Wait for late-mounted extras
  await expect(page.getByText("Ejercicio extra 12")).toBeVisible()
}

async function getScrollY(page: Page): Promise<number> {
  return await page.evaluate(() => window.scrollY)
}

async function simulateBackgroundCycle(page: Page, context: BrowserContext) {
  // Tab-hidden visibilitychange: closest emulation in headless without real PWA install.
  // Fire visibility:hidden + pagehide → small delay → visibility:visible (focus regained).
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })
    document.dispatchEvent(new Event("visibilitychange"))
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }))
  })
  await page.waitForTimeout(150)
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" })
    document.dispatchEvent(new Event("visibilitychange"))
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))
  })
}

test.describe("Portal alumno - scroll restore (PWA mobile)", () => {
  test.use({ viewport: PIXEL_VIEWPORT })

  test("scrollRestoration set to manual when day view active", async ({ page }) => {
    await gotoLongDay(page)
    const mode = await page.evaluate(() => history.scrollRestoration)
    expect(mode).toBe("manual")
  })

  test("window.scrollY persists across visibility hidden/visible cycle", async ({ page, context }) => {
    await gotoLongDay(page)

    // Scroll down to a deep ejercicio
    const deep = page.getByText("Ejercicio extra 10")
    await deep.scrollIntoViewIfNeeded()
    // Let throttled rAF save fire
    await page.waitForTimeout(50)
    const before = await getScrollY(page)
    expect(before).toBeGreaterThan(300)

    // Verify sessionStorage actually stored the position
    const stored = await page.evaluate(() => {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)!
        if (k.endsWith("-scrollY")) return Number(sessionStorage.getItem(k))
      }
      return null
    })
    expect(stored).not.toBeNull()
    expect(Math.abs((stored ?? 0) - before)).toBeLessThanOrEqual(2)

    await simulateBackgroundCycle(page, context)

    // Should NOT have jumped to top. Allow tiny rAF drift.
    const after = await getScrollY(page)
    expect(Math.abs(after - before)).toBeLessThanOrEqual(5)
  })

  test("scrollY survives full page reload via sessionStorage", async ({ page }) => {
    await gotoLongDay(page)
    const deep = page.getByText("Ejercicio extra 8")
    await deep.scrollIntoViewIfNeeded()
    await page.waitForTimeout(50)
    const before = await getScrollY(page)
    expect(before).toBeGreaterThan(300)

    // Re-mount entire app (same tab → sessionStorage preserved).
    // Need to navigate back through week/day picker because state resets.
    await page.reload()
    await expect(page.getByText("Plan Test")).toBeVisible()
    await page.getByRole("button", { name: /Semana\s+1/i }).click()
    await page.getByRole("button", { name: /Día\s+1/i }).click()
    // No check-in this time — already shown via estado_diario, or pass through
    const checkinBtn = page.getByRole("button", { name: /¡Estoy excelente!/ })
    if (await checkinBtn.isVisible().catch(() => false)) await checkinBtn.click()
    await expect(page.getByText("Ejercicio extra 8")).toBeVisible()

    // Restore should fire after registrosForm rebuild (double rAF)
    await page.waitForTimeout(200)
    const after = await getScrollY(page)
    expect(Math.abs(after - before)).toBeLessThanOrEqual(30)
  })

  test("refetchOnWindowFocus disabled — no plan refetch on visibility return", async ({ page }) => {
    await setupMockApi(page, { extraEjercicios: 12 })

    // Counter route registered AFTER setupMockApi so it runs FIRST (Playwright route order is LIFO).
    // It counts then falls through to the mock handler.
    let planFetchCount = 0
    await page.route("**/test-api.local/**/planificacion", async (route) => {
      planFetchCount++
      await route.fallback()
    })

    await page.goto(PORTAL_URL)
    await expect(page.getByText("Plan Test")).toBeVisible()
    await page.getByRole("button", { name: /Semana\s+1/i }).click()
    await page.getByRole("button", { name: /Día\s+1/i }).click()
    await page.getByRole("button", { name: /¡Estoy excelente!/ }).click()
    await expect(page.getByText("Ejercicio extra 12")).toBeVisible()

    const baseline = planFetchCount

    // Fire visibility cycle multiple times — should NOT trigger refetch
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })
        document.dispatchEvent(new Event("visibilitychange"))
      })
      await page.waitForTimeout(50)
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" })
        document.dispatchEvent(new Event("visibilitychange"))
      })
      await page.waitForTimeout(50)
    }

    expect(planFetchCount).toBe(baseline)
  })

  test("re-abrir día tras kill de sesión salta al penúltimo ejercicio en serie 3 incompleta", async ({ page }) => {
    test.setTimeout(90_000)
    // Fixture IDs: 401 Press plano (A), 402 Remo (B), 403 Press inclinado (C),
    // 500 Extra 1 (C), 501 Extra 2 (D). Penúltimo = id 500, último = id 501.
    const EJ_PRESS = 401, EJ_REMO = 402, EJ_INCL = 403, EJ_PENULT = 500, EJ_ULT = 501

    const ctx = await setupMockApi(page, { extraEjercicios: 2 })
    await page.goto(PORTAL_URL)
    await expect(page.getByText("Plan Test")).toBeVisible()
    await page.getByRole("button", { name: /Semana\s+1/i }).click()
    await page.getByRole("button", { name: /Día\s+1/i }).click()
    await page.getByRole("button", { name: /¡Estoy excelente!/ }).click()
    await expect(page.locator(`[data-ej-id="${EJ_ULT}"]`)).toBeVisible()

    function card(ejId: number) {
      return page.locator(`[data-ej-id="${ejId}"]`)
    }
    async function fillSerie(ejId: number, serieIdx: number, peso: string, reps: string, rpe: string) {
      const inputs = card(ejId).locator('input[placeholder="0"]')
      await inputs.nth(serieIdx * 3).fill(peso)
      await inputs.nth(serieIdx * 3 + 1).fill(reps)
      await inputs.nth(serieIdx * 3 + 2).fill(rpe)
    }

    // Llenar series 0,1,2 de los 3 primeros ejs
    for (const id of [EJ_PRESS, EJ_REMO, EJ_INCL]) {
      await fillSerie(id, 0, "60", "8", "7")
      await fillSerie(id, 1, "60", "8", "7")
      await fillSerie(id, 2, "60", "8", "7")
    }
    // Penúltimo (500): series 0 y 1 sólo
    await fillSerie(EJ_PENULT, 0, "40", "10", "7")
    await fillSerie(EJ_PENULT, 1, "40", "10", "7")
    // Último (501): vacío

    // handleSerieChange dispara PUTs por cada serie completada (autosave inmediato).
    // Mock mergea sessionState por ejId. Esperar hasta tener 4 ejs en estado cumulativo.
    await expect.poll(() => {
      const state = ctx.sessionState.get(`1-301`)
      return (state?.registros ?? []).length
    }, { timeout: 8000, intervals: [100, 200, 400] }).toBeGreaterThanOrEqual(4)

    // Forzar último save: visibilitychange hidden dispara saveMutate si quedó algo dirty.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" })
      document.dispatchEvent(new Event("visibilitychange"))
    })

    // Verificar estado guardado: Extra 1 con series[2] vacía/null.
    const state = ctx.sessionState.get(`1-301`)
    const extra1Reg = state!.registros.find((r: any) => r.planificacion_ejercicio_id === EJ_PENULT)
    expect(extra1Reg).toBeDefined()
    expect(extra1Reg.series[0].peso_kg).toBe(40)
    expect(extra1Reg.series[1].peso_kg).toBe(40)
    expect(extra1Reg.series[2].peso_kg).toBeNull()

    // Simular "app cerrada / nuevo día": reload + clear sessionStorage POST-reload
    // (pagehide handler salva scrollY al cerrar; debe limpiarse despues del reload).
    await page.reload()
    await expect(page.getByText("Plan Test")).toBeVisible()
    await page.evaluate(() => sessionStorage.clear())
    await page.getByRole("button", { name: /Semana\s+1/i }).click()
    await page.getByRole("button", { name: /Día\s+1/i }).click()
    // Check-in cargado por estado_diario del PUT previo → panel no aparece
    await expect(card(EJ_PENULT)).toBeVisible()

    // Assert 1: tarjeta penúltima cerca del top del viewport (auto-scroll block:"start")
    await expect(card(EJ_PENULT)).toBeInViewport({ ratio: 0.5, timeout: 5000 })
    await expect.poll(async () => {
      const box = await card(EJ_PENULT).boundingBox()
      return box?.y ?? -9999
    }, { timeout: 5000, intervals: [100, 200, 400] }).toBeLessThan(120)

    // Assert 2: pill "Serie 3" del penúltimo activa → activeSerieMap[500] === 2
    const serie3Pill = card(EJ_PENULT).getByRole("button", { name: /Serie 3/ })
    await expect(serie3Pill).toHaveClass(/scale-\[1\.03\]/, { timeout: 5000 })

    // Assert 3: pills Serie 1 y 2 con datos persistidos (bg verde "filled")
    const serie1Pill = card(EJ_PENULT).getByRole("button", { name: /Serie 1/ })
    await expect(serie1Pill).toHaveClass(/bg-green-500\/15/)
    const serie2Pill = card(EJ_PENULT).getByRole("button", { name: /Serie 2/ })
    await expect(serie2Pill).toHaveClass(/bg-green-500\/15/)

    // Assert 4: horizontal scroll del penúltimo posicionado en serie 3 (idx 2)
    await expect.poll(async () => {
      return await card(EJ_PENULT).evaluate((root) => {
        const scroller = root.querySelector('.snap-x') as HTMLElement | null
        if (!scroller) return -1
        const w = scroller.clientWidth
        if (w === 0) return -2
        return Math.round(scroller.scrollLeft / w)
      })
    }, { timeout: 5000, intervals: [100, 200, 400] }).toBe(2)
  })

test("scrollY listener cleaned up when leaving day view (back to weeks)", async ({ page }) => {
    await gotoLongDay(page)
    const deep = page.getByText("Ejercicio extra 5")
    await deep.scrollIntoViewIfNeeded()
    await page.waitForTimeout(50)

    // Navigate back
    await page.goBack()
    await expect(page.getByText("Elegí un día")).toBeVisible()

    // history.scrollRestoration must be restored to "auto" by cleanup
    const mode = await page.evaluate(() => history.scrollRestoration)
    expect(mode).toBe("auto")
  })
})
