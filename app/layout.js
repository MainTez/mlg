import "./globals.css";

export const metadata = {
  title: "LoL Tracker",
  description: "Team dashboard, tracker, and match insights in one workspace.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0b1116",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LoL Tracker"
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({ children }) {
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
  return (
    <html lang="en">
      <body data-version={appVersion}>{children}</body>
    </html>
  );
}
