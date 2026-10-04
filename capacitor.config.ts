import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.biniam.masterminds",
  appName: "Master Minds",
  webDir: "dist",
  server: {
    url: "https://masterminds08.vercel.app",
    cleartext: false,
  },
};

export default config;
