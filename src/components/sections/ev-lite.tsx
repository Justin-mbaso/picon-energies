import Image from "next/image";
import { Button } from "@/components/ui/button";

const pillars = [
  { title: "Discover", detail: "Find charging infrastructure and relevant mobility services.", icon: "discover" },
  { title: "Identify", detail: "Understand charging and vehicle requirements.", icon: "identify" },
  { title: "Maintain", detail: "Build toward a connected maintenance and after-sales ecosystem.", icon: "maintain" },
] as const;

type PillarIconName = (typeof pillars)[number]["icon"];

function PillarIcon({ name }: { name: PillarIconName }) {
  if (name === "discover") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
    );
  }

  if (name === "identify") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 4H5v17h14V4h-3M9 3h6v4H9zM8 11h8m-8 4h8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.2 14 4l2.1-.8 1.7 1.7L17 7l.8 2 2.1 1v2.2l-2.1 1-.8 2 1 2.1-1.7 1.6-2.1-.8-2 .8-1-.8-2.1.8-1.7-1.6 1-2.1-.8-2-2.1-1V10l2.1-1 .8-2-1-2.1L7.1 3.2 9.2 4z" />
      <circle cx="12" cy="11.1" r="2.5" />
    </svg>
  );
}

export function EvLite() {
  return (
    <section className="ev-lite" id="ev-lite" aria-labelledby="ev-lite-title">
      <div className="ev-lite-layout site-container">
        <div className="ev-lite-panel">
          <div className="ev-lite-content">
            <div className="ev-lite-main">
              <div className="ev-lite-intro">
                <p className="eyebrow">Picon Mobility</p>
                <div className="ev-lite-title-row">
                  <h2 id="ev-lite-title"><span>EV</span> <span className="ev-lite-title-accent">Lite</span></h2>
                  <span className="ev-lite-status">In development</span>
                </div>
                <p className="ev-lite-description">
                  A smarter way to discover, charge, and maintain electric mobility.
                </p>
              </div>

              <p className="ev-lite-words" aria-label="Find. Charge. Move.">
                <span>Find.</span><span>Charge.</span><span>Move.</span>
              </p>
            </div>
          </div>
        </div>

        <figure className="ev-lite-visual">
          <Image
            className="ev-lite-photo"
            src="/images/ev-lite-login-app.png"
            alt="A person holding a phone displaying the EV Lite charging app"
            fill
            sizes="(max-width: 64rem) 100vw, 55vw"
          />
          <span className="ev-lite-shade" aria-hidden="true" />
          <aside className="ev-lite-details" id="ev-lite-details" aria-label="EV Lite service areas">
            <ol className="ev-lite-pillars">
              {pillars.map((pillar) => (
                <li key={pillar.title}>
                  <span className="ev-lite-pillar-icon"><PillarIcon name={pillar.icon} /></span>
                  <span className="ev-lite-pillar-copy">
                    <span className="ev-lite-pillar-title">{pillar.title}</span>
                    <span className="ev-lite-pillar-description">{pillar.detail}</span>
                  </span>
                  <span className="ev-lite-pillar-arrow" aria-hidden="true">→</span>
                </li>
              ))}
            </ol>
          </aside>
        </figure>
      </div>
      <div className="ev-lite-footer site-container">
        <div className="ev-lite-actions">
          <Button href="/#ev-lite" className="ev-lite-cta">
            Explore EV Lite <span aria-hidden="true">→</span>
          </Button>
          <a className="ev-lite-learn" href="#ev-lite-details">Learn more</a>
        </div>
        <div className="ev-lite-note">
          <p>EV Lite is in development, with future plans across digital discovery, charging and after-sales services.</p>
        </div>
      </div>
    </section>
  );
}
