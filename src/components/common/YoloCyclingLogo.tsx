import React from 'react';

export interface YoloCyclingLogoProps {
  className?: string;
  size?: number;
  /**
   * 'glyph': pure vector mark inheriting text-color (for navbar, inline labels, badges).
   * 'badge': full Apple HIG squircle icon with vibrant chili gradient & drop shadow.
   */
  variant?: 'glyph' | 'badge';
}

export type LaBaoLogoProps = YoloCyclingLogoProps;

/**
 * YoloCycling Official Logo
 * Concept A: 「破风辣堡 The Aero Spicy Burger」
 * Fusion of road cycling high-wattage chainring & aerodynamic helmet airflow with the iconic energy burger.
 */
export const YoloCyclingLogo: React.FC<YoloCyclingLogoProps> = ({
  className = 'w-5 h-5',
  size,
  variant = 'glyph',
}) => {
  const style = size ? { width: size, height: size } : undefined;

  if (variant === 'badge') {
    return (
      <svg
        viewBox="0 0 512 512"
        className={className}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="YoloCycling Logo"
      >
        <defs>
          {/* Spicy Chili Gradient (Chili Red to Energetic Neon Orange) */}
          <linearGradient id="yoloBadgeBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF3B30" />
            <stop offset="50%" stopColor="#FF5E3A" />
            <stop offset="100%" stopColor="#FF9500" />
          </linearGradient>

          {/* iOS 18 Drop Shadow */}
          <filter id="yoloBadgeShadow" x="-10%" y="-10%" width="125%" height="125%">
            <feDropShadow dx="0" dy="16" stdDeviation="20" floodColor="#8B1D00" floodOpacity="0.45" />
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#8B1D00" floodOpacity="0.25" />
          </filter>

          {/* Crisp Specular Glow on Emblem */}
          <filter id="yoloGlyphGlow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#6B0A00" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Continuous iOS 18 Squircle */}
        <rect
          x="0"
          y="0"
          width="512"
          height="512"
          rx="112"
          fill="url(#yoloBadgeBg)"
        />

        {/* Top Specular Highlight Line */}
        <line
          x1="0"
          y1="3"
          x2="512"
          y2="3"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeOpacity="0.4"
        />

        {/* The Aero Spicy Burger Emblem (Scaled up to 512 space) */}
        <g filter="url(#yoloGlyphGlow)" transform="translate(56, 56) scale(4)" fill="#FFFFFF">
          {/* 1. TOP BUN (Aero Road Helmet Arc) */}
          <path
            d="M 22 41 C 22 22, 38 16, 50 16 C 62 16, 78 22, 78 41 C 78 43.5, 75.5 44.5, 73 44.5 L 27 44.5 C 24.5 44.5, 22 43.5, 22 41 Z"
            fill="#FFFFFF"
          />

          {/* Aero Helmet Wind Vents / Golden Sesame Seeds */}
          <ellipse cx="36" cy="28" rx="3.2" ry="1.4" transform="rotate(-22 36 28)" fill="url(#yoloBadgeBg)" />
          <ellipse cx="49" cy="24" rx="3.5" ry="1.5" transform="rotate(-3 49 24)" fill="url(#yoloBadgeBg)" />
          <ellipse cx="63" cy="27" rx="3.2" ry="1.4" transform="rotate(18 63 27)" fill="url(#yoloBadgeBg)" />
          <ellipse cx="42" cy="35" rx="3" ry="1.3" transform="rotate(-15 42 35)" fill="url(#yoloBadgeBg)" opacity="0.85" />
          <ellipse cx="57" cy="35" rx="3" ry="1.3" transform="rotate(12 57 35)" fill="url(#yoloBadgeBg)" opacity="0.85" />

          {/* 2. MIDDLE LAYER: Road Chainring Gear Teeth & Speed Streaks */}
          {/* Speed Wake Left */}
          <path d="M 6 49.5 L 18 49.5" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 10 54 L 18 54" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          {/* Speed Wake Right */}
          <path d="M 82 49.5 L 94 49.5" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 82 54 L 90 54" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />

          {/* Main Gear Patty Body with Chainring Teeth */}
          <path
            d="M 19 50 L 22 46.5 L 25.5 46.5 L 27.5 50 L 31 46.5 L 34.5 46.5 L 36.5 50 L 40 46.5 L 43.5 46.5 L 45.5 50 L 49 46.5 L 52.5 46.5 L 54.5 50 L 58 46.5 L 61.5 46.5 L 63.5 50 L 67 46.5 L 70.5 46.5 L 72.5 50 L 76 46.5 L 79.5 46.5 L 81 50 L 81 55 L 79.5 57.5 L 76 57.5 L 74 55 L 70.5 57.5 L 67 57.5 L 65 55 L 61.5 57.5 L 58 57.5 L 56 55 L 52.5 57.5 L 49 57.5 L 47 55 L 43.5 57.5 L 40 57.5 L 38 55 L 34.5 57.5 L 31 57.5 L 29 55 L 25.5 57.5 L 22 57.5 L 19 55 Z"
            fill="#FFFFFF"
          />

          {/* Chainring BCD Hollow Center & Spider Holes */}
          <circle cx="50" cy="51.5" r="3.2" fill="url(#yoloBadgeBg)" />
          <circle cx="36" cy="51.5" r="2" fill="url(#yoloBadgeBg)" />
          <circle cx="64" cy="51.5" r="2" fill="url(#yoloBadgeBg)" />

          {/* Dynamic Spicy Melt / Flame Drop */}
          <path
            d="M 68 56 Q 71 61.5 73.5 62 Q 75.5 61 76 56 Z"
            fill="#FFFFFF"
          />

          {/* 3. BOTTOM BUN (Deep Section Rim Profile) */}
          <path
            d="M 24 60.5 L 76 60.5 C 78.5 60.5, 79.5 62, 78.5 64.5 C 76.5 72.5, 66 78, 50 78 C 34 78, 23.5 72.5, 21.5 64.5 C 20.5 62, 21.5 60.5, 24 60.5 Z"
            fill="#FFFFFF"
          />

          {/* 4. Lower Ground-Effect Aero Diffusers */}
          <path d="M 32 83 L 68 83" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
          <path d="M 40 87.5 L 60 87.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </g>
      </svg>
    );
  }

  // Standalone vector glyph (optimized for 16px - 48px rendering, inherits text-color)
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={style}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="YoloCycling Logo"
    >
      {/* 1. TOP BUN (Aero Road Helmet Arc) */}
      <path
        d="M 22 41 C 22 22, 38 16, 50 16 C 62 16, 78 22, 78 41 C 78 43.5, 75.5 44.5, 73 44.5 L 27 44.5 C 24.5 44.5, 22 43.5, 22 41 Z"
      />

      {/* Aero Vents */}
      <ellipse cx="36" cy="28" rx="3.2" ry="1.4" transform="rotate(-22 36 28)" fill="var(--card-bg, #FFFFFF)" opacity="0.9" />
      <ellipse cx="49" cy="24" rx="3.5" ry="1.5" transform="rotate(-3 49 24)" fill="var(--card-bg, #FFFFFF)" opacity="0.9" />
      <ellipse cx="63" cy="27" rx="3.2" ry="1.4" transform="rotate(18 63 27)" fill="var(--card-bg, #FFFFFF)" opacity="0.9" />

      {/* 2. MIDDLE LAYER: Road Chainring Gear Teeth & Speed Streaks */}
      <path d="M 7 49.5 L 18 49.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 11 54 L 18 54" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 82 49.5 L 93 49.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 82 54 L 89 54" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />

      <path
        d="M 19 50 L 22 46.5 L 25.5 46.5 L 27.5 50 L 31 46.5 L 34.5 46.5 L 36.5 50 L 40 46.5 L 43.5 46.5 L 45.5 50 L 49 46.5 L 52.5 46.5 L 54.5 50 L 58 46.5 L 61.5 46.5 L 63.5 50 L 67 46.5 L 70.5 46.5 L 72.5 50 L 76 46.5 L 79.5 46.5 L 81 50 L 81 55 L 79.5 57.5 L 76 57.5 L 74 55 L 70.5 57.5 L 67 57.5 L 65 55 L 61.5 57.5 L 58 57.5 L 56 55 L 52.5 57.5 L 49 57.5 L 47 55 L 43.5 57.5 L 40 57.5 L 38 55 L 34.5 57.5 L 31 57.5 L 29 55 L 25.5 57.5 L 22 57.5 L 19 55 Z"
      />

      <circle cx="50" cy="51.5" r="3" fill="var(--card-bg, #FFFFFF)" />
      <circle cx="36" cy="51.5" r="1.8" fill="var(--card-bg, #FFFFFF)" />
      <circle cx="64" cy="51.5" r="1.8" fill="var(--card-bg, #FFFFFF)" />

      {/* Spicy Flame Drop */}
      <path
        d="M 68 56 Q 71 61.5 73.5 62 Q 75.5 61 76 56 Z"
      />

      {/* 3. BOTTOM BUN */}
      <path
        d="M 24 60.5 L 76 60.5 C 78.5 60.5, 79.5 62, 78.5 64.5 C 76.5 72.5, 66 78, 50 78 C 34 78, 23.5 72.5, 21.5 64.5 C 20.5 62, 21.5 60.5, 24 60.5 Z"
      />

      {/* 4. Lower Ground Diffusers */}
      <path d="M 32 83 L 68 83" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <path d="M 40 87.5 L 60 87.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
};

export const LaBaoLogo = YoloCyclingLogo;
export default YoloCyclingLogo;
