export default function manifest() {
  return {
    name: "LoL Tracker",
    short_name: "LoL Tracker",
    description: "Team dashboard, tracker, and match insights.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1116",
    theme_color: "#0b1116",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ]
  };
}
