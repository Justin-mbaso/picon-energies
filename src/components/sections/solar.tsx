import Image from "next/image";
import { Button } from "@/components/ui/button";

const processSteps = [
  { title: "Assess", detail: "Understand your needs.", icon: "assess" },
  { title: "Design", detail: "A tailored system.", icon: "design" },
  { title: "Deliver", detail: "Reliable power.", icon: "deliver" },
] as const;

const audiences = [
  { title: "Homes", detail: "Reliable everyday power", icon: "home" },
  { title: "Businesses", detail: "Lower operating costs", icon: "business" },
  {
    title: "Critical Infrastructure",
    detail: "Uninterrupted operations",
    icon: "critical",
  },
] as const;

type AudienceIconName = (typeof audiences)[number]["icon"];
type ProcessIconName = (typeof processSteps)[number]["icon"];

function AudienceIcon({ name }: { name: AudienceIconName }) {
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      </svg>
    );
  }

  if (name === "business") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="1" />
        <path d="M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2M10 21v-3h4v3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

function ProcessIcon({ name }: { name: ProcessIconName }) {
  if (name === "assess") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 20h18M6 18v-6h3v6m3 0V8h3v10m3 0V4h3v14" />
      </svg>
    );
  }

  if (name === "design") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h9l4 4v14H6zM15 3v5h5M9 12h7m-7 4h7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m13 2-9 12h7l-1 8 10-13h-7z" />
    </svg>
  );
}

export function Solar() {
  return (
    <section className="solar-section" id="solar" aria-labelledby="solar-title">
      <div className="solar-feature">
        <div className="solar-copy">
          <p className="eyebrow">Solar</p>
          <h2 className="solar-title" id="solar-title">
            Power that&apos;s<br />
            designed around<br />
            <span className="solar-title-accent">you.</span>
          </h2>
          <p className="solar-lede">
            We assess how you actually use power, then design a solar and
            backup system around your needs, budget and environment.
          </p>
          <div className="solar-actions">
            <Button href="/contact?intent=solar-assessment">
              Get a Solar Assessment
            </Button>
          </div>
          <div className="solar-process-strip">
            <ol className="solar-process-list" aria-label="Solar assessment process">
              {processSteps.map((step) => (
                <li className="solar-process-group" key={step.title}>
                  <span className="process-icon-wrap">
                    <ProcessIcon name={step.icon} />
                  </span>
                  <span className="process-step-copy">
                    <span className="process-step-title">{step.title}</span>
                    <span className="process-step-detail">{step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="solar-visual">
          <figure className="solar-photo">
            <Image
              src="/images/solar-rooftop-installation.jpg"
              alt="A technician installing solar panels on a rooftop"
              fill
              sizes="(max-width: 64rem) 100vw, 62vw"
            />
          </figure>
          <aside className="solar-audience" aria-label="Solar solutions for homes, businesses, and critical infrastructure">
            {audiences.map((audience) => (
              <div className="solar-audience-row" key={audience.title}>
                <span className="solar-audience-icon">
                  <AudienceIcon name={audience.icon} />
                </span>
                <span className="solar-audience-divider" aria-hidden="true" />
                <span className="solar-audience-copy">
                  <span className="solar-audience-title">{audience.title}</span>
                  <span className="solar-audience-detail">{audience.detail}</span>
                </span>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </section>
  );
}
