"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  CONTACT_SERVICES,
  PROJECT_SCALES,
  parseContactPayload,
  validateContactPayload,
  type ContactFieldErrors,
  type ContactFieldName,
  type ContactIntent,
} from "@/lib/contact-validation";

type SubmissionState = "idle" | "invalid" | "submitting" | "success" | "error";

type SubmissionReply = {
  ok?: unknown;
  code?: unknown;
  fieldErrors?: unknown;
};

const fieldOrder: ContactFieldName[] = ["service", "full-name", "email", "phone", "project-scale", "message"];

const fieldIds: Record<ContactFieldName, string> = {
  service: "service",
  "full-name": "full-name",
  email: "email",
  phone: "phone",
  "project-scale": "project-scale",
  message: "message",
};

const suggestedService: Partial<Record<ContactIntent, (typeof CONTACT_SERVICES)[number]>> = {
  partnership: "Other / Partnership",
  "solar-assessment": "Solar",
};

function isContactFieldErrors(value: unknown): value is ContactFieldErrors {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;

  return Object.entries(value).every(([field, message]) =>
    fieldOrder.includes(field as ContactFieldName) && typeof message === "string",
  );
}

function firstInvalidField(errors: ContactFieldErrors): ContactFieldName | undefined {
  return fieldOrder.find((field) => Boolean(errors[field]));
}

export function ContactForm({ intent, initialMessage = "" }: { intent: ContactIntent; initialMessage?: string }) {
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submissionNotice, setSubmissionNotice] = useState("");
  const submitting = useRef(false);

  function focusFirstInvalid(errors: ContactFieldErrors) {
    const field = firstInvalidField(errors);
    if (field) {
      window.requestAnimationFrame(() => document.getElementById(fieldIds[field])?.focus());
    }
  }

  function revalidateField(field: ContactFieldName) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      if (!fieldErrors[field]) return;

      const form = event.currentTarget.form;
      if (!form) return;

      const payload = parseContactPayload(Object.fromEntries(new FormData(form).entries()));
      if (!payload) return;

      const message = validateContactPayload(payload)[field];
      const nextErrors = { ...fieldErrors };
      if (message) nextErrors[field] = message;
      else delete nextErrors[field];

      setFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length === 0) {
        setSubmissionState("idle");
        setSubmissionNotice("");
      }
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const form = event.currentTarget;
    const payload = parseContactPayload(Object.fromEntries(new FormData(form).entries()));
    if (!payload) {
      setSubmissionState("error");
      setSubmissionNotice("We couldn't read the enquiry details. Please check the form and try again.");
      return;
    }

    const errors = validateContactPayload(payload);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmissionState("invalid");
      setSubmissionNotice("Please correct the highlighted fields and try again.");
      focusFirstInvalid(errors);
      return;
    }

    submitting.current = true;
    setFieldErrors({});
    setSubmissionNotice("");
    setSubmissionState("submitting");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const reply = await response.json().catch(() => null) as SubmissionReply | null;

      if (response.status === 422 && isContactFieldErrors(reply?.fieldErrors)) {
        setFieldErrors(reply.fieldErrors);
        setSubmissionState("invalid");
        setSubmissionNotice("Please correct the highlighted fields and try again.");
        focusFirstInvalid(reply.fieldErrors);
        return;
      }

      if (response.ok && reply?.ok === true) {
        form.reset();
        setSubmissionState("success");
        setSubmissionNotice("Thank you. Your enquiry has been sent.");
        return;
      }

      setSubmissionState("error");
      if (reply?.code === "delivery_not_configured") {
        setSubmissionNotice("Online submission is not connected yet. No message has been sent. Please email piconenergies@gmail.com directly.");
      } else if (reply?.code === "delivery_failed" || reply?.code === "contact_service_error") {
        setSubmissionNotice("We couldn't send your enquiry just now. Your details are still here; please try again or email piconenergies@gmail.com directly.");
      } else {
        setSubmissionNotice("We couldn't submit your enquiry right now. Your details are still here; please try again.");
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      setSubmissionState("error");
      setSubmissionNotice(
        timedOut
          ? "The enquiry request timed out. Your details are still here; please try again."
          : "We couldn't reach the enquiry service. Your details are still here; please try again.",
      );
    } finally {
      window.clearTimeout(timeout);
      submitting.current = false;
      setSubmissionState((state) => state === "submitting" ? "idle" : state);
    }
  }

  const describedBy = (field: ContactFieldName) => fieldErrors[field] ? `${field}-error` : undefined;
  const invalid = (field: ContactFieldName) => fieldErrors[field] ? "true" : undefined;
  const isSubmitting = submissionState === "submitting";

  return (
    <form className="contact-form" method="post" noValidate onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <input type="hidden" name="intent" value={intent} />
      <div className="contact-form-honeypot" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="contact-form-grid">
        <label className="contact-field contact-field-wide" htmlFor="service">
          <span>Subject / Enquiry <span aria-hidden="true">*</span></span>
          <select
            id="service"
            name="service"
            defaultValue={suggestedService[intent] ?? ""}
            required
            disabled={isSubmitting}
            aria-invalid={invalid("service")}
            aria-describedby={describedBy("service")}
            onChange={revalidateField("service")}
          >
            <option value="" disabled>Select a service</option>
            {CONTACT_SERVICES.map((service) => <option key={service} value={service}>{service}</option>)}
          </select>
          {fieldErrors.service && <span id="service-error" className="contact-field-error">{fieldErrors.service}</span>}
        </label>

        <label className="contact-field" htmlFor="full-name">
          <span>Full Name <span aria-hidden="true">*</span></span>
          <input
            id="full-name"
            name="full-name"
            type="text"
            autoComplete="name"
            maxLength={120}
            required
            disabled={isSubmitting}
            aria-invalid={invalid("full-name")}
            aria-describedby={describedBy("full-name")}
            onChange={revalidateField("full-name")}
          />
          {fieldErrors["full-name"] && <span id="full-name-error" className="contact-field-error">{fieldErrors["full-name"]}</span>}
        </label>

        <label className="contact-field" htmlFor="email">
          <span>Email Address <span aria-hidden="true">*</span></span>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            disabled={isSubmitting}
            aria-invalid={invalid("email")}
            aria-describedby={describedBy("email")}
            onChange={revalidateField("email")}
          />
          {fieldErrors.email && <span id="email-error" className="contact-field-error">{fieldErrors.email}</span>}
        </label>

        <label className="contact-field" htmlFor="phone">
          <span>Phone Number</span>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={32}
            disabled={isSubmitting}
            aria-invalid={invalid("phone")}
            aria-describedby={describedBy("phone")}
            onChange={revalidateField("phone")}
          />
          {fieldErrors.phone && <span id="phone-error" className="contact-field-error">{fieldErrors.phone}</span>}
        </label>

        <label className="contact-field" htmlFor="project-scale">
          <span>Project Scale</span>
          <select
            id="project-scale"
            name="project-scale"
            defaultValue=""
            disabled={isSubmitting}
            aria-invalid={invalid("project-scale")}
            aria-describedby={describedBy("project-scale")}
            onChange={revalidateField("project-scale")}
          >
            <option value="">Select project scale</option>
            {PROJECT_SCALES.map((scale) => <option key={scale} value={scale}>{scale}</option>)}
          </select>
          {fieldErrors["project-scale"] && <span id="project-scale-error" className="contact-field-error">{fieldErrors["project-scale"]}</span>}
        </label>

        <label className="contact-field contact-field-wide" htmlFor="message">
          <span>Message / Requirements <span aria-hidden="true">*</span></span>
          <textarea
            defaultValue={initialMessage}
            id="message"
            name="message"
            rows={6}
            maxLength={5000}
            required
            disabled={isSubmitting}
            aria-invalid={invalid("message")}
            aria-describedby={describedBy("message")}
            onChange={revalidateField("message")}
          />
          {fieldErrors.message && <span id="message-error" className="contact-field-error">{fieldErrors.message}</span>}
        </label>
      </div>

      <button className="button contact-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "SENDING ENQUIRY…" : <>SEND ENQUIRY <span aria-hidden="true">{"\u2192"}</span></>}
      </button>
      {submissionNotice && (
        <p
          className="contact-submit-notice"
          data-state={submissionState}
          role={submissionState === "invalid" || submissionState === "error" ? "alert" : "status"}
          aria-live={submissionState === "invalid" || submissionState === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {submissionNotice}
        </p>
      )}
    </form>
  );
}
