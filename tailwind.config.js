/** @type {import('tailwindcss').Config} */

/* Fog-family status palette — every status hue is desaturated toward the
   atmosphere so no single element screams. Shades are a small HSL ladder
   around the anchor (400) used across the design system. */
const fog = (h, s, l) => {
  const stop = (dl, ds = 0) =>
    `hsl(${h} ${Math.max(8, s + ds)}% ${Math.min(96, Math.max(8, l + dl))}%)`;
  return {
    100: stop(26, -8),
    200: stop(18, -6),
    300: stop(9, -3),
    400: stop(0),
    500: stop(-8),
    600: stop(-16),
    700: stop(-24),
    800: stop(-32),
    900: stop(-40),
    950: stop(-46),
  };
};

module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f5f6f8",
        /* remap status hues to the desaturated fog family */
        emerald: fog(155, 38, 64),  /* sage         ≈ rgb(126 200 169) at 400 */
        amber: fog(39, 67, 68),     /* dusty gold   ≈ rgb(229 190 120) at 400 */
        rose: fog(353, 63, 72),     /* muted coral  ≈ rgb(229 138 148) at 400 */
        cyan: fog(197, 46, 69),     /* mist blue    ≈ rgb(138 192 214) at 400 */
        sky: fog(197, 46, 69),
        violet: fog(259, 44, 74),   /* dusty violet ≈ rgb(178 160 218) at 400 */
        lime: fog(155, 38, 64),
        teal: fog(168, 36, 66),
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)",
      },
    },
  },
  plugins: [],
};
