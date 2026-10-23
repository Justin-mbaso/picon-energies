import type { ContactPayload } from "@/lib/contact-validation";

type ResendResult = {
  data: { id: string } | null;
  error: unknown | null;
};

type ResendClient = {
  emails: {
    send: (email: {
      from: string;
      to: string[];
      replyTo: string;
      subject: string;
      html: string;
      text: string;
    }) => Promise<ResendResult>;
  };
};

type ContactDeliveryConfig = {
  apiKey?: string;
  fromEmail?: string;
  toEmail?: string;
};

type DeliveryResponse = {
  status: number;
  body: Record<string, unknown>;
};

type ResendFactory = (apiKey: string) => ResendClient;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildContactEmail(payload: ContactPayload, fromEmail: string, toEmail: string) {
  const fields = [
    ["Name", payload["full-name"]],
    ["Email", payload.email],
    ["Phone", payload.phone || "Not provided"],
    ["Service", payload.service],
    ["Project scale", payload["project-scale"] || "Not provided"],
    ["Message", payload.message],
  ] as const;
  const htmlRows = fields.map(([label, value]) => {
    const safeValue = escapeHtml(value).replaceAll("\n", "<br />");
    return `<tr><th align="left" valign="top" style="padding:8px 12px 8px 0">${label}</th><td style="padding:8px 0">${safeValue}</td></tr>`;
  }).join("");
  const textBody = fields.map(([label, value]) => `${label}:\n${value}`).join("\n\n");

  return {
    from: fromEmail,
    to: [toEmail],
    replyTo: payload.email,
    subject: `New Picon Energies enquiry: ${payload.service}`,
    html: `<!doctype html><html><body><h1>New Picon Energies enquiry</h1><table>${htmlRows}</table></body></html>`,
    text: `New Picon Energies enquiry\n\n${textBody}`,
  };
}

export async function deliverContactEnquiry(
  payload: ContactPayload,
  config: ContactDeliveryConfig,
  createResend: ResendFactory,
): Promise<DeliveryResponse> {
  if (!config.apiKey || !config.fromEmail || !config.toEmail) {
    const missingVariables = [
      !config.apiKey && "RESEND_API_KEY",
      !config.fromEmail && "CONTACT_FROM_EMAIL",
      !config.toEmail && "CONTACT_TO_EMAIL",
    ].filter((name): name is string => Boolean(name));
    console.error("[contact] delivery failure", {
      stage: "configuration",
      code: "delivery_not_configured",
      missingVariables,
    });
    return {
      status: 503,
      body: {
        ok: false,
        code: "delivery_not_configured",
        message: "Contact email delivery is not configured. No message has been sent.",
      },
    };
  }

  try {
    const resend = createResend(config.apiKey);
    const result = await resend.emails.send(buildContactEmail(payload, config.fromEmail, config.toEmail));

    if (result.error || !result.data) {
      const error = result.error;
      const providerCode = error && typeof error === "object" && "name" in error && typeof error.name === "string"
        ? error.name
        : error ? "provider_error_without_code" : "provider_response_incomplete";
      const safeProviderCode = /^[a-z0-9_]{1,64}$/i.test(providerCode) ? providerCode : "unknown_provider_error";
      const providerStatus = error && typeof error === "object" && "statusCode" in error &&
        typeof error.statusCode === "number" && Number.isInteger(error.statusCode)
        ? error.statusCode
        : undefined;
      console.error("[contact] delivery failure", {
        stage: "resend_request",
        code: "delivery_failed",
        providerCode: safeProviderCode,
        ...(providerStatus === undefined ? {} : { providerStatus }),
      });
      return {
        status: 502,
        body: {
          ok: false,
          code: "delivery_failed",
          message: "The enquiry could not be delivered right now. Please try again.",
        },
      };
    }

    return { status: 200, body: { ok: true } };
  } catch {
    console.error("[contact] delivery failure", {
      stage: "resend_request",
      code: "delivery_failed",
      failureKind: "provider_request_exception",
    });
    return {
      status: 502,
      body: {
        ok: false,
        code: "delivery_failed",
        message: "The enquiry could not be delivered right now. Please try again.",
      },
    };
  }
}
