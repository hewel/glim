import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

type SavedBytesWindow = Window & { __glimSavedBytes?: number };

test("boots the Vite client and connects through the backend WebSocket", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Local Mesh")).toBeVisible();
  await expect(page.locator("body")).toContainText(
    /Discovery Active|Mesh Online|Connecting|Reconnecting/,
  );
});

test("transfers a single file over the WebSocket relay", async ({ browser }) => {
  const aliceContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const bobContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  await seedIdentity(alice, "alice-device", "Alice Laptop");
  await seedIdentity(bob, "bob-device", "Bob Laptop");
  await mockSavePicker(bob);

  await alice.goto("/");
  await bob.goto("/");

  await expect(alice.getByText("Bob Laptop")).toBeVisible({ timeout: 10_000 });
  await expect(bob.getByText("Alice Laptop")).toBeVisible({ timeout: 10_000 });

  await alice.getByText("Bob Laptop").click();
  await bob.getByText("Alice Laptop").click();

  const chooserPromise = alice.waitForEvent("filechooser");
  await alice.getByLabel("Attach file").click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "relay-transfer.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("hello relay"),
  });

  const bobTransfer = bob.getByLabel("Transfer relay-transfer.bin");
  await expect(bobTransfer).toBeVisible({ timeout: 10_000 });
  await bobTransfer.getByRole("button", { name: "Accept" }).click();

  await expect(bobTransfer.getByText("Completed")).toBeVisible({ timeout: 30_000 });
  await expect(bobTransfer.getByText("11 B / 11 B · Complete", { exact: true })).toBeVisible({ timeout: 30_000 });

  const aliceTransfer = alice.getByLabel("Transfer relay-transfer.bin");
  await expect(aliceTransfer.getByText("Completed")).toBeVisible({ timeout: 30_000 });

  await expect.poll(() => bob.evaluate(() => (window as SavedBytesWindow).__glimSavedBytes))
    .toBe(11);

  await aliceContext.close();
  await bobContext.close();
});

test("shows another tab from the same browser profile as a peer", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const alice = await context.newPage();
  const bob = await context.newPage();

  await seedIdentity(alice, "shared-device", "Alice Tab");
  await alice.goto("/");
  await expect(alice.locator("body")).toContainText(
    /Discovery Active|Mesh Online|Connecting|Reconnecting/,
  );

  await bob.goto("/");
  await bob.evaluate(() => {
    localStorage.setItem("glim.display_name", "Bob Tab");
  });
  await bob.reload();

  await expect(alice.getByText("Bob Tab")).toBeVisible({ timeout: 10_000 });
  await expect(bob.getByText("Alice Tab")).toBeVisible({ timeout: 10_000 });

  await context.close();
});

async function seedIdentity(page: Page, deviceId: string, name: string) {
  await page.addInitScript(
    ({ deviceId, name }) => {
      Object.defineProperty(window, "showOpenFilePicker", {
        configurable: true,
        value: undefined,
      });
      localStorage.setItem("glim.device_id", deviceId);
      localStorage.setItem("glim.display_name", name);
    },
    { deviceId, name },
  );
}

async function mockSavePicker(page: Page) {
  await page.addInitScript(() => {
    (window as SavedBytesWindow).__glimSavedBytes = 0;
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: async () => ({
        createWritable: async () => ({
          write: async (chunk: Uint8Array) => {
            (window as SavedBytesWindow).__glimSavedBytes =
              ((window as SavedBytesWindow).__glimSavedBytes ?? 0) + chunk.byteLength;
          },
          close: async () => undefined,
        }),
      }),
    });
  });
}
