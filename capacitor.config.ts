import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.biniam.masterminds",
  appName: "Master Minds",
  webDir: "dist",
  server: {
    // Loads the live preview during development for hot-reload on device.
    // Remove this block for a production build that bundles the app locally.
    url: "https://a549e3ca-84f7-4dce-aa6b-55e5beb976b5.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
};

export default config;
