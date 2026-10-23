import { Resend } from "resend";
import { parseContactPayload, validateContactPayload } from "@/lib/contact-validation";
import { deliverContactEnquiry } from "@/lib/contact-delivery";

const MAX_REQUEST_BYTES = 12_000;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return jsonResponse({ ok: false, code: "unsupported_media_type", message: "Send the enquiry as JSON." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ ok: false, code: "payload_too_large", message: "The enquiry is too large." }, 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return jsonResponse({ ok: false, code: "invalid_request", message: "The enquiry could not be read." }, 400);
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ ok: false, code: "payload_too_large", message: "The enquiry is too large." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, code: "invalid_json", message: "The enquiry format was invalid." }, 400);
  }

  const payload = parseContactPayload(body);
  if (!payload) {
    console.warn("[contact] request rejected", { stage: "validation", code: "invalid_request" });
    return jsonResponse({ ok: false, code: "invalid_request", message: "The enquiry data was invalid." }, 400);
  }

  if (payload.website) {
    console.warn("[contact] request rejected", { stage: "validation", code: "honeypot_triggered" });
    return jsonResponse({ ok: false, code: "invalid_request", message: "The enquiry data was invalid." }, 400);
  }

  const fieldErrors = validateContactPayload(payload);
  if (Object.keys(fieldErrors).length > 0) {
    console.warn("[contact] request rejected", { stage: "validation", code: "validation_failed" });
    return jsonResponse({ ok: false, code: "validation_failed", fieldErrors }, 422);
  }

  try {
    const result = await deliverContactEnquiry(payload, {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.CONTACT_FROM_EMAIL,
      toEmail: process.env.CONTACT_TO_EMAIL,
    }, (apiKey) => new Resend(apiKey));

    return jsonResponse(result.body, result.status);
  } catch {
    console.error("[contact] request failure", { stage: "unexpected_exception", code: "contact_service_error" });
    return jsonResponse({
      ok: false,
      code: "contact_service_error",
      message: "The enquiry service is temporarily unavailable. Please try again or email piconenergies@gmail.com.",
    }, 500);
  }
}
