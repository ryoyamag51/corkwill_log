import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in · CorkWill Log",
  description: "Sign in to CorkWill Log with a one-time email code.",
  robots: { index: false, follow: false },
};

export default function SignInLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
