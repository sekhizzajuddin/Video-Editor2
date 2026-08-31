import React from 'react';

interface ProCutLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function ProCutLogo({ size = 'md', showText = true, className = '' }: ProCutLogoProps) {
  const iconDimensions = {
    sm: { width: 22, height: 22 },
    md: { width: 28, height: 28 },
    lg: { width: 38, height: 38 },
  }[size];

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
  }[size];

  return (
    <div className={`flex items-center gap-2 select-none group ${className}`}>
      {/* 3D Ribbon Play Triangle Icon */}
      <svg
        width={iconDimensions.width}
        height={iconDimensions.height}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-sm group-hover:scale-105 transition-transform duration-200"
      >
        <defs>
          {/* Top Line / Top Fold: Gradient of Pink to Red as requested */}
          <linearGradient id="procut-top-fold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />   {/* Vibrant Pink */}
            <stop offset="50%" stopColor="#f43f5e" />  {/* Rose Red */}
            <stop offset="100%" stopColor="#ef4444" /> {/* Bright Red */}
          </linearGradient>

          {/* Right Fold: Gradient of Purple to Electric Blue */}
          <linearGradient id="procut-right-fold" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#a855f7" />  {/* Purple */}
            <stop offset="70%" stopColor="#3b82f6" />  {/* Electric Blue */}
            <stop offset="100%" stopColor="#2563eb" /> {/* Deep Blue */}
          </linearGradient>

          {/* Bottom & Left Fold: Gradient of Electric Blue to Bright Cyan */}
          <linearGradient id="procut-bottom-fold" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="50%" stopColor="#0ea5e9" />  {/* Sky Blue */}
            <stop offset="100%" stopColor="#06b6d4" /> {/* Cyan */}
          </linearGradient>

          {/* Corner highlights and inner shadows */}
          <linearGradient id="procut-highlight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer continuous ribbon geometry */}
        {/* Left vertical arm */}
        <path
          d="M20 18 C20 12 26 8 32 12 L84 44 C90 48 90 54 84 58 L32 90 C26 94 20 90 20 84 Z"
          fill="url(#procut-bottom-fold)"
        />

        {/* Right slanted arm */}
        <path
          d="M84 44 C88 47 88 53 84 56 L42 84 C36 88 28 85 28 78 L72 49 C76 46 76 42 72 40 L40 18 C46 14 54 14 59 17 Z"
          fill="url(#procut-right-fold)"
        />

        {/* Top Fold / Top Line - Vibrant Pink to Red */}
        <path
          d="M20 32 C20 22 28 14 38 14 L80 43 C86 47 86 52 80 56 L68 49 C72 46 72 42 68 40 L34 18 C26 13 20 19 20 28 Z"
          fill="url(#procut-top-fold)"
        />

        {/* Inner cutout highlight for crisp 3D effect */}
        <path
          d="M34 32 L66 50 L34 68 Z"
          fill="white"
          className="dark:fill-[var(--theme-bg-panel)] fill-white transition-colors"
        />

        {/* Top curved bulb glow */}
        <ellipse
          cx="27"
          cy="22"
          rx="9"
          ry="9"
          fill="url(#procut-top-fold)"
        />
        <ellipse
          cx="26"
          cy="20"
          rx="5"
          ry="3"
          fill="url(#procut-highlight)"
        />
      </svg>

      {/* Typography: "Pro" in Red, "Cut" in Pink */}
      {showText && (
        <span className={`font-black tracking-tight font-sans flex items-center ${textSizes}`}>
          <span className="text-red-500 font-extrabold drop-shadow-sm">Pro</span>
          <span className="text-pink-500 font-black tracking-tight">Cut</span>
        </span>
      )}
    </div>
  );
}
