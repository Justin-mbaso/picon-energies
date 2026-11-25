import type { ContactPayload } from "./contact-validation";

type ContactSubmissionRequest = {
  endpoint: "/__forms.html" | "/api/contact";
  contentType: "application/x-www-form-urlencoded" | "application/json";
  body: string;
};

export function createContactSubmissionRequest(payload: ContactPayload, useNetlifyForms: boolean): ContactSubmissionRequest {
  if (useNetlifyForms) {
    const body = new URLSearchParams({ "form-name": "picon-contact", ...payload });
    return { endpoint: "/__forms.html", contentType: "application/x-www-form-urlencoded", body: body.toString() };
  }

  return { endpoint: "/api/contact", contentType: "application/json", body: JSON.stringify(payload) };
}
