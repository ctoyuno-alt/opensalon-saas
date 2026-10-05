import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanPhone,
  createWaMeUrl,
  interpolateTemplate,
} from "./whatsapp-helpers.ts";

test("cleanPhone strips non-digits and leading zeros/plus signs", () => {
  assert.equal(cleanPhone("+1 (555) 010-1234"), "15550101234");
  assert.equal(cleanPhone("0044 7911 123456"), "447911123456");
  assert.equal(cleanPhone("+91 98765-43210"), "919876543210");
  assert.equal(cleanPhone("+61 (02) 1234 5678"), "610212345678");
  assert.equal(cleanPhone("555-0101"), "5550101");
  assert.equal(cleanPhone(""), "");
});

test("createWaMeUrl creates valid WhatsApp click-to-chat links with URL encoding", () => {
  const url = createWaMeUrl("+1 555-0101", "Hello World & Friends! 🎉\nSee you tomorrow.");
  assert.equal(
    url,
    "https://wa.me/15550101?text=Hello%20World%20%26%20Friends!%20%F0%9F%8E%89%0ASee%20you%20tomorrow."
  );
});

test("interpolateTemplate replaces tags with provided values", () => {
  const tpl = "Hi {{client_name}}, your booking at {{salon_name}} for {{service_name}} on {{date}} at {{time}} with {{staff_name}} is confirmed! Total: ${{total}}.";
  const rendered = interpolateTemplate(tpl, {
    client_name: "Jamie Rivera",
    salon_name: "OpenSalon Studio",
    service_name: "Haircut & Beard Trim",
    date: "2026-10-15",
    time: "10:30",
    staff_name: "Alex",
    total: "65.00",
  });

  assert.equal(
    rendered,
    "Hi Jamie Rivera, your booking at OpenSalon Studio for Haircut & Beard Trim on 2026-10-15 at 10:30 with Alex is confirmed! Total: $65.00."
  );
});

test("interpolateTemplate handles receipt templates properly", () => {
  const tpl = "Thank you for visiting {{salon_name}}, {{client_name}}! Here is your receipt for Invoice #{{invoice_id}}: Total paid ${{total}} via {{payment_method}}.";
  const rendered = interpolateTemplate(tpl, {
    client_name: "Casey Morgan",
    salon_name: "OpenSalon",
    invoice_id: "INV-102",
    total: "120.00",
    payment_method: "CARD",
  });

  assert.equal(
    rendered,
    "Thank you for visiting OpenSalon, Casey Morgan! Here is your receipt for Invoice #INV-102: Total paid $120.00 via CARD."
  );
});

test("interpolateTemplate leaves non-existent tags blank or handles empty string safely", () => {
  const tpl = "Hello {{missing_tag}}!";
  assert.equal(interpolateTemplate(tpl, {}), "Hello !");
  assert.equal(interpolateTemplate("", {}), "");
});
