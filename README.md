# Marry Me, In Banff — website

Static site built from editable content. Lorelle edits it at `/admin`; Netlify rebuilds it on every publish.

**Start here:** `docs/SETUP-GUIDE.md` (one-time setup) · `docs/LORELLE-QUICKSTART.md` (for Lorelle)

```
content/home.json       the page: an ordered list of typed sections        ← edited in /admin
content/settings.json   logo, menu button, footer, links, colours          ← edited in /admin
images/                 uploaded photos (Decap saves here)
src/styles.css          the design
src/script.js           gallery tilt, accordions, scroll reveal, mobile menu
build.js                content + src → dist/index.html, optimised images, admin
admin/index.html        loads the Decap CMS bundle
admin/config.yml        what /admin shows (fields, labels, hints)
netlify/functions/      oauth-auth.mjs, oauth-callback.mjs  (GitHub sign-in)
netlify.toml            build command, headers, Node version
```

## Build

```
npm install
npm run build       # → dist/
npm run preview     # build + serve on http://localhost:8080
npm run cms         # local editor backend (run beside preview; open /admin/)
```

`node build.js --out somewhere` writes elsewhere. `--allow-missing-cms` lets a build pass without `npm install` (the `/admin` page just won't load). Warnings (missing alt text, missing image files, bad colours, unknown block types) are printed but never stop the build; unreadable data files do.

## Section types (`content/home.json` → `sections[].type`)

| type | renders |
|---|---|
| `hero` | full-height top banner with photo, heading, paragraph, two buttons |
| `divider` | ❖ ❖ ❖ (`size`: `normal` / `large`) |
| `photo_break` | wide photo, optional floating quote card (`quote_side`: `left` / `right` / `none`) |
| `gallery` | floating, drifting photo strip; the looping duplicate set is generated |
| `packages` | accordion packages; `left_body` / `right_body` are markdown (`####` → small heading, lists → ❖ list) |
| `faq` | grouped accordion; answers are markdown |
| `about` | optional portrait (placeholder if empty), markdown body, highlights |
| `testimonials` | quote grid |
| `banner` | full-width photo |
| `contact` | inquiry button + email line (email from settings) |
| `text_section` | heading + markdown body, `plain` or `tinted` background |

Any section with a `nav_label` appears in the top menu, in page order. Anchors: `gallery`, `packages`, `faq`, `about`, `kind-words`, `contact`; `text_section` uses `anchor` or its label. Duplicates get `-2`, `-3`.

### Adding a new block type

1. `build.js`: add `R.my_block = (s, ctx, site) => '<section id="' + ctx.id + '">…</section>';` (escape with `esc()`, run markdown through `md()`, wrap running text with `brandify()`). If it should get a menu anchor, add it to `DEFAULT_ANCHOR` (or follow `text_section`).
2. `admin/config.yml`: add a `types:` entry under the `sections` list with matching field names.
3. Style it in `src/styles.css`.

## Things the build does for you

- Escapes everything typed into the editor (raw HTML in a field shows as text and never runs); only `http(s)`, `mailto`, `tel`, `#` and relative links are allowed.
- "Marry Me, In Banff" in paragraphs, quotes and the footer gets the `.brand` italic; never inside headings.
- Images in `images/` are copied to `dist/images/`. Files over 400 KB, wider than 1800 px, sideways (EXIF rotation) or carrying EXIF are re-encoded to ≤ 1800 px with metadata (incl. GPS) removed. Small clean files are copied byte-for-byte. Originals in the repo are never modified.
- Gallery loop: card shapes/offsets are indexed within each set, and the track has `padding-right` equal to the gap, so the −50% drift wraps with no jump. A gallery with fewer than 8 photos is repeated so it never shows a gap. `--n` (card count per loop) sets the speed at ~2.1 s per card (1.44 s on phones).

## Login

`/admin` → Decap CMS (GitHub backend) → pop-up at `/oauth/auth` → GitHub → `/oauth/callback` → token passed to the opener with `postMessage`, only to the site's own origin (+ its `www` twin).

Env vars: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (required); `GITHUB_SCOPE` (default `repo`; `public_repo` for a public repo); `OAUTH_REDIRECT_URI` (override; must match the OAuth App's callback URL).

## Verified before handoff

- Rebuilt page vs. the previously live page: identical DOM (text, alts, images, markup) and **0 differing pixels** at 1440 px and 390 px, closed and with a package + FAQ item open. Only intended difference: gallery cards use per-set classes instead of `:nth-child`, which fixes a 57 px (desktop) / 17 px (phone) jump at the end of each loop in the old build.
- Build edge cases (26 checks): new/duplicate sections, reordering, hostile text, unsafe links, tiny/empty galleries, missing images/alt, bad colours, phone-photo optimisation, broken data files.
- OAuth functions (23 checks, mocked GitHub) plus a real-browser pop-up handshake.

**Not testable from the build environment** (no access to the npm registry, GitHub or Netlify): loading the Decap editor itself, a real GitHub login, a real Netlify build. `admin/config.yml` is valid YAML and agrees field-for-field with the data files, but has not been run through Decap's own validator — step 6 of the setup guide is the first real test.
