"use client";

import { useEffect, useRef } from "react";

/**
 * Retro-dither backdrop — the same field that ships on /authorize, as a React
 * client component for the site pages. Bayer 4x4 ordered dithering, 4-level
 * quantization, chunky cells, drifting mint/blue blobs over warp-site's bluish
 * ink, and a feathered lens that follows the pointer (radius 0.5, softness 1,
 * followSpeed 3 — the RetroDither parameter model, same Bayer table).
 *
 * Portable by design: the Canvas UI reference component needs Chrome's
 * experimental HTML-in-canvas API and silently renders NO effect in stable
 * browsers, so the math is implemented directly on canvas 2D instead.
 *
 * Resilience (same contract as the /authorize copy):
 * - first frame paints synchronously (hidden documents never service rAF)
 * - prefers-reduced-motion: static frame, no loop, no lens
 * - loop self-stops when settled + idle, wakes on pointermove/visibility
 */
export default function DitherBg() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const PIXEL = 3, LEVELS = 4, RADIUS = 0.5, SOFTNESS = 1, STRENGTH = 0.8, BASE = 0.14, FOLLOW = 3;
    const DARK = [10, 17, 27], MINT = [74, 222, 128], BLUE = [56, 189, 248];
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

    let W = 0, H = 0, CW = 0, CH = 0;
    let img: ImageData | null = null;
    let off: HTMLCanvasElement | null = null;
    let octx: CanvasRenderingContext2D | null = null;

    function size() {
      W = Math.max(1, window.innerWidth);
      H = Math.max(1, window.innerHeight);
      CW = Math.ceil(W / PIXEL);
      CH = Math.ceil(H / PIXEL);
      cv!.width = W;
      cv!.height = H;
      off = document.createElement("canvas");
      off.width = CW;
      off.height = CH;
      octx = off.getContext("2d");
      img = octx ? octx.createImageData(CW, CH) : null;
    }
    size();

    let px = 0.72, py = 0.3, tx = px, ty = py, act = 0, tact = 0, lastMove = 0;
    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch {}

    function frame(t: number) {
      if (!img || !octx || !off || !ctx) return;
      const d = img.data;
      const aspect = W / H;
      const minorR = RADIUS * (aspect > 1 ? 1 : aspect);
      const inner = minorR * (1 - SOFTNESS);
      // Portrait viewports put the hero copy directly under the mint blob —
      // damp the blobs there so text stays readable on the wash.
      const damp = aspect < 0.9 ? 0.45 : 1;
      let i = 0;
      for (let y = 0; y < CH; y++) {
        const v = y / CH;
        for (let x = 0; x < CW; x++) {
          const u = x / CW;
          const drift = t * 0.00004;
          const mintD = Math.hypot((u - (0.78 + Math.sin(drift * 2.1) * 0.05)) * aspect, v - (0.22 + Math.cos(drift * 1.7) * 0.05));
          const blueD = Math.hypot((u - (0.15 + Math.cos(drift * 1.3) * 0.04)) * aspect, v - (0.85 + Math.sin(drift * 1.9) * 0.04));
          let lum = 0.16 + 0.1 * (1 - v) + (Math.max(0, 0.66 - mintD * 1.15) + Math.max(0, 0.3 - blueD * 0.9)) * damp;
          if (lum > 1) lum = 1;
          const thr = (B[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
          let q = Math.floor(lum * LEVELS + thr) / LEVELS;
          if (q > 1) q = 1;
          const dist = Math.hypot((u - px) * aspect, v - py);
          let lens = 0;
          if (act > 0.003) {
            const rr = minorR * act;
            lens = dist >= rr ? 0 : dist <= inner * act ? 1 : 1 - (dist - inner * act) / Math.max(rr - inner * act, 1e-4);
          }
          const mask = Math.max(lens, BASE) * STRENGTH;
          const apply = thr <= mask ? 1 : 0;
          let bmix = Math.max(0, 0.5 - blueD) * 1.2;
          if (bmix > 0.55) bmix = 0.55;
          const lr = MINT[0] + (BLUE[0] - MINT[0]) * bmix;
          const lg = MINT[1] + (BLUE[1] - MINT[1]) * bmix;
          const lb = MINT[2] + (BLUE[2] - MINT[2]) * bmix;
          const qq = apply ? q : lum * 0.4;
          d[i] = DARK[0] + (lr - DARK[0]) * qq;
          d[i + 1] = DARK[1] + (lg - DARK[1]) * qq;
          d[i + 2] = DARK[2] + (lb - DARK[2]) * qq;
          d[i + 3] = 255;
          i += 4;
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(off, 0, 0, CW, CH, 0, 0, CW * PIXEL, CH * PIXEL);
    }

    frame(0);
    if (reduce) return;

    let running = false, prev = 0, raf = 0, dead = false;
    function loop(ts: number) {
      if (!running || dead) return;
      const dt = Math.min((ts - prev) / 1000, 1 / 30) || 0;
      prev = ts;
      const ease = 1 - Math.exp(-dt * FOLLOW);
      px += (tx - px) * ease;
      py += (ty - py) * ease;
      act += (tact - act) * ease;
      frame(ts);
      const settled =
        Math.abs(tx - px) < 5e-4 && Math.abs(ty - py) < 5e-4 && Math.abs(tact - act) < 1e-3 &&
        performance.now() - lastMove > 4000;
      if (settled || document.hidden) { running = false; return; }
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (running || dead) return;
      running = true;
      prev = performance.now();
      raf = requestAnimationFrame(loop);
    }

    const onMove = (e: PointerEvent) => {
      tx = e.clientX / W;
      ty = e.clientY / H;
      tact = 1;
      lastMove = performance.now();
      start();
    };
    const onLeave = () => { tact = 0; start(); };
    const onResize = () => { size(); frame(performance.now()); start(); };
    const onVis = () => { if (!document.hidden) { frame(performance.now()); start(); } };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    start();

    return () => {
      dead = true;
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: -1, pointerEvents: "none" }}
    />
  );
}
