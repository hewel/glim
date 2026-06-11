---
name: Nexus Terminal
colors:
  surface: '#fbf8ff'
  surface-dim: '#dbd8e4'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f2fe'
  surface-container: '#efecf8'
  surface-container-high: '#e9e7f2'
  surface-container-highest: '#e3e1ec'
  on-surface: '#1b1b23'
  on-surface-variant: '#454654'
  inverse-surface: '#303038'
  inverse-on-surface: '#f2effb'
  outline: '#767686'
  outline-variant: '#c6c5d7'
  surface-tint: '#434cd7'
  primary: '#4049d4'
  on-primary: '#ffffff'
  primary-container: '#5a64ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#bec2ff'
  secondary: '#555a92'
  on-secondary: '#ffffff'
  secondary-container: '#bbbffe'
  on-secondary-container: '#484c83'
  tertiary: '#8d4b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#b15f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#bec2ff'
  on-primary-fixed: '#00016d'
  on-primary-fixed-variant: '#272fbf'
  secondary-fixed: '#e0e0ff'
  secondary-fixed-dim: '#bec2ff'
  on-secondary-fixed: '#11144a'
  on-secondary-fixed-variant: '#3e4278'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77e'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#fbf8ff'
  on-background: '#1b1b23'
  surface-variant: '#e3e1ec'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.05em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
---

## Brand & Style

The design system embodies a "High-Resolution Technical" aesthetic, adapted for a clean, professional light-mode environment. It targets a sophisticated user base—engineers, analysts, and system architects—who require clarity and precision. 

The visual style is a hybrid of **Minimalism** and **Modern Corporate**, utilizing heavy whitespace to reduce cognitive load while maintaining technical authority through structured layouts and monospaced accents. The emotional response should be one of "controlled efficiency"—a workspace that feels airy and light yet retains the rigorous density of a terminal interface. All elements prioritize legibility, utilizing subtle borders and structural alignment over heavy shadows or decorative flourishes.

## Colors

The palette is centered on a "Clinical Light" foundation. The background uses a neutral, high-brightness gray to reduce eye strain, while primary surfaces are elevated using pure white with thin, defined borders.

- **Primary Violet-Indigo (#5d67f1):** Used for high-intent actions, active states, and focus indicators. It provides a striking contrast against the light surfaces while maintaining professional authority.
- **Surface Tiers:** Backgrounds start at `#fbf8ff`. Secondary containers (sidebars, secondary panels) use `#efecf9`. Primary cards and modals use `#ffffff`.
- **Text Hierarchy:** A deep neutral slate (`#1a1b23`) is used for primary content to ensure maximum contrast, while mid-tones like `#464654` provide a clear distinction for meta-data and supporting text.
- **Accents:** Secondary slate blue (`#6e72ac`) and tertiary amber (`#c86c00`) are used to categorize data and provide functional variance in complex interfaces.

## Typography

Typography is used to reinforce the technical nature of the design system. We utilize a three-font strategy:

1.  **Geist (Headlines):** A technical Sans-Serif that provides a sharp, geometric feel for titles.
2.  **Inter (Body):** A highly legible workhorse for all long-form content and UI controls, ensuring clarity at small sizes.
3.  **JetBrains Mono (Labels/Data):** Reserved for status badges, IDs, code snippets, and button labels to inject the "Terminal" personality without sacrificing professional polish.

All typography uses a slightly tightened letter spacing for headings to maintain a modern, dense look. Mobile headers should scale down by roughly 20% (e.g., `headline-lg` becomes 24px) to ensure no awkward wrapping on small viewports.

## Layout & Spacing

This design system follows a **Fixed-Fluid Hybrid** model. Main application dashboards use a 12-column fluid grid to maximize data visibility, while content-heavy pages (documentation, settings) are capped at a 1280px container width.

- **Rhythm:** An 8px base grid is used for all layout decisions, with a 4px sub-grid for internal component spacing (e.g., label-to-input distance).
- **Margins:** Desktop views utilize 24px gutters and margins. On mobile, margins shrink to 16px to conserve horizontal space.
- **Density:** Elements are spaced with "Technical Density"—enough room to breathe, but tight enough to feel like a powerful tool rather than a consumer landing page.

## Elevation & Depth

In this light-themed system, depth is conveyed through **Low-contrast Outlines** and **Tonal Layering** rather than traditional shadows. 

- **Level 0 (Base):** `#fbf8ff` background.
- **Level 1 (Card/Surface):** `#ffffff` with a 1px solid border of `#c7c5d6`. No shadow.
- **Level 2 (Active/Hover):** A very soft, diffused shadow is applied only when an element is interactive or needs to float above the primary surface (like a dropdown).
- **Level 3 (Modals):** High-contrast border (`#777685`) and a 16px blur backdrop filter to focus user attention.

Avoid using shadows on static items to maintain the "flat-technical" aesthetic. Use background color shifts (e.g., shifting from white to `#efecf9`) to denote hierarchy.

## Shapes

The design system utilizes **Pill-shaped** geometry. While the aesthetic remains technical and engineered, the use of larger radii provides a modern, high-end software feel that softens the rigorous grid.

- **Standard Elements:** Buttons, inputs, and small cards use a `1rem` (16px) radius.
- **Large Containers:** Modals and main content areas use a `2rem` (32px) radius.
- **Data Elements:** Status badges and chips utilize full-pill radii to distinguish them from interactive buttons.

## Components

- **Buttons:** Primary buttons use a solid Violet-Indigo background with white text. Secondary buttons are outlined with a 1px border of `#c7c5d6` and secondary slate text. Always use JetBrains Mono for button labels in uppercase for a technical vibe.
- **Inputs:** Fields use a white background, 1px `#c7c5d6` border, and a 2px Primary Indigo ring on focus. Labels sit 4px above the input in JetBrains Mono.
- **Chips/Badges:** Pill-shaped tags with tonal backgrounds. Use Tertiary Amber dots or fills for specific status warnings.
- **Cards:** Always white background, 1px border, no shadow. Use a 4px Primary Indigo top-border for "featured" or "active" cards to provide visual emphasis.
- **Lists:** Data rows are separated by 1px horizontal rules in `#efecf9`. Hover states on list items should trigger a subtle `#f4f2fe` background fill.
- **Code Blocks:** Encapsulated in a dark slate container even in light mode to provide a clear visual break and reference the "Terminal" heritage.