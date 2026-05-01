# Top Shelf Draft — Logo Design

## Decision

**Combined v2** selected: A goal net frame with a puck in the top left corner, featuring a layered green glow behind the puck and diagonal trajectory speed lines showing the shot path from bottom right.

## Logo Description

The logo is a stylized hockey goal net viewed from the front:

- **Goal frame**: White (#c8d9c3) posts and crossbar forming an open rectangle
- **Red goal line**: A dark red (#7a3a3a) dashed line at the base
- **Net**: Subtle dark green (#2a4a2a) grid lines inside the frame
- **Puck**: Positioned in the top left corner of the net, two-tone green (#4a7c59 body, #6b9b7a top)
- **Glow**: 4 concentric circles radiating from the puck in decreasing opacity (#4a7c59 at 5%, 8%, 12%, 18%)
- **Speed lines**: 3 diagonal lines tracing the shot trajectory from bottom right to the puck, in #4a7c59 at varying opacities (28%, 20%, 20%)

## Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Posts/crossbar | Light text | #c8d9c3 |
| Net grid | Dark green | #2a4a2a |
| Goal line | Dark red | #7a3a3a |
| Puck body | Primary green | #4a7c59 |
| Puck highlight | Light green | #6b9b7a |
| Glow/speed lines | Primary green | #4a7c59 |

## Variants Needed

1. **Horizontal (nav bar)**: Icon mark left, "TOP SHELF" + "DRAFT" text right — used in Navigation.tsx
2. **Round icon mark**: Circular border, goal + puck icon only — used for favicon, app icon, PWA manifest
3. **Square icon mark**: Rounded square border, goal + puck icon only — used for iOS/Android app icon
4. **Landing page hero**: Large centered version, icon mark above stacked "TOP SHELF DRAFT" text
5. **Email header**: Inline version in daily standings emails

## Implementation

- All variants will be SVG files for crisp rendering at any size
- Files stored in `app/public/logo/`:
  - `logo-horizontal.svg` — nav bar
  - `logo-icon-round.svg` — favicon/app icon (round)
  - `logo-icon-square.svg` — app icon (square)
  - `logo-hero.svg` — landing page
  - `logo-email.svg` — email header
- Favicon generated from the round icon mark
- Replace the current hockey emoji (&#127953;) in Navigation.tsx with the horizontal SVG
- Replace the emoji on the landing page with the hero SVG
- Update email template to include the logo SVG inline
