import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ContactFrame() {
  return (
    <section className="contact-frame" id="contact-frame" aria-labelledby="contact-frame-title">
      <div className="contact-copy">
        <div className="contact-panel">
          <p className="eyebrow">Picon Energies</p>
          <h2 id="contact-frame-title">Let&apos;s build a smarter energy future.</h2>
          <p>Start a conversation about your energy or mobility requirements.</p>
          <div className="contact-actions">
            <Button href="/contact?intent=enquiry">Make an Enquiry</Button>
            <Link className="text-link" href="/contact?intent=partnership">Partner With Picon <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
      <figure className="contact-visual">
        <Image
          className="contact-photo"
          src="/images/business-infrastructure.jpg"
          alt="Modern commercial architecture viewed from below"
          fill
          sizes="(max-width: 58rem) 100vw, 52vw"
        />
      </figure>
    </section>
  );
}
