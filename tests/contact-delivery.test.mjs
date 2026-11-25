import assert from "node:assert/strict";
import test from "node:test";
import { deliverContactEnquiry } from "../src/lib/contact-delivery.ts";

const payload = {
  intent: "enquiry",
  service: "Solar",
  "full-name": "Amina <script>alert('x')</script>",
  email: "amina@example.com",
  phone: "+234 800 123 4567",
  "project-scale": "Commercial",
  message: "Please assess <b>our roof</b>.\nWe need backup power.",
  website: "",
};

const configured = {
  apiKey: "re_test_key",
  fromEmail: "onboarding@resend.dev",
  toEmail: "piconenergies@gmail.com",
};

test("sends validated enquiry fields and reports provider acceptance", async () => {
  let apiKeyUsed = "";
  let emailSent;
  const result = await deliverContactEnquiry(payload, configured, (apiKey) => {
    apiKeyUsed = apiKey;
    return {
      emails: {
        send: async (email) => {
          emailSent = email;
          return { data: { id: "email_test_id" }, error: null };
        },
      },
    };
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(apiKeyUsed, configured.apiKey);
  assert.ok(emailSent);
  assert.equal(emailSent.from, configured.fromEmail);
  assert.equal(configured.toEmail, "piconenergies@gmail.com");
  assert.deepEqual(emailSent.to, ["piconenergies@gmail.com"]);
  assert.equal(emailSent.replyTo, payload.email);
  assert.equal(emailSent.subject, "New Picon Energies enquiry: Solar");
  assert.match(String(emailSent.html), /Amina &lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt;/);
  assert.match(String(emailSent.html), /Please assess &lt;b&gt;our roof&lt;\/b&gt;\.<br \/>We need backup power\./);
  assert.doesNotMatch(String(emailSent.html), /<script>|<b>our roof<\/b>/);
  assert.match(String(emailSent.text), /Phone:\n\+234 800 123 4567/);
  assert.match(String(emailSent.text), /Project scale:\nCommercial/);
});

test("returns a clear configuration error when any required setting is missing", async () => {
  for (const missingSetting of ["apiKey", "fromEmail", "toEmail"]) {
    let providerCreated = false;
    const result = await deliverContactEnquiry(payload, { ...configured, [missingSetting]: undefined }, () => {
      providerCreated = true;
      throw new Error("must not initialize without configuration");
    });

    assert.equal(result.status, 503, `missing ${missingSetting}`);
    assert.equal(result.body.code, "delivery_not_configured", `missing ${missingSetting}`);
    assert.equal(providerCreated, false, `missing ${missingSetting}`);
  }
});

test("does not report success when Resend rejects the message", async () => {
  const result = await deliverContactEnquiry(payload, configured, () => ({
    emails: {
      send: async () => ({
        data: null,
        error: { name: "invalid_api_key", statusCode: 401, message: "provider rejected" },
      }),
    },
  }));

  assert.equal(result.status, 502);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, "delivery_failed");
});

test("does not report success for an incomplete provider response", async () => {
  const result = await deliverContactEnquiry(payload, configured, () => ({
    emails: {
      send: async () => ({ data: null, error: null }),
    },
  }));

  assert.equal(result.status, 502);
  assert.equal(result.body.ok, false);
});
