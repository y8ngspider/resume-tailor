import { expect, test } from "@playwright/test";

test("sample resume can be analyzed, tailored, and exported", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the full demo" }).click();
  await page.getByRole("button", { name: /Find the strongest match/ }).click();
  await expect(page.getByRole("heading", { name: "Choose what deserves emphasis." })).toBeVisible();
  await page.getByRole("button", { name: /Build my tailored resume/ }).click();
  await expect(page.getByRole("heading", { name: /Your evidence, aimed at/ })).toBeVisible();
  await page.getByRole("tab", { name: "LaTeX output" }).click();
  await expect(page.getByText("main.tex")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download .tex" }).first()).toBeEnabled();
});
