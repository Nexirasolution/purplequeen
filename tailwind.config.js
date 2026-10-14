/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      animation: {
        marquee: 'marquee 22s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%':   { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      colors: {
        // Palette: #4B087A #F7B900 #FFF5E8 #24052F #D9B4E8
        brand: {
          // New names (use these going forward)
          purple: '#4B087A',       // primary brand color (headings, prices, links)
          purpledark: '#36055A',   // darker purple, for hovers (derived)
          gold: '#F7B900',         // buttons and premium details
          golddark: '#D9A000',     // darker gold, for button hovers (derived)
          ivory: '#FFF5E8',        // page background
          lavender: '#D9B4E8',     // borders, soft fills
          ink: '#24052F',          // text, dark sections

          // Legacy names: kept so existing classes like bg-brand-magenta keep working.
          // They now resolve to the new palette.
          teal: '#4B087A',         // was teal primary -> purple
          tealdark: '#36055A',     // was dark teal hover -> dark purple
          cream: '#FFF5E8',        // was cream background -> ivory
          sand: '#D9B4E8',         // was sand borders -> lavender
          magenta: '#4B087A',      // primary -> purple
          rose: '#6B1FA0',         // lighter purple hover (derived)
          pink: '#F7B900',         // accent -> gold
          green: '#8E4FB8',        // mid purple highlight (derived)
          deepgreen: '#4B087A'     // -> purple
        }
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)']
      },
      boxShadow: {
        soft: '0 8px 30px -8px rgba(75,8,122,0.18)'
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
};