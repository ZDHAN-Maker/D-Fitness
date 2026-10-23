import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Personal Fitness OS",
    short_name: "Fitness OS",
    description: "Training, nutrition, recovery and body tracking in one place.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0d1220",
    theme_color: "#2563eb",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}

