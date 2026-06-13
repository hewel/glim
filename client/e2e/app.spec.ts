import { expect, test } from "@playwright/test";

test("boots the Vite client and connects through the backend WebSocket", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Local Mesh")).toBeVisible();
  await expect(page.locator("body")).toContainText(
    /Discovery Active|Mesh Online|Connecting|Reconnecting/,
  );
});

test("transfers a single file over P2P and reaches export completion", async ({ browser }) => {
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
    name: "p2p-transfer.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("hello p2p"),
  });

  const bobTransfer = bob.getByLabel("Transfer p2p-transfer.bin");
  await expect(bobTransfer).toBeVisible({ timeout: 10_000 });
  await bobTransfer.getByRole("button", { name: "Accept" }).click();

  await expect(bobTransfer.getByText("Export ready")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => resumeSnapshot(bob), { timeout: 10_000 }).toEqual({
    completedPieces: 1,
    partBytes: 9,
  });

  await bobTransfer.getByRole("button", { name: "Save" }).click();

  await expect(bobTransfer.getByText("Completed")).toBeVisible({ timeout: 10_000 });
  await expect(bobTransfer.getByText("Saved")).toBeVisible({ timeout: 10_000 });

  await aliceContext.close();
  await bobContext.close();
});

test("preserves verified OPFS data after receiver reload", async ({ browser }) => {
  const aliceContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const bobContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  await seedIdentity(alice, "alice-reload-device", "Alice Reload Laptop");
  await seedIdentity(bob, "bob-reload-device", "Bob Reload Laptop");
  await mockSavePicker(bob);

  await alice.goto("/");
  await bob.goto("/");

  await expect(alice.getByText("Bob Reload Laptop")).toBeVisible({ timeout: 10_000 });
  await expect(bob.getByText("Alice Reload Laptop")).toBeVisible({ timeout: 10_000 });

  await alice.getByText("Bob Reload Laptop").click();
  await bob.getByText("Alice Reload Laptop").click();

  const chooserPromise = alice.waitForEvent("filechooser");
  await alice.getByLabel("Attach file").click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "reload-transfer.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("hello p2p"),
  });

  const bobTransfer = bob.getByLabel("Transfer reload-transfer.bin");
  await expect(bobTransfer).toBeVisible({ timeout: 10_000 });
  await bobTransfer.getByRole("button", { name: "Accept" }).click();

  await expect(bobTransfer.getByText("Export ready")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => resumeSnapshot(bob), { timeout: 10_000 }).toEqual({
    completedPieces: 1,
    partBytes: 9,
  });

  await bob.reload();

  await expect.poll(() => resumeSnapshot(bob), { timeout: 10_000 }).toEqual({
    completedPieces: 1,
    partBytes: 9,
  });

  await aliceContext.close();
  await bobContext.close();
});

async function seedIdentity(page: import("@playwright/test").Page, deviceId: string, name: string) {
  await page.addInitScript(
    ({ deviceId, name }) => {
      localStorage.setItem("glim.device_id", deviceId);
      localStorage.setItem("glim.display_name", name);
    },
    { deviceId, name },
  );
}

async function mockSavePicker(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: async () => ({
        createWritable: async () => ({
          write: async () => undefined,
          close: async () => undefined,
        }),
      }),
    });
  });
}

async function resumeSnapshot(page: import("@playwright/test").Page): Promise<{
  completedPieces: number;
  partBytes: number;
}> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const transfers = await root.getDirectoryHandle("transfers");
    const transferEntries = (transfers as unknown as {
      entries(): AsyncIterable<[string, FileSystemDirectoryHandle]>;
    }).entries();

    for await (const [, transfer] of transferEntries) {
      const resumeFile = await transfer.getFileHandle("resume.json");
      const resume = JSON.parse(await resumeFile.getFile().then((blob) => blob.text())) as {
        transfer_id: string;
        files: Record<string, { completedPieces: number[] }>;
      };
      const firstFile = Object.values(resume.files)[0];
      const files = await transfer.getDirectoryHandle("files");
      const part = await files.getFileHandle(`${resume.transfer_id}.part`);
      const partBytes = await part.getFile().then((blob) => blob.size);
      if (firstFile && partBytes > 0) {
        return {
          completedPieces: firstFile.completedPieces.length,
          partBytes,
        };
      }
    }

    return {
      completedPieces: 0,
      partBytes: 0,
    };
  });
}
