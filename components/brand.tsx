import type { ReactNode } from "react";

export const INSTALL_GUIDE = "https://www.wearewarp.com/agents/mcp#claude-code-install";
export const MCP_URL = "https://mcp.wearewarp.com/api/mcp";
const ACCENT = "#00fa8a";

/** Official Warp wordmark (warp-site/public/warp-logo.svg), in the Lumen Spring Green accent. */
export function WarpMark({ width = 92 }: { width?: number }) {
  return (
    <svg width={width} height={(width * 186) / 660} viewBox="0 0 660 186" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Warp" style={{ display: "block" }}>
      <path d="M660 185.035H0V0H660V185.035ZM14.0597 171.327H646.141V13.9593H14.0597V171.327Z" fill={ACCENT} />
      <path d="M300.976 53.2756L332.509 131.608H351.239L319.705 53.2756H300.976Z" fill={ACCENT} />
      <path d="M215.919 131.608H234.648L266.182 53.2756H247.453L215.919 131.608Z" fill={ACCENT} />
      <path d="M150.892 107.405L136.431 71.3523H115.593L101.131 107.405L78.2342 53.2756H60.0068L93.047 131.608H109.517L125.987 90.5839L142.457 131.608H158.927L192.017 53.2756H173.739L150.892 107.405Z" fill={ACCENT} />
      <path d="M471.856 82.8511C471.816 75.0646 468.691 67.6113 463.166 62.1242C457.642 56.6371 450.167 53.5636 442.381 53.5769H388.502V131.608H405.323V112.125H440.021L447.854 131.608H465.981L456.691 108.41C461.258 105.886 465.065 102.183 467.715 97.6881C470.364 93.1928 471.759 88.0691 471.755 82.8511H471.856ZM405.323 70.3481H442.381C445.71 70.3481 448.903 71.6706 451.257 74.0248C453.611 76.379 454.934 79.572 454.934 82.9013C454.934 86.2307 453.611 89.4236 451.257 91.7778C448.903 94.132 445.71 95.4546 442.381 95.4546H405.323V70.3481Z" fill={ACCENT} />
      <path d="M570.768 53.5769H516.939V131.608H533.711V112.125H570.768C574.612 112.125 578.419 111.368 581.971 109.897C585.522 108.426 588.749 106.269 591.468 103.551C594.186 100.833 596.342 97.6055 597.814 94.0538C599.285 90.5021 600.042 86.6954 600.042 82.8511C600.042 79.0067 599.285 75.2 597.814 71.6483C596.342 68.0966 594.186 64.8695 591.468 62.1511C588.749 59.4327 585.522 57.2764 581.971 55.8053C578.419 54.3341 574.612 53.5769 570.768 53.5769ZM570.768 95.4043H533.711V70.2978H570.768C574.097 70.2978 577.29 71.6204 579.644 73.9746C581.998 76.3288 583.321 79.5217 583.321 82.8511C583.321 86.1804 581.998 89.3734 579.644 91.7276C577.29 94.0818 574.097 95.4043 570.768 95.4043Z" fill={ACCENT} />
      <path d="M292.04 76.1794H275.219V94.1557H292.04V76.1794Z" fill={ACCENT} />
      <path d="M275.219 131.615H292.04V113.84H275.219V131.615Z" fill={ACCENT} />
    </svg>
  );
}

/** Shared page chrome — Lumen obsidian canvas, restrained header + footer. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <main>
      <div className="wrap" style={{ paddingTop: 40, paddingBottom: 96 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 64, flexWrap: "wrap" }}>
          <a href="/" aria-label="Warp home" style={{ display: "inline-flex" }}><WarpMark width={90} /></a>
          <nav className="nav">
            <a href="/docs">Docs</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href={INSTALL_GUIDE}>Install guide ↗</a>
          </nav>
        </header>
        {children}
        <footer style={{ marginTop: 88, paddingTop: 24, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13, color: "var(--faint)" }}>
          <span>Operated by Warp · <a className="link" href="https://www.wearewarp.com">wearewarp.com</a></span>
          <span style={{ display: "flex", gap: 16 }}>
            <a href="/docs" style={{ color: "var(--muted)", textDecoration: "none" }}>Docs</a>
            <a href="/privacy" style={{ color: "var(--muted)", textDecoration: "none" }}>Privacy</a>
            <a href="/terms" style={{ color: "var(--muted)", textDecoration: "none" }}>Terms</a>
          </span>
        </footer>
      </div>
    </main>
  );
}
