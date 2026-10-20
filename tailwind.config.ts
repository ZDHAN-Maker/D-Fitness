import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const hsl = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border: hsl('border'),
        input: hsl('input'),
        ring: hsl('ring'),
        background: hsl('background'),
        foreground: hsl('foreground'),
        primary: { DEFAULT: hsl('primary'), foreground: hsl('primary-foreground') },
        secondary: { DEFAULT: hsl('secondary'), foreground: hsl('secondary-foreground') },
        muted: { DEFAULT: hsl('muted'), foreground: hsl('muted-foreground') },
        accent: { DEFAULT: hsl('accent'), foreground: hsl('accent-foreground') },
        destructive: { DEFAULT: hsl('destructive'), foreground: hsl('destructive-foreground') },
        card: { DEFAULT: hsl('card'), foreground: hsl('card-foreground') },
        // Data colours: one per metric, reused by every chart and progress bar.
        protein: hsl('protein'),
        carbs: hsl('carbs'),
        fat: hsl('fat'),
        fiber: hsl('fiber'),
        water: hsl('water'),
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      fontFamily: {
        sans: ['"Figtree Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"Figtree Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [animate],
};

export default config;
