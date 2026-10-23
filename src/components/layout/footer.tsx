import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import {
  footerCompanyLinks,
  footerExploreLinks,
} from "@/components/layout/site-links";

const socialLinks = [
  {
    label: "Picon Energies on X",
    href: "https://x.com/piconenergies",
    icon: "x",
  },
  {
    label: "Picon Energies on Instagram",
    href: "https://www.instagram.com/piconenergies",
    icon: "instagram",
  },
  {
    label: "Picon Energies on LinkedIn",
    href: "https://www.linkedin.com/company/picon-energies/",
    icon: "linkedin",
  },
] as const;

type SocialIconName = (typeof socialLinks)[number]["icon"];

function SocialIcon({ name }: { name: SocialIconName }) {
  if (name === "x") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M18.9 2H22l-7.1 8.1L23 22h-6.2l-4.9-7.4L5.4 22H2.3l7.6-8.7L1.8 2h6.3l4.4 6.7L18.9 2Zm-1.1 18h1.7L7.1 3.9H5.3L17.8 20Z"
        />
      </svg>
    );
  }

  if (name === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle className="footer-social-icon-dot" cx="17.7" cy="6.6" r="1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5.15 8.05a1.58 1.58 0 1 0 0-3.16 1.58 1.58 0 0 0 0 3.16ZM3.8 9.4h2.7v10.8H3.8V9.4Zm4.45 0h2.59v1.48h.04c.36-.68 1.24-1.86 3.2-1.86 3.42 0 4.06 2.25 4.06 5.17v6.01h-2.7v-5.33c0-1.27-.02-2.9-1.77-2.9-1.78 0-2.05 1.38-2.05 2.8v5.43h-2.7V9.4Z"
      />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <Container>
        <div className="footer-inner">
          <div className="footer-brand">
            <Link
              className="footer-wordmark-link"
              href="/"
              aria-label="Picon Energies home"
            >
              <span className="footer-wordmark" aria-hidden="true">
                <Image
                  src="/images/picon-logo.png"
                  alt=""
                  width={2172}
                  height={724}
                  className="footer-wordmark-full"
                />
                <Image
                  src="/images/picon-logo-2.png"
                  alt=""
                  width={2172}
                  height={724}
                  className="footer-wordmark-mark"
                />
              </span>
            </Link>
            <p className="footer-description">
              Reliable, affordable and intelligent energy solutions for homes,
              businesses and the infrastructure around them.
            </p>
            <nav aria-label="Social media">
              <ul className="footer-social-list">
                {socialLinks.map((social) => (
                  <li key={social.icon}>
                    <a
                      className="footer-social-link"
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                    >
                      <SocialIcon name={social.icon} />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <nav className="footer-column" aria-label="Solutions">
            <h2 className="footer-group-title">Solutions</h2>
            <ul>
              {footerExploreLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="footer-column" aria-label="Company">
            <h2 className="footer-group-title">Company</h2>
            <ul>
              {footerCompanyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="footer-column footer-contact">
            <h2 className="footer-group-title">Contact</h2>
            <a className="footer-email" href="mailto:piconenergies@gmail.com">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m4 7 8 6 8-6" />
              </svg>
              <span>piconenergies@gmail.com</span>
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Picon Energies</p>
          <p>Energy / Storage / Mobility</p>
        </div>
      </Container>
    </footer>
  );
}
