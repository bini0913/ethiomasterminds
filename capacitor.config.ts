import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.biniam.masterminds",
  appName: "Master Minds",
  webDir: "dist",
  server: {
    // Use the published app so Android always opens a stable WebView origin.
    url: "https://ethiomasterminds.lovable.app",
    androidScheme: "https",
    allowNavigation: [
      "ethiomasterminds.lovable.app",
      "*.supabase.co",
      "api.dicebear.com",
      "cdn.jsdelivr.net",
    ],
    cleartext: true,
  },
};

export default config;
