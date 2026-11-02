import { html, svg } from "lit";

const paths: Record<string, string> = {
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18M5 7h14M5 17h14",
  shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3m-4 9 3 3 5-6",
  flag: "M5 21V3h14l-3 4 3 4H5",
  swords:
    "m4 3 12 12m-2 2 4-4m-1 5 3 3M20 3 8 15m2 2-4-4m1 5-3 3M3 3l1 5 4-4m13-1-1 5-4-4",
  crown: "m3 7 4 3 5-6 5 6 4-3-2 12H5L3 7m3 8h12",
  city: "M3 21V9h6V3h6v9h6v9H3m4-8h1m-1 4h1m4-10h1m-1 4h1m-1 4h1m4 1h1",
  port: "M12 3v16M8 6h8M4 13c0 5 3 8 8 8s8-3 8-8m-19 0 3-3 3 3m10 0 3-3 3 3",
  factory: "M3 21V11l6 3V8l6 4V3h4l2 18H3m3-3h2m3 0h2m3 0h2",
  sound: "M4 9h4l5-5v16l-5-5H4V9m13-2c3 3 3 7 0 10m3-13c5 5 5 11 0 16",
  play: "m8 4 12 8-12 8V4",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  bolt: "m14 2-9 12h7l-2 8 9-12h-7l2-8",
};
export function commandIcon(name: string) {
  return html`<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${svg`<path d=${paths[name] ?? paths.globe}/>`}
  </svg>`;
}
