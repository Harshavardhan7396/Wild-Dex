import React from 'react';

interface WildDexLogoProps {
  className?: string;
  size?: number | string;
}

export const WildDexLogo: React.FC<WildDexLogoProps> = ({
  className = 'w-full h-full',
  size,
}) => {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="WildDex Logo"
      role="img"
    >
      {/* 1. Outer Translucent Atmospheric Ring */}
      <circle cx="200" cy="200" r="176" fill="#E1F2E8" fillOpacity="0.82" />

      {/* 2. Middle Planetary Orbit Ring */}
      <circle cx="200" cy="200" r="151" fill="#A8DDC2" />

      {/* 3. Dark Forest Core Biosphere */}
      <circle cx="200" cy="200" r="113" fill="#184A35" />

      {/* 4. Ambient Planetary Continental Orbs */}
      <circle cx="190" cy="170" r="32" fill="#367758" fillOpacity="0.85" />
      <circle cx="228" cy="222" r="28" fill="#2E6D4E" fillOpacity="0.85" />

      {/* 5. Celestial Orbital Latitude & Longitude Coordinate Lines */}
      {/* Meridian Longitude Ellipse */}
      <ellipse
        cx="200"
        cy="200"
        rx="61"
        ry="109"
        fill="none"
        stroke="#52B788"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Equator Dashed Latitude Ellipse */}
      <ellipse
        cx="200"
        cy="200"
        rx="79"
        ry="19"
        fill="none"
        stroke="#52B788"
        strokeWidth="2.5"
        strokeDasharray="5.5 5.5"
      />

      {/* 6. Biodiversity Life Kingdoms Perimeter Icons */}

      {/* A. Top: Avian Life (Bird in Flight) at (200, 48) */}
      <path
        d="M 168 41 C 182 41 193 50 200 60 C 207 50 218 41 232 41 C 220 49 209 56 200 66 C 191 56 180 49 168 41 Z"
        fill="#DDF5E6"
      />

      {/* B. Top-Right: Insecta Life (Butterfly) at (310, 110) */}
      <g transform="translate(310, 110) rotate(15)">
        {/* Upper Left Wing */}
        <ellipse cx="-11" cy="-7" rx="9" ry="6" transform="rotate(-30 -11 -7)" fill="#DDF5E6" />
        {/* Upper Right Wing */}
        <ellipse cx="11" cy="-7" rx="9" ry="6" transform="rotate(30 11 -7)" fill="#DDF5E6" />
        {/* Lower Left Wing */}
        <ellipse cx="-8" cy="6" rx="7" ry="5" transform="rotate(20 -8 6)" fill="#DDF5E6" />
        {/* Lower Right Wing */}
        <ellipse cx="8" cy="6" rx="7" ry="5" transform="rotate(-20 8 6)" fill="#DDF5E6" />
        {/* Butterfly Slender Body */}
        <ellipse cx="0" cy="0" rx="2" ry="9" fill="#A8DDC2" />
      </g>

      {/* C. Bottom-Right: Plantae / Flora (5-Petal Flower) at (320, 275) */}
      <g transform="translate(320, 275)">
        {/* 5 Rounded Petals */}
        <circle cx="0" cy="-8" r="5.5" fill="#DDF5E6" />
        <circle cx="7.6" cy="-2.5" r="5.5" fill="#DDF5E6" />
        <circle cx="4.7" cy="6.5" r="5.5" fill="#DDF5E6" />
        <circle cx="-4.7" cy="6.5" r="5.5" fill="#DDF5E6" />
        <circle cx="-7.6" cy="-2.5" r="5.5" fill="#DDF5E6" />
        {/* Golden Nectar Floral Center */}
        <circle cx="0" cy="0" r="4.2" fill="#F4D39D" />
      </g>

      {/* D. Bottom: Aquatic / Marine Life (Fish) at (200, 345) */}
      <g transform="translate(200, 345)">
        {/* Streamlined Body */}
        <path
          d="M -22 0 C -12 -9 14 -8 26 0 C 14 8 -12 9 -22 0 Z"
          fill="#DDF5E6"
        />
        {/* Triangular Tail Fin */}
        <path
          d="M -20 0 L -30 -7 L -27 0 L -30 7 Z"
          fill="#DDF5E6"
        />
        {/* Fish Eye */}
        <circle cx="16" cy="-1.5" r="2.2" fill="#184A35" />
      </g>

      {/* E. Left: Flora Pod / Seed Specimen at (78, 200) */}
      <g transform="translate(78, 200)">
        {/* Pod Body */}
        <ellipse cx="0" cy="0" rx="16" ry="23" fill="#DDF5E6" />
        {/* Inner Germination Slit */}
        <line
          x1="0"
          y1="-13"
          x2="0"
          y2="13"
          stroke="#184A35"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};
