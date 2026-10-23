import Image from "next/image";
import { Container } from "@/components/ui/container";
import { ContactForm } from "@/components/sections/contact-form";
import type { ContactIntent } from "@/lib/contact-validation";

type ContactPageProps = {
  searchParams: Promise<{ intent?: string | string[] }>;
};

const pageCopy: Record<ContactIntent, { title: string; description: string }> = {
  enquiry: {
    title: "LET'S TALK.",
    description: "Start a conversation about your energy or mobility requirements.",
  },
  partnership: {
    title: "BUILD WITH PICON.",
    description: "Tell us about your organization, project, or opportunity.",
  },
  "solar-assessment": {
    title: "PLAN YOUR POWER.",
    description:
      "Tell us about your property and power requirements so we can understand what you need.",
  },
};

function resolveIntent(value: string | string[] | undefined): ContactIntent {
  if (typeof value === "string" && Object.prototype.hasOwnProperty.call(pageCopy, value)) {
    return value as ContactIntent;
  }

  return "enquiry";
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const { intent: requestedIntent } = await searchParams;
  const intent = resolveIntent(requestedIntent);
  const copy = pageCopy[intent];

  return (
    <main className="contact-page" id="main-content">
      <Container className="contact-page-shell">
        <header className="contact-page-heading">
          <p className="eyebrow">Picon Energies / Contact</p>
          <h1 className="contact-page-title" id="contact-page-title">
            {copy.title}
          </h1>
          <p className="contact-page-description">{copy.description}</p>
          <p className="contact-page-sequence">
            ENERGY <span>/</span> STORAGE <span>/</span> MOBILITY
          </p>
        </header>
        <div className="contact-page-layout">
          <section className="contact-page-form-panel" aria-label="Send an enquiry">
            <ContactForm intent={intent} />
          </section>
          <aside className="contact-details-card" aria-labelledby="contact-details-title">
            <figure className="contact-details-image">
              <Image
                src="/images/business-infrastructure.jpg"
                alt=""
                fill
                priority
                sizes="(max-width: 54rem) 100vw, 38vw"
              />
              <span aria-hidden="true" />
            </figure>
            <div className="contact-details-copy">
              <div>
                <p className="eyebrow">Contact</p>
                <h2 id="contact-details-title">We&apos;re here to help.</h2>
              </div>
              <div className="contact-detail">
                <span className="contact-detail-label">EMAIL US DIRECTLY</span>
                <a href="mailto:piconenergies@gmail.com">PICONENERGIES@GMAIL.COM</a>
              </div>
              <div className="contact-detail">
                <span className="contact-detail-label contact-next-label">WHAT NEXT</span>
                <ol className="contact-next-steps">
                  <li>We listen</li>
                  <li>We design</li>
                  <li>We deploy</li>
                </ol>
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </main>
  );
}
