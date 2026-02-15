import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest & Record<string, unknown> {
  return {
    name: "Brosens Family Foundation",
    short_name: "Brosens",
    description: "Mobile-first grant management platform for the Brosens Family Foundation",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    orientation: "portrait",
    handle_links: "preferred",
    launch_handler: { client_mode: "navigate-existing" },
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
