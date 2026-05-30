import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end tests for the WhatsApp share/send flow.
 *
 * Strategy:
 *   • The dev-only harness at /__test/whatsapp renders two buttons that call
 *     the real `openWhatsApp` + message builders with fixed fixture data.
 *   • On desktop the helper calls `window.open(..., '_blank', 'noopener,noreferrer')`
 *     → Playwright sees a new `page` event on the context.
 *   • On mobile (iPhone Safari emulation) the helper assigns the wa.me URL
 *     to `window.location.href` → the current page navigates. We intercept
 *     the wa.me request with `context.route` and abort it before it actually
 *     leaves our origin, so the assertions can read the URL deterministically.
 *
 * Run:  bunx playwright test
 */

const HARNESS = "/__test/whatsapp";

// Mirrors src/pages/__TestWhatsApp.tsx FIXTURE — kept in sync by hand because
// importing app code into Playwright specs would require module aliasing.
const FIXTURE = {
  phoneDigits: "919876543210",
  invoiceNumber: "INV-2026-0001",
  patientName: "Krish Sekar",
  clinicName: "Acme Clinic",
};

/** Stub wa.me so the browser doesn't actually try to load WhatsApp. */
async function stubWaMe(page: Page) {
  const captured: { url: string | null } = { url: null };
  await page.context().route("https://wa.me/**", async (route) => {
    captured.url = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>wa.me stub</body></html>",
    });
  });
  return captured;
}

function assertSharedInvoiceUrl(url: string) {
  expect(url).toMatch(new RegExp(`^https://wa\\.me/${FIXTURE.phoneDigits}\\?text=`));
  const text = new URL(url).searchParams.get("text") || "";
  expect(text).toContain(FIXTURE.patientName);
  expect(text).toContain(FIXTURE.invoiceNumber);
  expect(text).toContain(FIXTURE.clinicName);
  expect(text).toContain("₹300");
  expect(text).toContain("PAID ✅");
  expect(text).toContain(
    "/invoice/11111111-1111-1111-1111-111111111111",
  );
}

function assertReceiptUrl(url: string) {
  expect(url).toMatch(new RegExp(`^https://wa\\.me/${FIXTURE.phoneDigits}\\?text=`));
  const text = new URL(url).searchParams.get("text") || "";
  expect(text).toContain("✅ Payment received at Acme Clinic");
  expect(text).toContain("Amount Paid: ₹100 (UPI)");
  expect(text).toContain("Total Bill: ₹300");
  expect(text).toContain("Outstanding: ₹200");
}

test.describe("WhatsApp share — desktop Chromium", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Desktop-only behavior — uses window.open + new tab",
  );

  test("Share Invoice opens wa.me in a new tab with correct URL & message", async ({
    page,
    context,
  }) => {
    const captured = await stubWaMe(page);

    await page.goto(HARNESS);
    await expect(page.getByTestId("share-invoice")).toBeVisible();

    // window.open(..., '_blank', ...) emits a 'page' event on the context.
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByTestId("share-invoice").click(),
    ]);

    await popup.waitForLoadState("domcontentloaded").catch(() => {});
    const popupUrl = popup.url();

    // The current page must NOT have navigated away (Safari COOP regression guard).
    expect(page.url()).toContain(HARNESS);

    // Either the popup's own URL or the intercepted request URL must be wa.me.
    const url = captured.url ?? popupUrl;
    assertSharedInvoiceUrl(url);

    await popup.close().catch(() => {});
  });

  test("Send Receipt opens wa.me in a new tab with receipt message", async ({
    page,
    context,
  }) => {
    const captured = await stubWaMe(page);

    await page.goto(HARNESS);

    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByTestId("send-receipt").click(),
    ]);

    await popup.waitForLoadState("domcontentloaded").catch(() => {});
    expect(page.url()).toContain(HARNESS);

    const url = captured.url ?? popup.url();
    assertReceiptUrl(url);

    await popup.close().catch(() => {});
  });
});

test.describe("WhatsApp share — iPhone Safari (WebKit)", () => {
  test.skip(
    ({ browserName }) => browserName !== "webkit",
    "Mobile-only behavior — uses location.href same-tab navigation",
  );

  test("Share Invoice navigates current tab to wa.me deep link", async ({ page }) => {
    const captured = await stubWaMe(page);

    await page.goto(HARNESS);

    // UA sanity check — must match the iPhone regex used inside openWhatsApp.
    const ua = await page.evaluate(() => navigator.userAgent);
    expect(ua).toMatch(/iPhone|iPad|iPod/);

    // Same-tab navigation → wait for the wa.me request on this page.
    await Promise.all([
      page.waitForURL(/wa\.me/, { timeout: 5000 }),
      page.getByTestId("share-invoice").click(),
    ]);

    expect(captured.url).not.toBeNull();
    assertSharedInvoiceUrl(captured.url!);
  });

  test("Send Receipt navigates current tab to wa.me with receipt", async ({ page }) => {
    const captured = await stubWaMe(page);

    await page.goto(HARNESS);

    await Promise.all([
      page.waitForURL(/wa\.me/, { timeout: 5000 }),
      page.getByTestId("send-receipt").click(),
    ]);

    expect(captured.url).not.toBeNull();
    assertReceiptUrl(captured.url!);
  });
});

test.describe("WhatsApp share — encoding (cross-browser)", () => {
  test("wa.me text param round-trips ₹, ✅, newlines, and reserved chars", async ({
    page,
  }) => {
    const captured = await stubWaMe(page);
    await page.goto(HARNESS);

    const isMobile = await page.evaluate(() =>
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    );

    if (isMobile) {
      await Promise.all([
        page.waitForURL(/wa\.me/, { timeout: 5000 }),
        page.getByTestId("share-invoice").click(),
      ]);
    } else {
      const [popup] = await Promise.all([
        page.context().waitForEvent("page"),
        page.getByTestId("share-invoice").click(),
      ]);
      await popup.close().catch(() => {});
    }

    expect(captured.url).not.toBeNull();
    const url = captured.url!;

    // Encoded payload checks — these are the chars Safari is most likely to
    // mangle if encoding is wrong.
    expect(url).toContain("%E2%82%B9"); // ₹
    expect(url).toContain("%E2%9C%85"); // ✅
    expect(url).toContain("%0A"); // newline

    // Round-trip back to the original message text.
    const text = new URL(url).searchParams.get("text") || "";
    expect(text).toContain("Dear Krish Sekar");
    expect(text).toContain("\n"); // real newline after decode
  });
});