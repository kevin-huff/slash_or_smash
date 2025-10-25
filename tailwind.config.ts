import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        night: {
          900: '#0A0A12',
        },
        grave: {
          800: '#11121A',
        },
        witchlight: {
          500: '#7E4BFF',
        },
        specter: {
          300: '#BDB7FF',
        },
        bone: {
          100: '#F5F7FF',
        },
        status: {
          ready: '#6C6CFF',
          voting: '#13E2A1',
          locked: '#FFC857',
          results: '#FF4B91',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
