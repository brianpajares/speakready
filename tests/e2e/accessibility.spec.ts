import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoSeriousA11yViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
  const summary = serious.flatMap((violation) => violation.nodes.map((node) => {
    const contrast = node.any.find((check) => check.id === "color-contrast")?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;
    return { rule: violation.id, target: node.target.join(", "), foreground: contrast?.fgColor, background: contrast?.bgColor, ratio: contrast?.contrastRatio };
  }));
  expect(summary).toEqual([]);
}

test("Spanish home, practice setup, and progress meet serious WCAG 2.1 A/AA checks", async ({ page }) => {
  await page.goto("/es");
  await expectNoSeriousA11yViolations(page);
  await page.locator(".hero .button-primary").click();
  await expectNoSeriousA11yViolations(page);
  await page.getByRole("button", { name: "Mi progreso" }).last().click();
  await expectNoSeriousA11yViolations(page);
});
