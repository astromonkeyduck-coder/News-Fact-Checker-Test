import type { Config } from "tailwindcss";

/**
 * Tactical newsroom design tokens.
 * Near-black/charcoal canvas, graphite panels, white/gray text,
 * red/orange reserved strictly for urgency + risk.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0a0b0d",
        surface: "#121417",
        panel: "#181b1f",
        "panel-raised": "#1f2329",
        border: "#2a2f36",
        "border-strong": "#3a414a",
        ink: "#f4f6f8",
        "ink-muted": "#a7afba",
        "ink-faint": "#6b7480",
        // Urgency / risk accents only.
        urgent: "#ff3b30",
        "urgent-soft": "#3a1512",
        warn: "#ff9500",
        "warn-soft": "#3a2710",
        ok: "#34c759",
        "ok-soft": "#103021",
        info: "#5ac8fa",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.9rem" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
