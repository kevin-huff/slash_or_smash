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
          900: '#0E1C14',
        },
        grave: {
          800: '#123427',
        },
        witchlight: {
          400: '#36996B',
          500: '#2B7A55',
        },
        specter: {
          300: '#C8E0D0',
        },
        bone: {
          100: '#F6F3E4',
        },
        status: {
          ready: '#4FA387',
          voting: '#F7D774',
          locked: '#E7683C',
          results: '#D64545',
        },
        snow: '#F6F3E4',
        frost: '#C8E0D0',
        ember: '#D64545',
        gold: '#F7D774',
        pine: '#0E1C14',
      },
    },
  },
  plugins: [],
} satisfies Config;
