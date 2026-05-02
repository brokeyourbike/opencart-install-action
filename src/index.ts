import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { chromium } from "playwright";
import * as path from "path";

async function run(): Promise<void> {
  try {
    const storeUrl = core.getInput("store-url", { required: true });
    const username = core.getInput("admin-username", { required: true });
    const password = core.getInput("admin-password", { required: true });
    const zipPath = path.resolve(core.getInput("zip-path", { required: true }));

    // Ensure Playwright browsers are installed on the runner
    core.info("⚙️ Installing Chromium dependencies...");
    await exec.exec("npx", [
      "playwright",
      "install",
      "chromium",
      "--with-deps",
    ]);

    core.info(`🚀 Launching browser to install: ${zipPath}`);
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      // 1. Login
      core.info("🔐 Logging into OpenCart admin...");
      await page.goto(`${storeUrl}/admin/`);
      await page.fill("#input-username", username);
      await page.fill("#input-password", password);
      await page.click('button[type="submit"]');
      await page.waitForLoadState("networkidle");

      // 2. Extract Token
      const currentUrl = page.url();
      const tokenMatch = currentUrl.match(/user_token=([^&]+)/);
      if (!tokenMatch)
        throw new Error("Authentication failed: user_token not found in URL.");

      core.info("✅ Authenticated. Navigating to Installer...");
      const installerUrl = `${storeUrl}/admin/index.php?route=marketplace/installer&user_token=${tokenMatch[1]}`;
      await page.goto(installerUrl);

      // 3. Upload File
      core.info("📦 Uploading extension...");
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.click("#button-upload"),
      ]);
      await fileChooser.setFiles(zipPath);

      // 4. Wait for Success
      core.info("⏳ Waiting for OpenCart extraction process...");
      const successAlert = page.locator(".alert-success");
      await successAlert.waitFor({ state: "visible", timeout: 30000 });

      core.info("✅ Extension uploaded and extracted successfully!");
    } finally {
      await browser.close();
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`❌ Action failed: ${error.message}`);
    } else {
      core.setFailed("❌ Action failed with an unknown error");
    }
  }
}

run();
