export const chartPalette = {
  joint: "hsl(154 61% 37%)",
  discretionary: "hsl(30 93% 52%)",
  sent: "hsl(199 94% 38%)",
  approved: "hsl(154 61% 37%)",
  review: "hsl(219 40% 50%)",
  declined: "hsl(0 72% 51%)",
  grid: "hsl(210 16% 85%)"
};

export const chartText = {
  axis: "hsl(var(--foreground) / 0.72)",
  label: "hsl(var(--foreground) / 0.92)"
};

export const chartTooltip = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid hsl(var(--border))",
    backgroundColor: "hsl(var(--card) / 0.98)",
    color: "hsl(var(--foreground))",
    boxShadow: "0 10px 24px hsl(222 47% 8% / 0.22)",
    padding: "10px 12px"
  },
  labelStyle: {
    color: "hsl(var(--foreground) / 0.72)",
    fontWeight: 600,
    marginBottom: 8
  },
  itemStyle: {
    color: "hsl(var(--foreground))",
    padding: 0,
    margin: 0
  },
  wrapperStyle: {
    outline: "none"
  },
  offset: 12,
  allowEscapeViewBox: {
    x: false,
    y: false
  }
} as const;
