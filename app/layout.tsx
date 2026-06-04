import "./globals.css";

export const metadata = {
  title: "Warp MCP — freight inside your AI assistant",
  description:
    "Quote, book, and track LTL & FTL freight from Claude, ChatGPT, or any MCP-compatible AI — grounded in your live Warp account.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800,900&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
