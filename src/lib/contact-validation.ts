export const CONTACT_SERVICES = [
  "Solar",
  "Energy Storage",
  "EV Infrastructure",
  "Green Mobility",
  "EV Lite",
  "Other / Partnership",
] as const;

export const PROJECT_SCALES = ["Home", "Commercial", "Fleet", "Utility"] as const;

export const CONTACT_INTENTS = ["enquiry", "partnership", "solar-assessment"] as const;

export type ContactIntent = (typeof CONTACT_INTENTS)[number];
export type ContactFieldName =
  | "service"
  | "full-name"
  | "email"
  | "phone"
  | "project-scale"
  | "message";

export type ContactPayload = {
  intent: ContactIntent;
  service: string;
  "full-name": string;
  email: string;
  phone: string;
  "project-scale": string;
  message: string;
  website: string;
};

export type ContactFieldErrors = Partial<Record<ContactFieldName, string>>;

const acceptedKeys = new Set([
  "intent",
  "service",
  "full-name",
  "email",
  "phone",
  "project-scale",
  "message",
  "website",
]);

function isContactIntent(value: string): value is ContactIntent {
  return CONTACT_INTENTS.some((intent) => intent === value);
}

export function parseContactPayload(input: unknown): ContactPayload | null {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return null;

  const record = input as Record<string, unknown>;
  if (Object.keys(record).some((key) => !acceptedKeys.has(key))) return null;

  for (const value of Object.values(record)) {
    if (typeof value !== "string") return null;
  }

  const intentValue = typeof record.intent === "string" ? record.intent.trim() : "enquiry";
  if (!isContactIntent(intentValue)) return null;

  return {
    intent: intentValue,
    service: typeof record.service === "string" ? record.service.trim() : "",
    "full-name": typeof record["full-name"] === "string" ? record["full-name"].trim() : "",
    email: typeof record.email === "string" ? record.email.trim() : "",
    phone: typeof record.phone === "string" ? record.phone.trim() : "",
    "project-scale": typeof record["project-scale"] === "string" ? record["project-scale"].trim() : "",
    message: typeof record.message === "string" ? record.message.trim() : "",
    website: typeof record.website === "string" ? record.website.trim() : "",
  };
}

export function validateContactPayload(payload: ContactPayload): ContactFieldErrors {
  const errors: ContactFieldErrors = {};

  if (!payload.service || !CONTACT_SERVICES.some((service) => service === payload.service)) {
    errors.service = "Choose one of the listed services.";
  }

  if (!payload["full-name"]) {
    errors["full-name"] = "Enter your full name.";
  } else if (payload["full-name"].length > 120) {
    errors["full-name"] = "Your name must be 120 characters or fewer.";
  }

  if (!payload.email) {
    errors.email = "Enter your email address.";
  } else if (payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (payload.phone) {
    const digitCount = payload.phone.replace(/\D/g, "").length;
    if (payload.phone.length > 32 || !/^\+?[0-9\s().-]+$/.test(payload.phone) || digitCount < 7 || digitCount > 15) {
      errors.phone = "Enter a valid phone number, including its country code if needed.";
    }
  }

  if (payload["project-scale"] && !PROJECT_SCALES.some((scale) => scale === payload["project-scale"])) {
    errors["project-scale"] = "Choose a valid project scale.";
  }

  if (!payload.message) {
    errors.message = "Tell us a little about your requirements.";
  } else if (payload.message.length > 5000) {
    errors.message = "Your message must be 5,000 characters or fewer.";
  }

  return errors;
}
