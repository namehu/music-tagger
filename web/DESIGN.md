# Design System Specification: The Sonic Curator

## Implementation Status
This design system is now implemented in the current `web` app as the default, fixed light theme.

### Locked v1 Decisions
*   **Theme Mode:** Light only. We intentionally do not ship a runtime dark mode or seed-color editor in this phase.
*   **Typography Runtime:** `Plus Jakarta Sans` is used for headlines and `Manrope` for body / labels through `next/font`.
*   **Token Strategy:** Existing shadcn/base-ui component APIs stay stable, while the visual system is remapped through CSS variables, shared component styling, and page-level cleanup.

### Implemented Core Tokens
*   **Primary:** `#0096FA`
*   **Primary Strong:** `#0061A4`
*   **Secondary:** `#5879A1`
*   **Tertiary:** `#E27400`
*   **Surface:** `#F7F9FB`
*   **Surface Container Low:** `#F2F4F6`
*   **Surface Container Lowest:** `#FFFFFF`
*   **On Surface:** `#191C1E`
*   **Ghost Border:** Secondary at low opacity for soft separation

## 1. Overview & Creative North Star
The "Creative North Star" for this design system is **The Digital Curator**. This philosophy treats a private music collection not as a database of files, but as a high-end editorial archive. 

To move beyond the "standard SaaS" look, this system rejects rigid grids and heavy borders in favor of **Tonal Architecture**. We break the "template" feel through intentional asymmetry—using large, confident typography offsets and varying card dimensions—to create a layout that feels curated and rhythmic, much like the music it hosts. The goal is a "breathable" interface where the "empty" space is as important as the content itself.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a "Pixiv-inspired" sky blue and a sterile, high-end white base. 

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section off the UI. Separation must be achieved through:
1.  **Background Shifts:** Placing a `surface_container_low` section against a `surface` background.
2.  **Vertical Space:** Using the spacing scale to create mental boundaries.
3.  **Tonal Transitions:** Subtle shifts in hue to define navigation vs. content.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. We use Material-style tiers to define importance without adding visual noise:
*   **Base Layer (`surface` / `#f7f9fb`):** The canvas.
*   **Secondary Zones (`surface_container_low` / `#f2f4f6`):** Used for sidebar navigation or utility panels.
*   **Actionable Content (`surface_container_lowest` / `#ffffff`):** Reserved for album cards and primary content blocks to make them "pop" against the off-white background.

### The "Glass & Gradient" Rule
To inject "soul" into the minimalist aesthetic:
*   **Hero CTAs:** Use a linear gradient from `primary` (#0061a4) to `primary_container` (#0096fa) at a 135-degree angle.
*   **Player Controls:** Utilize **Glassmorphism**. Floating player bars should use `surface_container_lowest` at 70% opacity with a `24px` backdrop-blur. This allows the album art colors to bleed through subtly.

---

## 3. Typography
We use a dual-font pairing to balance editorial authority with functional readability.

*   **Display & Headlines (Plus Jakarta Sans):** A modern, geometric sans-serif with a high x-height. Use `display-lg` (3.5rem) for artist pages to create a "magazine" feel.
*   **Body & Labels (Manrope):** A highly legible font for metadata. `body-md` (0.875rem) is the workhorse for tracklists and descriptions.

**The Hierarchy Strategy:**
Typography drives the brand. Use `headline-lg` for album titles and `label-sm` in all-caps with 0.05em tracking for technical metadata (e.g., "24-BIT FLAC") to create a premium, technical feel.

---

## 4. Elevation & Depth
Depth is conveyed through **Tonal Layering** rather than traditional drop shadows.

*   **The Layering Principle:** Place a `surface_container_lowest` card on top of a `surface_container_low` background. This creates a "soft lift" that feels natural and light.
*   **Ambient Shadows:** For floating elements (menus, active players), use a shadow with a 32px blur, 0px offset, and 6% opacity, tinted with the `on_surface` color.
*   **The "Ghost Border" Fallback:** If a container lacks contrast (e.g., white on white), use the `outline_variant` token at **15% opacity**. Never use 100% opaque borders.
*   **Roundedness:**
    *   **Standard (`DEFAULT`):** 0.5rem (8px) for buttons.
    *   **Editorial (`xl`):** 1.5rem (24px) for album cards and main containers to reinforce the "soft minimalism" aesthetic.

---

## 5. Components

### Album Cards & Lists
*   **Architecture:** Use a "No-Border" approach. Album art should have a `xl` corner radius.
*   **Lists:** Forbid divider lines. Use `surface_container_high` on hover to highlight track rows. Use `body-sm` for track durations and `primary` for the "currently playing" track state.

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary_container`), white text, `full` (pill) roundedness.
*   **Secondary:** `surface_container_high` background with `on_primary_container` text. No border.
*   **Tertiary:** Transparent background, `primary` text. Use for low-emphasis actions like "View All."

### Sleek Player Controls
*   **Progress Bar:** A 4px thick track using `surface_container_highest`. The active progress uses the `primary` blue. The "knob" (thumb) only appears on hover to maintain a clean look.
*   **Controls:** High-contrast `on_surface` icons. The "Play" button should be the only element using the `primary_container` fill.

### Input Fields
*   **Style:** Minimalist boxes using `surface_container_low`. On focus, transition the background to `surface_container_lowest` and add a "Ghost Border" of `primary` at 30% opacity.

---

## 6. Do's and Don'ts

### Do
*   **DO** use whitespace aggressively. If a layout feels "crowded," double the padding.
*   **DO** use `display-sm` typography for empty states to make them feel intentional and designed.
*   **DO** ensure album art is the hero. The UI is a frame for the art.
*   **DO** use `primary_fixed_dim` for subtle accent backgrounds in chips or tags.

### Don't
*   **DON'T** use pure black (#000000). Always use `on_surface` (#191c1e) for text.
*   **DON'T** use 1px dividers between list items. Use 8px of vertical breathing room instead.
*   **DON'T** use sharp corners. Everything must feel approachable and organic.
*   **DON'T** use heavy drop shadows. If it looks "heavy," reduce the opacity to 4%.
