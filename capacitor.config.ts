import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.biniam.masterminds",
  appName: "Master Minds",
  webDir: "dist",
  // Production Android builds bundle the web app into dist. Do not point
  // Capacitor at the hosted Lovable preview in a Play Store build.
  androidScheme: "https",
  allowNavigation: [
    "*.supabase.co",
    "api.dicebear.com",
    "cdn.jsdelivr.net",
  ],
};

export default config;
