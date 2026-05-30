import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  openWhatsApp,
  buildInvoiceMessage,
  buildPaymentReceiptMessage,
} from "./whatsapp";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const UA_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const UA_MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const UA_WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function setUA(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    get: () => ua,
  });
}

/** Spy on window.open and intercept assignments to window.location.href. */
function captureNavigation() {
  const openSpy = vi.fn();
  // Replace window.open
  Object.defineProperty(window, "open", {
    configurable: true,
    writable: true,
    value: openSpy,
  });

  // Replace window.location with a tiny stub whose href setter records calls.
  const hrefSetter = vi.fn();
  const originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...originalLocation,
      origin: "https://app.test",
      set href(v: string) {
        hrefSetter(v);
      },
      get href() {
        return "https://app.test/";
      },
    },
  });

  return { openSpy, hrefSetter };
}

let captures: ReturnType<typeof captureNavigation>;

beforeEach(() => {
  captures = captureNavigation();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// openWhatsApp — desktop vs mobile dispatch
// ---------------------------------------------------------------------------

describe("openWhatsApp — desktop", () => {
  it.each([
    ["macOS Safari", UA_MAC_SAFARI],
    ["Windows Chrome", UA_WINDOWS_CHROME],
  ])("on %s opens wa.me in a new tab (no same-tab navigation)", (_label, ua) => {
    setUA(ua);
    openWhatsApp("+91 98765 43210", "Hello world");

    expect(captures.openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = captures.openSpy.mock.calls[0];
    expect(url).toBe("https://wa.me/919876543210?text=Hello%20world");
    expect(target).toBe("_blank");
    expect(features).toBe("noopener,noreferrer");

    // Critical: must NOT touch location.href on desktop — that would
    // navigate the SPA away and trip Safari's Cross-Origin-Opener-Policy.
    expect(captures.hrefSetter).not.toHaveBeenCalled();
  });
});

describe("openWhatsApp — mobile", () => {
  it.each([
    ["iPhone Safari", UA_IPHONE],
    ["Android Chrome", UA_ANDROID],
  ])("on %s assigns wa.me to location.href (deep link)", (_label, ua) => {
    setUA(ua);
    openWhatsApp("9876543210", "Hi there");

    expect(captures.hrefSetter).toHaveBeenCalledTimes(1);
    expect(captures.hrefSetter).toHaveBeenCalledWith(
      "https://wa.me/9876543210?text=Hi%20there",
    );
    // Critical: no window.open — Safari iOS blocks/loses popups for deep
    // links, so we must use a same-tab navigation.
    expect(captures.openSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// URL + message construction
// ---------------------------------------------------------------------------

describe("openWhatsApp — URL & encoding", () => {
  beforeEach(() => setUA(UA_WINDOWS_CHROME));

  it("strips all non-digits from the phone number", () => {
    openWhatsApp("+91 (987) 654-3210 ext.0", "x");
    const [url] = captures.openSpy.mock.calls[0];
    expect(url).toBe("https://wa.me/919876543210?text=x");
  });

  it("renders an empty phone segment when phone is missing", () => {
    openWhatsApp(null, "x");
    const [url] = captures.openSpy.mock.calls[0];
    expect(url).toBe("https://wa.me/?text=x");
  });

  it("URL-encodes newlines, ₹ symbol, emoji, and reserved chars", () => {
    const msg = "Bill ₹1,200 ✅\nTotal: 50% off & more?";
    openWhatsApp("9876543210", msg);
    const [url] = captures.openSpy.mock.calls[0];

    // The text param must round-trip through decode back to the original.
    const text = new URL(url).searchParams.get("text");
    expect(text).toBe(msg);

    // Defensive checks — these are the chars Safari is most likely to choke on
    // if encoding is wrong.
    expect(url).toContain("%E2%82%B9"); // ₹
    expect(url).toContain("%E2%9C%85"); // ✅
    expect(url).toContain("%0A"); // newline
    expect(url).toContain("%26"); // &
  });

  it("always targets wa.me (universal, Safari-friendly) — never api.whatsapp.com", () => {
    openWhatsApp("9876543210", "x");
    const [url] = captures.openSpy.mock.calls[0];
    expect(url.startsWith("https://wa.me/")).toBe(true);
    expect(url).not.toContain("api.whatsapp.com");
    expect(url).not.toContain("web.whatsapp.com");
  });
});

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

describe("buildInvoiceMessage", () => {
  it("includes patient, invoice number, amount, paid status, and viewer URL", () => {
    const msg = buildInvoiceMessage(
      "Krish Sekar",
      "INV-2026-0001",
      300,
      "paid",
      "11111111-1111-1111-1111-111111111111",
      "Acme Clinic",
    );
    expect(msg).toContain("Dear Krish Sekar");
    expect(msg).toContain("INV-2026-0001");
    expect(msg).toContain("Acme Clinic");
    expect(msg).toContain("₹300");
    expect(msg).toContain("PAID ✅");
    expect(msg).toContain(
      "https://app.test/invoice/11111111-1111-1111-1111-111111111111",
    );
  });

  it("renders PARTIALLY PAID / PENDING status labels", () => {
    const partial = buildInvoiceMessage("A", "INV-1", 100, "partial", "id", "C");
    expect(partial).toContain("PARTIALLY PAID");
    const pending = buildInvoiceMessage("A", "INV-1", 100, "unpaid", "id", "C");
    expect(pending).toContain("PENDING");
  });

  it("formats large amounts with Indian grouping", () => {
    const msg = buildInvoiceMessage("A", "INV-1", 125000, "unpaid", "id", "C");
    expect(msg).toContain("₹1,25,000");
  });

  it("survives encoding into a wa.me URL via openWhatsApp", () => {
    setUA(UA_WINDOWS_CHROME);
    const msg = buildInvoiceMessage("Krish", "INV-2026-0001", 300, "paid", "id", "Acme");
    openWhatsApp("9876543210", msg);
    const [url] = captures.openSpy.mock.calls[0];
    const decoded = new URL(url).searchParams.get("text");
    expect(decoded).toBe(msg);
  });
});

describe("buildPaymentReceiptMessage", () => {
  it("includes method label, paid amount, total, and outstanding when partial", () => {
    const msg = buildPaymentReceiptMessage(
      "Krish", "INV-2026-0001", 100, "upi", 300, 200, "Acme Clinic", "id-1",
    );
    expect(msg).toContain("✅ Payment received at Acme Clinic");
    expect(msg).toContain("Amount Paid: ₹100 (UPI)");
    expect(msg).toContain("Total Bill: ₹300");
    expect(msg).toContain("Outstanding: ₹200");
    expect(msg).not.toContain("Fully Paid");
    expect(msg).toContain("https://app.test/invoice/id-1");
  });

  it("shows 'Fully Paid ✅' when outstanding is zero", () => {
    const msg = buildPaymentReceiptMessage(
      "Krish", "INV-2026-0001", 300, "cash", 300, 0, "Acme Clinic", "id-1",
    );
    expect(msg).toContain("Amount Paid: ₹300 (Cash)");
    expect(msg).toContain("Balance: Fully Paid ✅");
    expect(msg).not.toContain("Outstanding:");
  });

  it.each([
    ["cash", "Cash"],
    ["upi", "UPI"],
    ["card", "Card"],
    ["insurance", "Insurance"],
    ["other", "Other"],
  ])("maps payment method %s → %s label", (method, label) => {
    const msg = buildPaymentReceiptMessage(
      "P", "INV-1", 50, method, 100, 50, "C", "id",
    );
    expect(msg).toContain(`(${label})`);
  });

  it("falls back to raw method when unknown", () => {
    const msg = buildPaymentReceiptMessage(
      "P", "INV-1", 50, "bitcoin", 100, 50, "C", "id",
    );
    expect(msg).toContain("(bitcoin)");
  });
});

// ---------------------------------------------------------------------------
// End-to-end click simulation: button → openWhatsApp → wa.me URL
// ---------------------------------------------------------------------------

describe("Share button click → wa.me dispatch", () => {
  it("desktop: click opens wa.me in a new tab with the correct message", () => {
    setUA(UA_WINDOWS_CHROME);

    const btn = document.createElement("button");
    btn.textContent = "Share";
    btn.addEventListener("click", () => {
      openWhatsApp(
        "+91 98765 43210",
        buildInvoiceMessage("Krish", "INV-2026-0001", 300, "paid", "abc", "Acme"),
      );
    });
    document.body.appendChild(btn);
    btn.click();

    expect(captures.openSpy).toHaveBeenCalledTimes(1);
    const [url, target] = captures.openSpy.mock.calls[0];
    expect(url).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
    expect(target).toBe("_blank");
    expect(captures.hrefSetter).not.toHaveBeenCalled();

    const decoded = new URL(url).searchParams.get("text") || "";
    expect(decoded).toContain("INV-2026-0001");
    expect(decoded).toContain("₹300");
    expect(decoded).toContain("PAID ✅");

    btn.remove();
  });

  it("mobile iPhone (Safari): click navigates same tab to wa.me deep link", () => {
    setUA(UA_IPHONE);

    const btn = document.createElement("button");
    btn.textContent = "Send Receipt";
    btn.addEventListener("click", () => {
      openWhatsApp(
        "9876543210",
        buildPaymentReceiptMessage(
          "Krish", "INV-2026-0001", 100, "upi", 300, 200, "Acme", "abc",
        ),
      );
    });
    document.body.appendChild(btn);
    btn.click();

    expect(captures.openSpy).not.toHaveBeenCalled();
    expect(captures.hrefSetter).toHaveBeenCalledTimes(1);

    const url = captures.hrefSetter.mock.calls[0][0] as string;
    expect(url.startsWith("https://wa.me/9876543210?text=")).toBe(true);

    const decoded = new URL(url).searchParams.get("text") || "";
    expect(decoded).toContain("Amount Paid: ₹100 (UPI)");
    expect(decoded).toContain("Outstanding: ₹200");

    btn.remove();
  });
});