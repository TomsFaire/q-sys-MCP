/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
      fontSize: {
        'page': ['22px', { lineHeight: '32px' }],
        'section': ['22px', { lineHeight: '32px' }],
        'body': ['14px', { lineHeight: '20px', letterSpacing: '0.15px' }],
        'label': ['12px', { lineHeight: '16px', letterSpacing: '0.15px' }],
      },
      colors: {
        faire: {
          page: '#f5f5f5',
          card: '#ffffff',
          secondary: '#fbfbfb',
          tertiary: '#f7f7f7',
          neutral: '#fbf8f6',
          border: '#dfe0e1',
          'border-strong': '#757575',
          text: '#333333',
          subdued: '#757575',
          inverse: '#ffffff',
          action: '#333333',
          'action-hover': '#000000',
          focus: '#275ec5',
          overlay: 'rgba(51, 51, 51, 0.5)',
          'neutral-mid': '#b5a998',
          'neutral-dark': '#585550',
          error: {
            DEFAULT: '#921100',
            surface: '#f2e5e1',
            border: '#d17e70',
            text: '#921100',
          },
          warning: {
            surface: '#f6efdb',
            border: '#d1b985',
            text: '#907c3a',
          },
          success: {
            surface: '#e9f1e5',
            border: '#91a793',
            text: '#49694c',
          },
          info: {
            surface: '#e2e7f0',
            border: '#7a7885',
            text: '#1b2834',
          },
        },
      },
      borderRadius: {
        'faire-sm': '4px',
        'faire-md': '8px',
        'faire-lg': '16px',
        'faire-xl': '24px',
      },
      boxShadow: {
        'faire-card': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'faire-card-hover': '0 4px 16px rgba(0, 0, 0, 0.08)',
      },
      maxWidth: {
        'page': '1440px',
        'content': '1280px',
      },
      spacing: {
        18: '72px',
      },
    },
  },
  plugins: [],
}
