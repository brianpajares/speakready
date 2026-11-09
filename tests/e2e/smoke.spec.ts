import { expect, test } from "@playwright/test";

test("home, practice setup, and local privacy gate are usable", async ({ page }) => {
  await page.goto("/es");
  await expect(page.getByRole("heading", { name: "Tu próxima oportunidad empieza por tu voz." })).toBeVisible();
  await page.locator(".hero .button-primary").click();
  await expect(page.getByText("Tu voz se queda en tu dispositivo")).toBeVisible();

  const recordButton = page.getByRole("button", { name: "Grabar respuesta" });
  await expect(recordButton).toBeDisabled();
  await page.getByLabel("Acepto grabar mi voz en este dispositivo para esta sesión.").check();
  await page.getByLabel("Confirmo que tengo 18 años o más.").check();
  await expect(recordButton).toBeEnabled();
  await page.context().grantPermissions(["microphone"]);
  await recordButton.click();
  await expect(page.getByRole("heading", { name: "Grabando en este dispositivo" })).toBeVisible();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Terminar grabación" }).last().click();
  await expect(page.getByRole("heading", { name: "Tu transcripción" })).toBeVisible();
  await page.getByLabel("Tu transcripción").fill("I enjoy solving complex problems because I can help my team move forward.");
  await page.getByRole("button", { name: "Ver mi análisis" }).click();
  await expect(page.getByText("Fluidez estimada")).toBeVisible();

  await page.getByRole("button", { name: "Mi progreso" }).last().click();
  await expect(page.getByRole("heading", { name: "Vas construyendo confianza." })).toBeVisible();
  await expect(page.locator(".progress-side-stat").first()).toContainText("1/2");
  await expect(page.locator(".empty-chart")).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 800 });
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(360);
});
