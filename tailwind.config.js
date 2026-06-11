/** @type {import('tailwindcss').Config} */

/* Luminous status palette — glass-lit hues that bloom against the living
   sky without screaming. Shades are a small HSL ladder around the anchor
   (400) used across the design system. */
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
        /* remap status hues to the luminous glass-lit family */
        emerald: fog(156, 62, 65),  /* living emerald ≈ rgb(110 222 178) at 400 */
        amber: fog(39, 86, 69),     /* warm gold      ≈ rgb(244 196 110) at 400 */
        rose: fog(351, 85, 76),     /* coral          ≈ rgb(246 142 158) at 400 */
        cyan: fog(200, 71, 71),     /* sky blue       ≈ rgb(126 200 236) at 400 */
        sky: fog(200, 71, 71),
        violet: fog(260, 72, 79),   /* violet         ≈ rgb(188 162 240) at 400 */
        lime: fog(156, 62, 65),
        teal: fog(172, 58, 66),
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)",
      },
    },
  },
  plugins: [],
};
