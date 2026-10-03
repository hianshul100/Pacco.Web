/**
 * Pacco.Web design tokens.
 *
 * ⚠️ APPROXIMATED, NOT APPROVED. `STYLE_README.md` and `pacco-material-you.css`
 * are named as the UI foundation by ADR-021 §5 rule 7 but exist nowhere in this
 * workspace (LOW_LEVEL_SPEC-13652-wave-1.md blocker B3). Per §L.12.5 these
 * values are approximated from the supplied reference image
 * `02_login-page-ux.png` and are recorded as approximations -- they are NOT a
 * fabricated stand-in for the approved foundation and must be replaced when the
 * real assets are supplied. See docs/DESIGN_APPROXIMATION.md.
 *
 * LOW_LEVEL_SPEC-13652-wave-2.md §L.12.5 repeats the blocker for the landing
 * screen and requires it to INHERIT these values rather than start a second
 * approximation. The landing screen therefore adds three tokens -- a chip
 * surface, a heading tracking and a card width -- and changes none.
 *
 * Only semantic names are exposed to components; no component uses a raw hex.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand blue ramp, sampled from the cube mark and the primary button.
        brand: {
          50: '#EFF5FE',
          100: '#DCE9FB',
          200: '#BBD4F7',
          300: '#8FB8F1',
          400: '#5E95E9',
          500: '#2E6FE0',
          600: '#1F5FD0',
          700: '#1A4FB0',
          800: '#163F8C',
          900: '#12306B',
        },
        // Neutral ink ramp, sampled from the wordmark and body copy.
        ink: {
          400: '#8794A8',
          500: '#5A6B85',
          600: '#44546E',
          700: '#24344F',
          800: '#18293F',
          900: '#10233F',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F7FAFE',
          sunken: '#EEF4FC',
          // The landing screen's role chip, sampled from
          // `03_welcome-page-ux.png`. It sits between `brand.50` and
          // `brand.100`, so it is named for its role rather than forced onto
          // either rung of the ramp.
          chip: '#E6EEFD',
        },
        border: {
          DEFAULT: '#DCE4EF',
          strong: '#C3CFDF',
        },
        danger: {
          50: '#FDF2F2',
          200: '#F5C6C6',
          600: '#C02B2B',
          700: '#9F2121',
        },
        notice: {
          50: '#FFF8EB',
          200: '#F3DCA8',
          700: '#8A5B10',
        },
        // The two concentric decorative arcs in the reference's bottom-left
        // corner, sampled where each crosses the page's left edge.
        arc: {
          outer: '#DFEBFE',
          inner: '#CFE1FC',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '1.5rem',
        field: '0.75rem',
        pill: '9999px',
      },
      boxShadow: {
        card: '0 24px 60px -24px rgba(16, 35, 63, 0.22), 0 2px 8px rgba(16, 35, 63, 0.05)',
        field: '0 1px 2px rgba(16, 35, 63, 0.04)',
      },
      letterSpacing: {
        // The landing heading is set tighter than any Tailwind step. The comp's
        // display face is not one of the families the app can ship, so the
        // tracking is what brings the rendered line to the comp's own measure
        // (478px at the native 1448px page width) rather than a taste choice.
        'landing-heading': '-0.068em',
      },
      maxWidth: {
        // The login card's width in the reference image, 563px at its native
        // 1448px page width.
        card: '35.2rem',
        // The landing card is wider: 642px at the same native page width in
        // `03_welcome-page-ux.png`.
        'landing-card': '40.125rem',
      },
      screens: {
        // The spec's single documented breakpoint
        // (SPECIFICATION.md §11.2: "single-column below 768px").
        md: '768px',
      },
    },
  },
  plugins: [],
}
