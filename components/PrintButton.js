'use client';

// Palette: #4B087A #F7B900 #FFF5E8 #24052F #D9B4E8
const GOLD = '#F7B900'; // buttons
const INK = '#24052F';  // deep purple text on gold

export default function PrintButton({ label = 'Print / Save as PDF' }) {
  return (
    <div className="text-center mt-6 print:hidden">
      <button
        onClick={() => window.print()}
        className="rounded-full px-7 py-2.5 text-sm font-semibold tracking-wide transition hover:brightness-95"
        style={{ background: GOLD, color: INK }}
      >
        {label}
      </button>
    </div>
  );
}