import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContactSubmissionRequest } from "../src/lib/contact-submission.ts";

const payload = {
  intent: "solar-assessment",
  service: "Solar",
  "full-name": "Amina Example",
  email: "amina@example.com",
  phone: "+234 800 123 4567",
  "project-scale": "Commercial",
  message: "Calculator assessment: 3.28 kW peak, 24.08 kWh daily, 19.68 kWh backup.",
  website: "",
};

test("Netlify registration declares the same contact fields and honeypot as ContactForm", async () => {
  const [markup, component] = await Promise.all([
    readFile(new URL("../public/__forms.html", import.meta.url), "utf8"),
    readFile(new URL("../src/components/sections/contact-form.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(markup, /<form[^>]*name="picon-contact"[^>]*method="POST"[^>]*data-netlify="true"[^>]*netlify-honeypot="website"/i);
  assert.match(markup, /<input[^>]*type="hidden"[^>]*name="form-name"[^>]*value="picon-contact"/i);
  const registered = [...markup.matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"/gi)].map((match) => match[1]).filter((name) => name !== "form-name");
  const contactNames = ["intent", "service", "full-name", "email", "phone", "project-scale", "message", "website"];
  assert.deepEqual([...new Set(registered)].sort(), [...contactNames].sort());
  for (const name of contactNames) assert.ok(component.includes(`name="${name}"`), `ContactForm is missing ${name}`);
});

test("Netlify mode posts URL-encoded assessment data to the registered endpoint", () => {
  const request = createContactSubmissionRequest(payload, true);
  const fields = new URLSearchParams(request.body);

  assert.equal(request.endpoint, "/__forms.html");
  assert.equal(request.contentType, "application/x-www-form-urlencoded");
  assert.equal(fields.get("form-name"), "picon-contact");
  for (const [name, value] of Object.entries(payload)) assert.equal(fields.get(name), value);
  assert.ok(request.body.includes("message=Calculator+assessment%3A"));
});

test("Resend mode keeps the existing JSON API request", () => {
  assert.deepEqual(createContactSubmissionRequest(payload, false), {
    endpoint: "/api/contact",
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
});

test("ContactForm clears fields only after delivery is accepted", async () => {
  const component = await readFile(new URL("../src/components/sections/contact-form.tsx", import.meta.url), "utf8");
  const successfulResponseBranch = /if \(response\.ok && \(useNetlifyForms \|\| reply\?\.ok === true\)\) \{[\s\S]*?form\.reset\(\);/;

  assert.match(component, successfulResponseBranch);
  assert.equal([...component.matchAll(/form\.reset\(\)/g)].length, 1);
});
