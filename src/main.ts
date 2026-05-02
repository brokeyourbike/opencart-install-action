import * as path from "path";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { chromium } from "playwright";
import pwPkg from "playwright/package.json";

export async function run(): Promise<void> {
  try {
    const storeUrl = core.getInput("store-url", { required: true });
    const username = core.getInput("admin-username", { required: true });
    const password = core.getInput("admin-password", { required: true });
    const zipPath = path.resolve(core.getInput("zip-path", { required: true }));

    let browser;
    try {
      core.info(`🚀 Attempting to launch pre-installed system Chrome...`);
      browser = await chromium.launch({ channel: "chrome" });
    } catch (error) {
      core.info(
        `⚠️ System Chrome not found. Falling back to Playwright Chromium (v${pwPkg.version})...`,
      );
      await exec.exec("npx", [
        "-y",
        `playwright@${pwPkg.version}`,
        "install",
        "chromium",
        "--with-deps",
      ]);
      browser = await chromium.launch();
    }

    core.info(`🚀 Browser launched! Installing: ${zipPath}`);
    const page = await browser.newPage();

    try {
      // Login
      core.info("🔐 Logging into OpenCart admin...");
      await page.goto(`${storeUrl}/admin/`);
      await page.fill("#input-username", username);
      await page.fill("#input-password", password);
      await page.click('button[type="submit"]');
      await page.waitForLoadState("networkidle");

      // Extract Token
      const currentUrl = page.url();
      const tokenMatch = currentUrl.match(/user_token=([^&]+)/);
      if (!tokenMatch)
        throw new Error("Authentication failed: user_token not found in URL.");

      core.info("✅ Authenticated. Navigating to Installer...");
      const installerUrl = `${storeUrl}/admin/index.php?route=marketplace/installer&user_token=${tokenMatch[1]}`;
      await page.goto(installerUrl);

      // Upload File
      core.info("📦 Uploading extension...");
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.click("#button-upload"),
      ]);
      await fileChooser.setFiles(zipPath);

      // Wait for Success
      core.info("⏳ Waiting for upload to finish...");
      const successAlert = page.locator(".alert-success");
      await successAlert.waitFor({ state: "visible", timeout: 30000 });

      // Finds the green '+' button in the extension list
      core.info("⚙️ Triggering extraction...");
      const installButton = page.locator("#extension .btn-success").first();
      await installButton.waitFor({ state: "visible" });

      const [response] = await Promise.all([
        page.waitForResponse(
          (res) => res.url().match(/installer[|.]install/) !== null,
        ),
        installButton.click(),
      ]);

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
