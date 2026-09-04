import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://corkwill.ryoyamag51.chatgpt.site"),
  title: "CorkWill Log · A clearer way to close the day",
  description: "A quiet daily log that turns a few simple answers into a clear score and useful patterns over time.",
  alternates: { canonical: "/" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "CorkWill Log",
    description: "Answer a few questions, see the day as a score, and notice the patterns that matter.",
    type: "website",
    url: "/",
    images: [{ url: "/og.png", width: 1671, height: 941, alt: "CorkWill Log" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CorkWill Log",
    description: "Answer a few questions, see the day as a score, and notice the patterns that matter.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <html lang="en"><body>{children}</body></html>;
}
