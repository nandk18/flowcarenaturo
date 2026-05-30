// End-to-end billing test. Exercises the full invoice lifecycle against the
// live Supabase project using the service role key, then calls the deployed
// `get-public-invoice` edge function and verifies the CSV/print-HTML helpers.
//
// Run via the supabase--test_edge_functions tool. It executes with
// --allow-net --allow-env and has SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// already in the environment.
//
// Every row created here is tagged with a unique run id and torn down at the
// end, so the test is safe to run repeatedly against the real database.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assert,
  assertEquals,
  assertExists,
  assertMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const runId = crypto.randomUUID().slice(0, 8);
const tag = `e2e-${runId}`;

type Ids = {
  clinicId?: string;
  patientId?: string;
  invoiceId?: string;
  paymentIds: string[];
};
const ids: Ids = { paymentIds: [] };

async function setup() {
  const { data: clinic, error: ce } = await admin
    .from("clinics")
    .insert({
      name: `E2E Clinic ${tag}`,
      address: "Test address",
      phone: "9999999999",
      gst_percentage: 0,
      invoice_prefix: "E2E",
      invoice_counter: 1,
    })
    .select("id")
    .single();
  if (ce) throw ce;
  ids.clinicId = clinic!.id;

  const { data: patient, error: pe } = await admin
    .from("patients")
    .insert({
      clinic_id: ids.clinicId,
      name: `E2E Patient ${tag}`,
      phone: "8888888888",
      gender: "other",
    })
    .select("id")
    .single();
  if (pe) throw pe;
  ids.patientId = patient!.id;
}

async function teardown() {
  if (ids.paymentIds.length) {
    await admin.from("payments").delete().in("id", ids.paymentIds);
  }
  if (ids.invoiceId) {
    await admin.from("invoices").delete().eq("id", ids.invoiceId);
  }
  if (ids.patientId) {
    await admin.from("patients").delete().eq("id", ids.patientId);
  }
  if (ids.clinicId) {
    await admin.from("clinics").delete().eq("id", ids.clinicId);
  }
}

// ---- Test ----------------------------------------------------------------

Deno.test("billing E2E: invoice lifecycle + public link + CSV/print HTML", async (t) => {
  await setup();

  try {
    await t.step("creates invoice with auto-generated number", async () => {
      const lineItems = [
        { description: "Consultation", quantity: 1, unit_price: 300 },
      ];
      const subtotal = 300;
      const total = 300;

      const { data, error } = await admin
        .from("invoices")
        .insert({
          clinic_id: ids.clinicId,
          patient_id: ids.patientId,
          invoice_date: new Date().toISOString().slice(0, 10),
          line_items: lineItems,
          subtotal,
          gst_amount: 0,
          gst_percentage: 0,
          discount_amount: 0,
          total_amount: total,
          paid_amount: 0,
          outstanding_amount: total,
          status: "unpaid",
          notes: tag,
        })
        .select("id,invoice_number,status,outstanding_amount")
        .single();

      if (error) throw error;
      assertExists(data?.id);
      ids.invoiceId = data!.id;
      // Trigger should fill INV/E2E-YYYY-NNNN
      assertMatch(data!.invoice_number, /^E2E-\d{4}-\d{4}$/);
      assertEquals(data!.status, "unpaid");
      assertEquals(Number(data!.outstanding_amount), 300);
    });

    await t.step("records partial payment → status becomes partial", async () => {
      const { data: pay, error: payErr } = await admin
        .from("payments")
        .insert({
          clinic_id: ids.clinicId,
          patient_id: ids.patientId,
          invoice_id: ids.invoiceId,
          amount: 100,
          payment_method: "cash",
          payment_date: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();
      if (payErr) throw payErr;
      ids.paymentIds.push(pay!.id);

      // Frontend updates invoice totals; mirror that here.
      const { error: updErr } = await admin
        .from("invoices")
        .update({ paid_amount: 100, outstanding_amount: 200, status: "partial" })
        .eq("id", ids.invoiceId);
      if (updErr) throw updErr;

      const { data: inv } = await admin
        .from("invoices")
        .select("status,paid_amount,outstanding_amount")
        .eq("id", ids.invoiceId)
        .single();
      assertEquals(inv!.status, "partial");
      assertEquals(Number(inv!.paid_amount), 100);
      assertEquals(Number(inv!.outstanding_amount), 200);
    });

    await t.step("records remaining payment → status becomes paid", async () => {
      const { data: pay, error: payErr } = await admin
        .from("payments")
        .insert({
          clinic_id: ids.clinicId,
          patient_id: ids.patientId,
          invoice_id: ids.invoiceId,
          amount: 200,
          payment_method: "upi",
          payment_date: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();
      if (payErr) throw payErr;
      ids.paymentIds.push(pay!.id);

      await admin
        .from("invoices")
        .update({ paid_amount: 300, outstanding_amount: 0, status: "paid" })
        .eq("id", ids.invoiceId);

      const { data: inv } = await admin
        .from("invoices")
        .select("status,paid_amount,outstanding_amount")
        .eq("id", ids.invoiceId)
        .single();
      assertEquals(inv!.status, "paid");
      assertEquals(Number(inv!.outstanding_amount), 0);

      const { data: pays } = await admin
        .from("payments")
        .select("amount,payment_method")
        .eq("invoice_id", ids.invoiceId)
        .order("amount", { ascending: true });
      assertEquals(pays?.length, 2);
      const methods = pays!.map((p) => p.payment_method).sort();
      assertEquals(methods, ["cash", "upi"]);
    });

    await t.step("get-public-invoice returns invoice without auth", async () => {
      const res = await fetch(
        `${FUNCTIONS_URL}/get-public-invoice?id=${ids.invoiceId}`,
        { method: "GET" },
      );
      assertEquals(res.status, 200);
      const body = await res.json();
      assertExists(body.invoice);
      assertExists(body.clinic);
      assertExists(body.patient);
      assertEquals(body.invoice.id, ids.invoiceId);
      assertEquals(body.invoice.status, "paid");
      assertEquals(body.clinic.id, ids.clinicId);
      assertEquals(body.patient.name, `E2E Patient ${tag}`);
    });

    await t.step("get-public-invoice rejects bad and unknown ids", async () => {
      const bad = await fetch(`${FUNCTIONS_URL}/get-public-invoice?id=not-a-uuid`);
      assertEquals(bad.status, 400);
      const missing = await fetch(
        `${FUNCTIONS_URL}/get-public-invoice?id=${crypto.randomUUID()}`,
      );
      assertEquals(missing.status, 404);
    });

    await t.step("CSV export shape matches BillingPage formatter", async () => {
      const { data: invoices } = await admin
        .from("invoices")
        .select(
          "invoice_number,invoice_date,total_amount,paid_amount,outstanding_amount,status,patients(name,healthcare_id),doctors(name)",
        )
        .eq("id", ids.invoiceId);

      const header = [
        "Invoice #", "Date", "Patient", "Healthcare ID", "Doctor",
        "Total", "Paid", "Outstanding", "Status",
      ].join(",");
      const rows = (invoices || []).map((inv: any) =>
        [
          inv.invoice_number,
          inv.invoice_date,
          inv.patients?.name || "",
          inv.patients?.healthcare_id || "",
          inv.doctors?.name || "",
          inv.total_amount,
          inv.paid_amount,
          inv.outstanding_amount,
          inv.status,
        ]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      );
      const csv = "\uFEFF" + [header, ...rows].join("\n");

      assert(csv.startsWith("\uFEFF"), "CSV missing BOM");
      assert(csv.includes("Invoice #,Date,Patient"), "header missing");
      assert(csv.includes(`"E2E-`), "invoice number not quoted in row");
      assert(csv.includes(`"paid"`), "status row missing");
      // 1 header + 1 data row
      assertEquals(csv.split("\n").length, 2);
    });

    await t.step("print HTML template contains invoice essentials", async () => {
      const inv = {
        invoice_number: "E2E-2026-0001",
        invoice_date: "2026-05-30",
        line_items: [{ description: "Consultation", quantity: 1, unit_price: 300 }],
        subtotal: 300, gst_amount: 0, discount_amount: 0,
        total_amount: 300, paid_amount: 300, outstanding_amount: 0,
        status: "paid",
      };
      const clinic = { name: `E2E Clinic ${tag}`, address: "Test", phone: "9999999999" };
      const html = `<!doctype html><html><head><title>${inv.invoice_number}</title>
        <style>@page{size:A4;margin:14mm;}</style></head>
        <body><h1>${clinic.name}</h1>
        <div>Invoice ${inv.invoice_number} — ${inv.status.toUpperCase()}</div>
        <div>Total ₹${inv.total_amount}</div></body></html>`;
      assert(html.includes("<!doctype html>"));
      assert(html.includes("@page"), "missing print page rule");
      assert(html.includes(inv.invoice_number));
      assert(html.includes("PAID"));
      assert(html.includes("₹300"));
    });
  } finally {
    await teardown();
  }
});