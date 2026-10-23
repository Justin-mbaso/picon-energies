import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";

export function Capabilities() {
  return (
    <section
      className="capabilities"
      id="capabilities"
      aria-labelledby="capabilities-title"
    >
      <Container className="capabilities-layout">
        <header className="capabilities-heading">
          <div>
            <p className="eyebrow">What we do</p>
            <h2 className="intro-title" id="capabilities-title">
              We solve power problems.
            </h2>
          </div>
          <h3 className="capabilities-statement">
            Renewable energy, storage and mobility for homes, businesses and essential infrastructure.
          </h3>
        </header>

        <div className="capabilities-cards">
          <Link className="capability-tile capability-tile-summary capability-tile-solutions" href="/#ev-infrastructure">
            <span className="capability-tile-accent" aria-hidden="true" />
            <span className="capability-art" aria-hidden="true">
              <span className="capability-art-dot" />
              <span className="capability-art-pill capability-art-pill-blue" />
              <span className="capability-art-pill capability-art-pill-soft" />
            </span>
            <h3>More reliable power.</h3>
            <p>Scalable battery and inverter solutions designed to make power more reliable.</p>
            <p className="capability-sequence">
              ENERGY <span>/</span> STORAGE <span>/</span> MOBILITY
            </p>
            <span className="capability-tile-link">
              Solutions <span aria-hidden="true">{"\u2192"}</span>
            </span>
          </Link>

          <Link className="capability-tile capability-tile-photo" href="/#solar">
            <Image
              src="/images/solar-rooftop-installation.jpg"
              alt=""
              fill
              sizes="(max-width: 42rem) 100vw, (max-width: 58rem) 50vw, 33vw"
            />
            <span className="capability-photo-shade" aria-hidden="true" />
            <span className="capability-photo-copy">
              <span className="eyebrow">Solar</span>
              <span className="capability-photo-title">Power that&apos;s designed around you.</span>
            </span>
          </Link>

          <Link className="capability-tile capability-tile-photo capability-tile-ev-lite" href="/#ev-lite">
            <Image
              src="/images/ev-lite-login-app.png"
              alt=""
              fill
              sizes="(max-width: 42rem) 100vw, (max-width: 58rem) 100vw, 33vw"
            />
            <span className="capability-photo-shade" aria-hidden="true" />
            <span className="capability-photo-copy">
              <span className="capability-photo-meta">
                <span className="eyebrow">EV Lite</span>
                <span className="capability-photo-status">In development</span>
              </span>
              <span className="capability-photo-title">
                A smarter way to discover, charge and maintain electric mobility.
              </span>
            </span>
          </Link>
        </div>
      </Container>
    </section>
  );
}
