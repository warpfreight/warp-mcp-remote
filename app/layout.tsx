export const metadata = {
  title: "Warp MCP — remote endpoint",
  description: "Streamable-HTTP MCP server for the Warp freight API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
