# Vice Verse Admin Portal - Design System & Guidelines

This document outlines the complete design system, aesthetic guidelines, and UI/UX behaviors for the Vice Verse Admin Portal. All development teams must adhere to these specifications to maintain visual consistency across the platform.

## 1. Core Aesthetic
**Theme:** Cyberpunk / Neon Synthwave (GTA Vice City Inspired)
The overall feel should be dark, highly technical, and sleek, heavily utilizing neon glows against deep dark backgrounds. Interfaces should feel like a high-tech hacker terminal blended with a neon-lit dashboard.

## 2. Color Palette
All UI components should strictly use the defined CSS variables located in `globals.css` and the configured Tailwind theme.

- **Background (`--bg-color`)**: `#050508` (Deep void black)
- **Surface/Cards (`--surface-color`)**: `#111114` (Elevated dark gray)
- **Primary Accent (`--accent-primary`)**: `#FBC815` (Neon Yellow/Gold - Used for warnings, key highlights, and primary actions)
- **Secondary Accent (`--accent-secondary`)**: `#FF007F` (Neon Pink - Used for active states, sidebar highlights, and active portals)
- **Tertiary Accent (`--accent-tertiary`)**: `#00F0FF` (Cyan - Used for secondary data points and futuristic contrast)
- **Border (`--border-color`)**: `rgba(255, 255, 255, 0.1)` (Subtle glassmorphic outlines)
- **Primary Text (`--text-primary`)**: `#F5F5F7` (Off-white for readability)
- **Secondary Text (`--text-secondary`)**: `#A1A1AA` (Muted gray for labels and inactive elements)

## 3. Typography
The application uses Google Fonts to achieve a high-tech aesthetic.

- **Headings (Orbitron):** Used exclusively for large titles, portal headers, and major numbers. Conveys a bold, sci-fi tone.
- **Data & UI Text (Rajdhani):** The standard body font. Highly legible but retains a squared, technical feel.
- **Monospace/Accents (Share Tech Mono):** Used for version numbers, "MAIN MENU" labels, and small technical details (e.g., table headers).

*Note: The legacy 'Pricedown' font has been retired in favor of the cleaner 'Orbitron' to ensure consistent rendering of numeric data and professional readability.*

## 4. UI Components & Layouts

### 4.1. Navigation Sidebar
- **Inactive Links:** Text is muted (`text-secondary`). On hover, the link gently slides to the right (`hover:pl-6`) and gains a subtle white/gray glow.
- **Active Links:** 
  - Receives a neon pink gradient background (`bg-gradient-to-r from-[rgba(255,0,127,0.15)]`).
  - Has a solid pink left border (`border-l-[3px]`).
  - Emits a substantial outer pink glow and a subtle inset pink glow using `shadow-[]`.
  - The icon and text emit a strong pink `drop-shadow`.
  - Text actively flickers using the `.animate-flicker` animation.
- **Footer Logos:** 
  - **VVCE Logo** (Top-aligned, Yellow glow).
  - **IVC Logo** (Bottom Left, Pink glow) and **InUnity Logo** (Bottom Right, Cyan glow) flanking a perfectly geometrically centered 'x' character.

### 4.2. Dashboard Stat Cards
- **Background:** Solid surface color with subtle border.
- **Hover State:** Card lifts slightly (`-translate-y-1`), border glows pink, and a soft pink drop shadow illuminates the card.
- **Icons:** Wrapped in a rounded square (`w-14 h-14`) with a tinted background and matching text color.

### 4.3. Data Tables (Glass Panels)
- Tables are wrapped in a `.glass-panel` container with heavy backdrop blurs.
- Headers are uppercase, tracking-wide, and colored with primary yellow.
- Rows have a subtle transition and hover effect (`hover:bg-white/5`).

## 5. Animations & Micro-interactions
Motion is critical to making the application feel responsive and "alive".

- **`.animate-fade-in`**: A smooth slide-up and fade-in effect. Applied heavily on page load with staggered delays (`animate-delay-1`, `animate-delay-2`, etc.) to create a cascading entrance.
- **`.animate-flicker`**: A continuous, random opacity flicker applied to active text (simulating a buzzing neon sign).
- **`.animate-glow`**: A continuous pulsing box-shadow. *Crucial Note: Do not apply this class directly to `<svg>` elements, as it will render a square block shadow. Use drop-shadow filters for SVGs instead.*

## 6. Implementation Rules
1. **Tailwind First:** Use Tailwind utility classes for all layout, spacing, and standard colors.
2. **Glows:** Use CSS `filter: drop-shadow(...)` for text, SVGs, and transparent PNGs. Use `box-shadow` or Tailwind `shadow-[]` only for block-level DOM elements (like cards and buttons).
3. **Tech Stack Enforcement:** Stick strictly to Next.js, Tailwind CSS, shadcn/ui, and TypeScript. All five development teams must adhere to this architecture.
