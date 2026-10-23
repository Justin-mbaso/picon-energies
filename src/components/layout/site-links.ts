export const solutionLinks = [
  { label: "Solar", href: "/#solar" },
  { label: "Energy Storage", href: "/#capability-storage" },
  { label: "EV Infrastructure", href: "/#capability-ev-infrastructure" },
  { label: "Green Mobility", href: "/#capability-green-mobility" },
] as const;

export const footerExploreLinks = [
  ...solutionLinks.slice(0, 3),
  { label: "Green Mobility", href: "/#capability-green-mobility" },
  { label: "EV Lite", href: "/#ev-lite" },
] as const;

export const footerCompanyLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact?intent=enquiry" },
  { label: "Partner With Picon", href: "/contact?intent=partnership" },
] as const;
