import type { CapacitorConfig } from "@capacitor/cli";

// This is a local Next Gen review build, not an App Store release configuration.
// The loopback server runs the existing CorkWill app with isolated sample data.
const config: CapacitorConfig = {
  appId: "com.corkwill.log.review",
  appName: "CorkWill Log",
  webDir: "native-shell",
  server: {
    url: "http://localhost:4173/",
    cleartext: true,
  },
  ios: { contentInset: "never", backgroundColor: "#f4efe7", preferredContentMode: "mobile" },
};

export default config;
