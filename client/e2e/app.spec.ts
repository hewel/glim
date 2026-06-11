import { expect, test } from "@playwright/test";

test("boots the Vite client and connects through the backend WebSocket", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Local Mesh")).toBeVisible();
  await expect(page.locator("body")).toContainText(
    /Discovery Active|Mesh Online|Connecting|Reconnecting/,
  );
});
