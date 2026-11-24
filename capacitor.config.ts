import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.biniam.masterminds",
  appName: "Master Minds",
  // Android builds copy the Vite output into the native app with cap sync.
  // Keep API traffic pointed at the existing production services through the
  // normal Vite environment; do not turn the installed app into a remote URL wrapper.
  webDir: "dist",
};

export default config;
