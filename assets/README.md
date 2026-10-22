# Design & Media Assets Repository

This directory archives all source graphics, branding assets, vector artworks, font packages, and screenshots used across the IVC-PULSE project.

---

## 📁 Directory Structure

```
assets/
├── branding/
│   ├── vice-verse-logo.png       # Vice Verse Ideathon high-resolution transparent emblem
│   ├── vvce-logo-720x445.png     # Vidyavardhaka College of Engineering official emblem
│   └── inunity-logo.png          # InUnity Partner official brand mark
│
├── vectors/
│   ├── neon-divider.svg          # Cyberpunk horizontal glowing neon partition
│   └── synthwave-sun.svg         # Retrowave gradient sun backdrop vector
│
├── screenshots/
│   └── dashboard-preview.png     # Visual preview of the dark neon dashboard console
│
└── fonts/
    ├── pricedown.zip             # Original font archive package for Pricedown
    ├── Typodermic-Desktop-EULA-2026.pdf  # Desktop font license agreement
    └── read-this.html            # Font specification and typography specimen
```

---

## 💡 Important Distinction: `assets/` vs `public/`

- **`assets/` (This Directory)**: Raw design files, source artwork, licensing documentation, and archived packages. These files are stored for developer reference, branding guidelines, and version control. They are **not** bundled or exposed via web requests.
- **`public/` ([`public/`](../public/))**: Production web assets that are directly served over HTTP by Next.js at runtime (e.g. `https://domain.com/ivc-gear-logo.png`).
