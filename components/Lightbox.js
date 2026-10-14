'use client';

import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X } from 'lucide-react';

// Palette: #4B087A #F7B900 #FFF5E8 #24052F #D9B4E8
const PAPER = '#FFF5E8';

export default function Lightbox({ src, onClose }) {
  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ background: 'rgba(36,5,47,0.88)', zIndex: 10000 }}
    >
      <div className="relative w-full max-w-md aspect-square" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-11 right-0 sm:-top-2 sm:-right-11 w-9 h-9 flex items-center justify-center rounded-full"
          style={{ background: 'rgba(255,245,232,0.15)', color: PAPER }}
          aria-label="Close"
        >
          <X size={20} />
        </button>
        <Image src={src} alt="Review image" fill className="object-contain" sizes="(max-width:640px) 90vw, 448px" />
      </div>
    </div>,
    document.body
  );
}