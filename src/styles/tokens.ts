export const palette = {
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
} as const;

export const fonts = {
  primary: "'Chakra Petch', 'Space Grotesk', system-ui, sans-serif",
  display: "'Creepster', 'Chakra Petch', system-ui, sans-serif",
} as const;

export const elevation = {
  overlay: '0 25px 45px rgba(0, 0, 0, 0.45)',
};

export type Palette = typeof palette;
