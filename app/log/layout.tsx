import type { Metadata } from "next";

import "./log.css";

export const metadata: Metadata = {
  title: "CorkWill Log",
  description: "A quiet, configurable daily life log from CorkWill.",
  alternates: { canonical: "/log" },
  openGraph: {
    title: "CorkWill Log",
    description: "A quiet, configurable daily life log from CorkWill.",
    type: "website",
    url: "/log",
    images: [{ url: "/og.png", width: 1671, height: 941, alt: "CorkWill Log" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CorkWill Log",
    description: "A quiet, configurable daily life log from CorkWill.",
    images: ["/og.png"],
  },
};

export default function LogLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="log-scope">{children}</div>;
}
