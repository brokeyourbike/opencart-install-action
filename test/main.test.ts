import pwPkg from "playwright/package.json";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { run } from "../src/main";

// 1. Mock GitHub Actions packages
vi.mock("@actions/core");
vi.mock("@actions/exec");

// 2. Use vi.hoisted() so these variables exist BEFORE vi.mock runs
const mocks = vi.hoisted(() => {
  return {
    mockGoto: vi.fn(),
    mockFill: vi.fn(),
    mockClick: vi.fn(),
    mockUrl: vi
      .fn()
      .mockReturnValue(
        "http://localhost/admin/index.php?route=common/dashboard&user_token=valid_token_123",
      ),
    mockClose: vi.fn(),
  };
});

// 3. Now we can safely use the hoisted variables inside vi.mock
vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: mocks.mockGoto,
        fill: mocks.mockFill,
        click: mocks.mockClick,
        url: mocks.mockUrl,
        waitForLoadState: vi.fn(),
        waitForEvent: vi.fn().mockResolvedValue({ setFiles: vi.fn() }),
        locator: vi.fn().mockReturnValue({
          waitFor: vi.fn(),
          first: vi
            .fn()
            .mockReturnValue({ waitFor: vi.fn(), click: mocks.mockClick }),
        }),
        waitForResponse: vi.fn(),
      }),
      close: mocks.mockClose,
    }),
  },
}));

describe("OpenCart Installer Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Provide default valid inputs for tests
    vi.mocked(core.getInput).mockImplementation((name) => {
      switch (name) {
        case "store-url":
          return "http://localhost:8080";
        case "admin-username":
          return "admin";
        case "admin-password":
          return "admin_pass";
        case "zip-path":
          return "./dummy.ocmod.zip";
        default:
          return "";
      }
    });
  });

  it("should successfully run using system Chrome", async () => {
    await run();

    expect(exec.exec).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith(
      "✅ Extension uploaded and extracted successfully!",
    );
    expect(mocks.mockClose).toHaveBeenCalled();
  });

  it("should fallback to installing Chromium if system Chrome is missing", async () => {
    // 1. Force the first launch({ channel: 'chrome' }) to fail
    const { chromium } = await import("playwright");
    vi.mocked(chromium.launch)
      .mockRejectedValueOnce(new Error("Executable doesn't exist")) // Fails first attempt
      .mockResolvedValueOnce({
        // Succeeds second attempt
        newPage: vi.fn().mockResolvedValue({
          goto: mocks.mockGoto,
          fill: mocks.mockFill,
          click: mocks.mockClick,
          url: mocks.mockUrl,
          waitForLoadState: vi.fn(),
          waitForEvent: vi.fn().mockResolvedValue({ setFiles: vi.fn() }),
          locator: vi.fn().mockReturnValue({
            waitFor: vi.fn(),
            first: vi
              .fn()
              .mockReturnValue({ waitFor: vi.fn(), click: mocks.mockClick }),
          }),
          waitForResponse: vi
            .fn()
            .mockResolvedValue({ json: vi.fn().mockResolvedValue({}) }),
        }),
        close: mocks.mockClose,
      } as any);

    await run();

    // 2. Verify it triggered the fallback installation
    expect(exec.exec).toHaveBeenCalledWith("npx", [
      "-y",
      `playwright@${pwPkg.version}`,
      "install",
      "chromium",
      "--with-deps",
    ]);
    expect(core.info).toHaveBeenCalledWith(
      "✅ Extension uploaded and extracted successfully!",
    );
  });

  it("should fail if authentication token is missing from URL", async () => {
    // Simulate a failed login by returning a URL without a user_token
    mocks.mockUrl.mockReturnValueOnce(
      "http://localhost:8080/admin/index.php?route=common/login",
    );

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      "❌ Action failed: Authentication failed: user_token not found in URL.",
    );
  });
});
