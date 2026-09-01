# Landing (`@landing`)

Marketing site UI: homepage, editorial pages, brands, legal, gift flows.

## Layout

| Path | Purpose |
|------|---------|
| `home/` | Current homepage design (sections, Navbar, Footer, theme tokens) |
| `datasets/` | Static datasets (`brandsData`, `careersData`, `featuredCards`) |
| `Zwitch/` | Zwitch microsite (`/zwitch`) |
| `*.tsx` (root) | Route-level pages lazy-loaded from `App.tsx` |
| `_archive/` | Retired copies (v1 homepage sections, design-reference port). Not wired to the app. |

## Homepage wiring

- **`MainPage.tsx`** composes `home/*` sections inside `.yureka-one-home`.
- **Gift routes** use `home/LandingShell` or import `Navbar` + `Footer` directly.
- **Editorial routes** use App shell `Navbar` (`theme="site"`) + `shared/Footer` (CTA band + `home/Footer`).

## Theme

- CSS: `home/landingTheme.css` (imported from root `index.css`)
- Tailwind tokens: `landing-*` in `tailwind.config.js`
- Shared layout helpers: `home/landingLayout.ts`
