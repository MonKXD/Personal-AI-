"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type GNode = { id: string; title: string; type: string };
type GEdge = { a: string; b: string };

type Sim = {
  id: string;
  title: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  deg: number;
};

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function typeColor(type: string): string {
  if (typeof window === "undefined") return "#4a3f8f";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(`--type-${type}`)
    .trim();
  return v || "#4a3f8f";
}

/** One tick of a tiny force layout: pairwise repulsion, edge springs,
 * gravity to centre, damping. O(n²) — fine for the 250-node cap. */
function tick(nodes: Sim[], edges: [number, number][], w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const REPULSE = 5200;
  const SPRING = 0.018;
  const LINK_LEN = 92;
  const GRAVITY = 0.015;
  const DAMP = 0.86;

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let k = i + 1; k < nodes.length; k++) {
      const b = nodes[k];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) {
        d2 = 1;
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
      }
      const f = REPULSE / d2;
      const d = Math.sqrt(d2);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }
  for (const [i, k] of edges) {
    const a = nodes[i];
    const b = nodes[k];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - LINK_LEN) * SPRING;
    const fx = (dx / d) * f;
    const fy = (dy / d) * f;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }
  for (const n of nodes) {
    n.vx += (cx - n.x) * GRAVITY;
    n.vy += (cy - n.y) * GRAVITY;
    n.vx *= DAMP;
    n.vy *= DAMP;
    n.x += n.vx;
    n.y += n.vy;
  }
}

export function MemoryGraph({ nodes, edges }: { nodes: GNode[]; edges: GEdge[] }) {
  const router = useRouter();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const hoverRef = React.useRef<string | null>(null);
  const simRef = React.useRef<Sim[] | null>(null);

  React.useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || nodes.length === 0) return;

    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const edgeIdx: [number, number][] = edges
      .map((e) => [idx.get(e.a), idx.get(e.b)] as [number | undefined, number | undefined])
      .filter((p): p is [number, number] => p[0] != null && p[1] != null);

    const deg = new Array(nodes.length).fill(0);
    for (const [a, b] of edgeIdx) {
      deg[a]++;
      deg[b]++;
    }

    let w = wrap.clientWidth || 800;
    let h = wrap.clientHeight || 500;
    const sim: Sim[] = nodes.map((n, i) => {
      const ang = (i / nodes.length) * Math.PI * 2;
      const rad = Math.min(w, h) * 0.32 * (0.5 + Math.random() * 0.5);
      return {
        id: n.id,
        title: n.title,
        type: n.type,
        x: w / 2 + Math.cos(ang) * rad,
        y: h / 2 + Math.sin(ang) * rad,
        vx: 0,
        vy: 0,
        deg: deg[i],
      };
    });
    simRef.current = sim;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = canvas.getContext("2d")!;
    const resize = () => {
      w = wrap.clientWidth || w;
      h = wrap.clientHeight || h;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const colorCache = new Map<string, string>();
    const colorFor = (t: string) => {
      let c = colorCache.get(t);
      if (!c) {
        c = typeColor(t);
        colorCache.set(t, c);
      }
      return c;
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      for (const [a, b] of edgeIdx) {
        ctx.beginPath();
        ctx.moveTo(sim[a].x, sim[a].y);
        ctx.lineTo(sim[b].x, sim[b].y);
        ctx.stroke();
      }
      const hovered = hoverRef.current;
      for (const n of sim) {
        const r = 3 + Math.min(n.deg, 8) * 0.9;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.globalAlpha = hovered && hovered !== n.id ? 0.3 : 1;
        ctx.fillStyle = colorFor(n.type);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (hovered) {
        const n = sim.find((s) => s.id === hovered);
        if (n) {
          ctx.font = "12px ui-sans-serif, system-ui";
          const label = n.title.length > 44 ? n.title.slice(0, 43) + "…" : n.title || "Untitled";
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = "rgba(16,15,22,0.92)";
          ctx.fillRect(n.x + 8, n.y - 10, tw + 12, 20);
          ctx.fillStyle = "rgba(236,236,241,0.95)";
          ctx.fillText(label, n.x + 14, n.y + 4);
        }
      }
    };

    let raf = 0;
    if (prefersReduced()) {
      for (let i = 0; i < 340; i++) tick(sim, edgeIdx, w, h);
      draw();
      const redraw = () => draw();
      wrap.addEventListener("mousemove", redraw);
      wrap.addEventListener("mouseleave", redraw);
      return () => {
        ro.disconnect();
        wrap.removeEventListener("mousemove", redraw);
        wrap.removeEventListener("mouseleave", redraw);
      };
    }

    let ticks = 0;
    const loop = () => {
      if (ticks < 900) tick(sim, edgeIdx, w, h);
      draw();
      ticks++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [nodes, edges]);

  const pick = (clientX: number, clientY: number): Sim | null => {
    const wrap = wrapRef.current;
    const sim = simRef.current;
    if (!wrap || !sim) return null;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: Sim | null = null;
    let bd = 20 * 20;
    for (const n of sim) {
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  };

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center shadow-card font-body text-sm text-muted-foreground">
        Nothing to graph yet — capture a few things and Personal AI links related
        memories automatically.
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-[70vh] w-full overflow-hidden rounded-2xl border border-border bg-[radial-gradient(680px_420px_at_15%_10%,var(--bloom-1),transparent_65%),radial-gradient(600px_460px_at_85%_90%,var(--bloom-2),transparent_65%),var(--color-card)] shadow-card"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-pointer"
        onMouseMove={(e) => {
          hoverRef.current = pick(e.clientX, e.clientY)?.id ?? null;
        }}
        onMouseLeave={() => {
          hoverRef.current = null;
        }}
        onClick={(e) => {
          const n = pick(e.clientX, e.clientY);
          if (n) router.push(`/memory/${n.id}`);
        }}
      />
      <div className="pointer-events-none absolute bottom-3 left-3 font-body text-[11px] text-muted-foreground/70">
        {nodes.length} memories · {edges.length} links · hover to label, click to open
      </div>
    </div>
  );
}
