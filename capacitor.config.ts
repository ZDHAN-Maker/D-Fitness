import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dfitness.os",
  appName: "D-Fitness",
  webDir: "public",
  server: {
    // URL server Next.js (hosting Vercel / server) agar fitur SSR, Server Actions, dan database berjalan
    url: process.env.CAPACITOR_SERVER_URL || undefined,
    androidScheme: "https",
    cleartext: true,
  },
};

export default config;
