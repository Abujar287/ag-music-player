import React from 'react';
import scenicDeepBlueBg from '../assets/images/scenic_deep_blue_bg_1795444292672.jpg';

interface ScenicBackdropProps {
  className?: string;
}

export const ScenicBackdrop: React.FC<ScenicBackdropProps> = ({ className = 'fixed inset-0 z-0' }) => {
  return (
    <div aria-hidden="true" className={`${className} pointer-events-none overflow-hidden`}>
      <img
        src={scenicDeepBlueBg}
        alt=""
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover object-center"
      />
      <div
        className="absolute inset-0 transition-colors duration-300"
        style={{
          backgroundColor: 'var(--scenic-via, rgba(7, 24, 54, 0.72))',
        }}
      />
    </div>
  );
};
