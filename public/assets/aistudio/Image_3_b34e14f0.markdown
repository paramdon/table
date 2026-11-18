---
name: Tabletop Dining System
colors:
  surface: '#fbf8ff'
  surface-dim: '#dad9e3'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2fd'
  surface-container: '#eeedf7'
  surface-container-high: '#e8e7f1'
  surface-container-highest: '#e3e1ec'
  on-surface: '#1a1b22'
  on-surface-variant: '#594137'
  inverse-surface: '#2f3038'
  inverse-on-surface: '#f1effa'
  outline: '#8d7165'
  outline-variant: '#e2bfb1'
  surface-tint: '#a14000'
  primary: '#a14000'
  on-primary: '#ffffff'
  primary-container: '#f76707'
  on-primary-container: '#511c00'
  inverse-primary: '#ffb694'
  secondary: '#5f5e61'
  on-secondary: '#ffffff'
  secondary-container: '#e4e1e6'
  on-secondary-container: '#656467'
  tertiary: '#006e2d'
  on-tertiary: '#ffffff'
  tertiary-container: '#23aa50'
  on-tertiary-container: '#003512'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb694'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7b2f00'
  secondary-fixed: '#e4e1e6'
  secondary-fixed-dim: '#c8c5ca'
  on-secondary-fixed: '#1b1b1e'
  on-secondary-fixed-variant: '#47464a'
  tertiary-fixed: '#7ffc97'
  tertiary-fixed-dim: '#62df7d'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005320'
  background: '#fbf8ff'
  on-background: '#1a1b22'
  surface-variant: '#e3e1ec'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  price-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: -0.02em
  price-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: -0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system delivers an appetizing, responsive in-restaurant dining experience built for instant-load table ordering via QR codes. The tone is warm, confident, and culinary-centric—balancing the comfort of traditional hospitality with frictionless modern ordering mechanics. 

The aesthetic is Modern Clean with warm tonal surfaces:
- **Atmosphere:** Sunlit bistro warmth, clean porcelain plates, crisp editorial menus.
- **Hierarchy:** High legibility under ambient restaurant lighting (dim candlelight, outdoor sun, or low pendant lamps).
- **Target Audience:** Hungry diners seeking swift menu discovery, clear dietary clarity (allergens, spice grades), effortless customization, and one-tap checkout or server paging.
- **Form Dynamic:** Generous touch targets, rounded physical affordances, and zero visual clutter to reduce dining hesitation.

## Colors

The palette leverages warm saffron amber as the primary appetite trigger and interaction beacon, anchored by charcoal slate for typographic clarity and rich contrast.

- **Primary (`#F76707`):** Saffron amber. Used strictly for prime calls to action (Add to Order, Checkout, Active Tab, Primary CTA pills) and active selection states.
- **Secondary (`#18181B`):** Deep charcoal slate. Used for primary typography, bottom navigation dock backgrounds, and high-impact structural containers.
- **Tertiary (`#16A34A`):** Fresh emerald green. Reserved for vegetarian culinary badges, kitchen confirmation states, and successful payment prompts.
- **Semantic Accent (`#DC2626`):** Soft ruby red. Reserved for non-vegetarian identification, chili/spice indicators, sold-out tags, and critical order alerts.
- **Neutral Surface Canvas:** `#FAFAFA` base background, `#FFFFFF` for elevated food cards and modals, with `#F4F4F5` for input wells, segmented pill tracks, and inactive chip fills.
- **Neutral Text:** `#18181B` for headings and item titles, `#52525B` for menu descriptions and metadata, and `#A1A1AA` for muted placeholders and borders.

## Typography

The typographic hierarchy pairs the friendly, soft geometric curves of **Plus Jakarta Sans** for titles, numerical prices, category tabs, and dietary labels with the pragmatic, ultra-legible neutral structure of **Inter** for menu descriptions, ingredient lists, and modifiers.

- Numerical figures (prices, table numbers, countdown timers) use tabular lining numerals where applicable to avoid layout jitter during item count transitions.
- Food descriptions maintain a restrained line length (max 52 characters) with high-contrast text (`#52525B`) to ensure rapid scanning while conversing.
- Dietary tags and allergen pills use uppercase `label-sm` weights with gentle letter-spacing for immediate glanceability.

## Layout & Spacing

The dining interface utilizes a compact, thumb-driven fluid layout designed primarily for mobile viewports (smartphones resting in hand or on table stands) that scales into clean 2-column or 3-column meal boards on tablets and larger displays.

- **Mobile Viewports (<640px):** Single-column stacked cards with horizontal-scrolling category navigation pinned under the table header. The bottom contains a permanent floating action dock with 80px bottom safe-area offset.
- **Tablet & Desktop (≥640px):** 2-to-3 column fluid menu grid with side-rail category navigation and a persistent right-hand order slip.
- **Spacing Rhythm:** Built on an 8pt step system. Element internals use `space-sm` (8px) and `space-md` (16px). Inter-card boundaries use `space-md`, while section groupings and food categories separate at `space-xl` (32px).

## Elevation & Depth

Visual hierarchy uses warm ambient lighting rather than artificial harsh shadows, mimicking natural daylight hitting clean tableware.

- **Level 0 (Flat Canvas):** `#FAFAFA` base background tone. No shadow.
- **Level 1 (Card & Dish Tiles):** `#FFFFFF` surfaces with a fine border (`1px solid #F4F4F5`) and subtle warm ambient diffusion: `0 2px 8px -2px rgba(24, 24, 27, 0.05)`.
- **Level 2 (Modals, Customization Sheets & Dropdowns):** `#FFFFFF` surfaces with `0 8px 24px -4px rgba(24, 24, 27, 0.10)`.
- **Level 3 (Floating Order Dock & Sticky Controls):** `#18181B` deep charcoal container with `0 12px 32px -4px rgba(24, 24, 27, 0.25)`. High visual weight anchors the eye at all times.
- **Tonal Layering:** Interactive nested controls (quantity steppers, text inputs) sit debossed inside `#F4F4F5` wells with 0px blur and a subtle inset micro-border.

## Shapes

The design system implements a consistent **Rounded (Level 2)** shape identity.

- **Standard Base Radii (`0.5rem` / `8px`):** Checkboxes, dietary icon frames, text inputs, and thumbnail dish media.
- **Large Radii (`rounded-lg` - `1rem` / `16px`):** Dish cards, dish detail sheets, bottom sheet modals, and order summary groups.
- **Pill Profiles:** Category filter chips, order status badges, waiter call triggers, and floating cart controls utilize fully rounded capsule shapes (`9999px`) to invite natural fingertip interaction.

## Components

### Buttons
- **Primary Order Button:** Saffron amber (`#F76707`) background, pure white label, `rounded-lg` geometry (16px), 48px minimum height. On active tap: gentle scale down (0.98x).
- **Secondary / Ghost Button:** Deep charcoal outline (`1.5px solid #E4E4E7`) with `#18181B` label and `#FFFFFF` background.
- **Call Waiter Quick Action:** Capsule pill button with `#F4F4F5` surface, subtle bell icon, and `#18181B` text. On alert status: shifts to soft saffron amber tint.

### Dietary & Allergen Badges
- **Vegetarian Badge:** Emerald green outline square with centered green circle (`#16A34A`), paired with green micro-capsule text pill (`#F0FDF4` fill, `#16A34A` label).
- **Non-Vegetarian Badge:** Ruby red outline square with centered red triangle (`#DC2626`), paired with red micro-capsule text pill (`#FEF2F2` fill, `#DC2626` label).
- **Allergen Indicators (GF, Vegan, Nut-Free):** Neutral capsule pills with `#F4F4F5` background, `#52525B` text, and 12px icon prefix.

### Food & Beverage Cards
- **Compact List Variant:** 1-column layout; food photo (80x80px, `rounded-md`) aligned to right or left, title in `headline-sm`, 2-line clamped description in `body-sm`, price in `price-md`, and an overlaid quick-add `+` pill button.
- **Hero / Featured Variant:** Large full-bleed image (16:9 ratio) with rounded top corners, diet badge floating in the top left, price badge in top right, detailed description, and multi-tier modification triggers.

### Category Navigation Bar
- Horizontally scrollable pill row with `gap-2`. Active tab has `#18181B` background and `#FFFFFF` text. Inactive tabs have `#FFFFFF` surface, `1px solid #E4E4E7`, and `#71717A` text.

### Bottom Action Dock
- Fixed elevated bar anchored to the bottom edge. Dark charcoal background (`#18181B`) with high contrast text. 
- Left section contains real-time item counter and running subtotal (`price-lg` in `#FFFFFF`).
- Right section embeds the primary checkout or review button in vibrant saffron amber (`#F76707`).

### Steppers & Quantity Adjusters
- Segmented pill track with `#F4F4F5` fill. Subtraction (`-`) and addition (`+`) buttons are 32x32px hit areas framing a central bold numerical indicator in `Plus Jakarta Sans`.