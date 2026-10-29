#!/usr/bin/env node
/*
 * Marry Me, In Banff — site builder
 *
 *   content/settings.json + content/home.json   (edited by Lorelle in /admin)
 *   src/styles.css + src/script.js              (the design — developer-owned)
 *   images/                                     (uploaded photos)
 *                      │
 *                      ▼
 *   dist/index.html, dist/images/*, dist/admin/*   (what Netlify publishes)
 *
 * Usage:  node build.js [--out dist] [--allow-missing-cms]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.warn('! sharp is not installed — images will be copied without optimising.'); }

const ROOT = __dirname;
const args = process.argv.slice(2);
const OUT = path.resolve(ROOT, args.includes('--out') ? args[args.indexOf('--out') + 1] : 'dist');
const ALLOW_MISSING_CMS = args.includes('--allow-missing-cms');

const BRAND = 'Marry Me, In Banff';
const MAX_IMAGE_PX = 1800;
const RECOMPRESS_ABOVE_BYTES = 400 * 1024;
const MIN_GALLERY_CARDS = 8; // a very short gallery is repeated so the drift never shows a gap

const warnings = [];
const warn = (m) => { warnings.push(m); console.warn('! ' + m); };

/* ───────────── helpers ───────────── */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Italic-periwinkle brand styling for "Marry Me, In Banff" in running text (never inside headings). */
const brandify = (html) => html.replace(
  /(<h[1-6][\s>][\s\S]*?<\/h[1-6]>)|Marry Me, In Banff/g,
  (m, heading) => (heading ? m : '<span class="brand">' + m + '</span>')
);

const textHtml = (s) => brandify(esc(s));
// Markdown is plain formatting only: any raw HTML typed or pasted into a field is shown as text, never run.
marked.use({ renderer: { html: (token) => esc(token && token.text != null ? token.text : token) } });
const md = (s) => marked.parse(String(s || ''), { gfm: true, breaks: false }).trim();

const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
  .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

/** Only allow links that are safe in an href. */
function safeUrl(u) {
  const v = String(u == null ? '' : u).trim();
  if (!v) return '#';
  if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return '#'; // javascript:, data:, etc.
  return v; // relative path like "page.html"
}
const isExternal = (u) => /^https?:/i.test(String(u || '').trim());
const linkAttrs = (u) => 'href="' + esc(safeUrl(u)) + '"' + (isExternal(u) ? ' target="_blank" rel="noopener"' : '');

/** Decap stores "/images/foo.jpg"; the built page uses the relative "images/foo.jpg". */
const referencedImages = new Set();
function imgSrc(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  const rel = s.replace(/^\/+/, '');
  referencedImages.add(rel);
  return rel;
}

function heading(tag, pre, em) {
  const a = String(pre || '').trim();
  const b = String(em || '').trim();
  if (!a && !b) return '';
  return '<' + tag + '>' + esc(a) + (a && b ? ' ' : '') + (b ? '<em>' + esc(b) + '</em>' : '') + '</' + tag + '>';
}

function sectionHead(s, { sub = 'section-sub', subtext = s.subtext } = {}) {
  const parts = [];
  if (s.eyebrow) parts.push('      <span class="eyebrow">' + esc(s.eyebrow) + '</span>');
  const h = heading('h2', s.heading, s.heading_em);
  if (h) parts.push('      ' + h);
  if (subtext) parts.push('      <p class="' + sub + '">' + textHtml(subtext) + '</p>');
  return parts.join('\n');
}

const pic = (src, alt, extra = ' loading="lazy"') => {
  const s = imgSrc(src);
  if (!s) return '';
  if (alt === undefined || alt === null || alt === '') {
    warn('Image "' + s + '" has no description (alt text). Add one in the editor for accessibility.');
  }
  return '<img src="' + esc(s) + '" alt="' + esc(alt) + '"' + extra + '>';
};

/* ───────────── section renderers ───────────── */

const DEFAULT_ANCHOR = {
  gallery: 'gallery', packages: 'packages', faq: 'faq',
  about: 'about', testimonials: 'kind-words', contact: 'contact',
};

const R = {};

R.hero = (s) => {
  const img = imgSrc(s.image);
  return `<section class="hero">
  <div class="hero-bg" aria-hidden="true">
    ${img ? '<img src="' + esc(img) + '" alt="">' : ''}
  </div>
  <div class="hero-scrim" aria-hidden="true"></div>
  ${s.eyebrow ? '<span class="eyebrow">' + esc(s.eyebrow) + '</span>' : ''}
  ${heading('h1', s.heading, s.heading_em)}
  ${s.body ? '<p>' + textHtml(s.body) + '</p>' : ''}
  <div class="hero-actions">
    ${s.primary_label ? '<a class="btn btn-solid" ' + linkAttrs(s.primary_link) + '>' + esc(s.primary_label) + '</a>' : ''}
    ${s.secondary_label ? '<a class="btn btn-line" ' + linkAttrs(s.secondary_link) + '>' + esc(s.secondary_label) + '</a>' : ''}
  </div>
</section>`;
};

R.divider = (s) =>
  '<div class="divider' + (s.size === 'large' ? ' divider-lg' : '') + '" aria-hidden="true"><span>❖</span><span>❖</span><span>❖</span></div>';

R.photo_break = (s) => {
  let html = '<div class="photo-break reveal">' + pic(s.image, s.alt) + '</div>';
  const side = s.quote_side === 'right' ? 'right' : s.quote_side === 'none' ? null : 'left';
  if (s.quote_text && side) {
    html += `
<div class="pull-quote-wrap">
  <blockquote class="pull-quote ${side} reveal">
    <span class="mark">❖</span>
    <p>${textHtml(s.quote_text)}</p>
    ${s.quote_author ? '<footer>' + esc(s.quote_author) + '</footer>' : ''}
  </blockquote>
</div>`;
  }
  return html;
};

R.banner = (s) => '<div class="hero-banner reveal">\n  ' + pic(s.image, s.alt) + '\n</div>';

R.gallery = (s, ctx) => {
  const base = (s.photos || []).filter((p) => p && p.image);
  let viewport = '';
  if (base.length) {
    const reps = Math.max(1, Math.ceil(MIN_GALLERY_CARDS / base.length));
    const set = [];
    for (let i = 0; i < reps; i++) set.push(...base);
    const n = set.length;
    // Card styling is indexed *within* each set, so the second (looping) set is
    // an exact copy of the first and the drift wraps without a jump.
    const card = (p, k, hidden) => {
      const cls = ['fcard'];
      if (k % 2 === 1) cls.push('f-odd');
      if (k % 3 === 0) cls.push('f-w3');
      if (k % 4 === 0) cls.push('f-w4');
      cls.push(['f-b3', 'f-b1', 'f-b2'][k % 3]);
      return '      <div class="' + cls.join(' ') + '"' + (hidden ? ' aria-hidden="true"' : '') +
        '><div class="fcard-inner"><span class="fcard-mark">❖</span>' + pic(p.image, p.alt) + '</div></div>';
    };
    const first = set.map((p, i) => card(p, i + 1, false));
    const second = set.map((p, i) => card(p, i + 1, true));
    viewport = `
  <div class="float-viewport" id="floatViewport">
    <div class="float-track" id="floatTrack" style="--n:${n}">
${first.join('\n')}
      <!-- duplicate set — makes the right-to-left drift loop seamlessly -->
${second.join('\n')}
    </div>
  </div>
`;
  }
  const head = [];
  if (s.eyebrow) head.push('    <span class="eyebrow">' + esc(s.eyebrow) + '</span>');
  const h = heading('h2', s.heading, s.heading_em);
  if (h) head.push('    ' + h);
  if (s.subtext) head.push('    <p class="gallery-sub">' + textHtml(s.subtext) + '</p>');
  return `<section class="gallery" id="${ctx.id}">
  <div class="wrap gallery-head reveal">
${head.join('\n')}
  </div>
${viewport}
</section>`;
};

R.packages = (s, ctx) => {
  const col = (mdText) => brandify(md(mdText))
    .replace(/<h[1-35-6]>/g, '<h4>').replace(/<\/h[1-35-6]>/g, '</h4>')
    .replace(/<ul>/g, '<ul class="pkg-list">');
  const items = (s.items || []).map((p) => {
    const left = [];
    if (p.image) left.push('            <div class="pkg-photo">' + pic(p.image, p.image_alt) + '</div>');
    if (p.tagline) left.push('            <p class="pkg-tag">' + textHtml(p.tagline) + '</p>');
    if (p.left_body) left.push(col(p.left_body));
    if (p.cta_label) left.push('            <a class="btn btn-line pkg-cta" ' + linkAttrs(p.cta_link || '#contact') + '>' + esc(p.cta_label) + '</a>');
    const right = p.right_body ? col(p.right_body) : '';
    return `    <article class="pkg reveal">
      <button class="pkg-row" aria-expanded="false">
        <span class="mark">❖</span>
        <span class="pkg-name">${esc(p.name)}${p.subtitle ? '<small>' + esc(p.subtitle) + '</small>' : ''}</span>
        ${p.price ? '<span class="pkg-price">' + esc(p.price) + '</span>' : ''}
        <span class="pkg-toggle" aria-hidden="true">+</span>
      </button>
      <div class="pkg-body">
        <div class="pkg-inner"${right ? '' : ' style="grid-template-columns:1fr"'}>
          <div>
${left.join('\n')}
          </div>
${right ? '          <div>\n' + right + '\n          </div>' : ''}
        </div>
      </div>
    </article>`;
  });
  return `<section id="${ctx.id}">
  <div class="wrap">
    <div class="section-head reveal">
${sectionHead(s)}
    </div>
    ${s.menu_note ? '<p class="menu-note reveal">' + textHtml(s.menu_note) + '</p>' : ''}

${items.join('\n\n')}
  </div>
</section>`;
};

R.faq = (s, ctx) => {
  const cats = (s.categories || []).map((c) => {
    const qas = (c.items || []).map((q) =>
      `      <div class="qa"><button class="qa-q" aria-expanded="false"><span>${esc(q.question)}</span><span aria-hidden="true">+</span></button>
        <div class="qa-a">${brandify(md(q.answer))}</div></div>`);
    return `    <div class="faq-cat reveal">
      <div class="faq-cat-title">${esc(c.title)}</div>
${qas.join('\n')}
    </div>`;
  });
  return `<section class="faq" id="${ctx.id}">
  <div class="wrap narrow">
    <div class="section-head reveal">
${sectionHead(s)}
    </div>

${cats.join('\n\n')}
  </div>
</section>`;
};

R.about = (s, ctx) => {
  const portrait = imgSrc(s.portrait);
  const figure = portrait
    ? '<div class="about-figure has-photo reveal">' + pic(portrait, s.portrait_alt) + '</div>'
    : '<div class="about-figure reveal">\n      <span class="placeholder">Portrait of Lorelle — photo to come</span>\n    </div>';
  const facts = (s.facts || []).map((f) => {
    const v = String(f.value == null ? '' : f.value).trim();
    const icon = v.length > 0 && !/[\p{L}\p{N}]/u.test(v) && [...v].length <= 2;
    return '        <div class="fact"><strong' + (icon ? ' class="fact-icon"' : '') + '>' + esc(v) + '</strong><span>' + esc(f.label) + '</span></div>';
  });
  return `<section class="about" id="${ctx.id}">
  <div class="wrap about-grid">
    ${figure}
    <div class="about-copy reveal">
      ${s.eyebrow ? '<span class="eyebrow">' + esc(s.eyebrow) + '</span>' : ''}
      ${heading('h2', s.heading, s.heading_em)}
      ${brandify(md(s.body))}
      ${facts.length ? '<div class="about-facts">\n' + facts.join('\n') + '\n      </div>' : ''}
    </div>
  </div>
</section>`;
};

R.testimonials = (s, ctx) => {
  const quotes = (s.quotes || []).map((q) =>
    '      <blockquote class="quote"><span class="mark">❖</span><p>' + textHtml(q.text) + '</p>' +
    (q.author ? '<footer>' + esc(q.author) + '</footer>' : '') + '</blockquote>');
  return `<section id="${ctx.id}">
  <div class="wrap">
    <div class="section-head reveal">
${sectionHead(s)}
    </div>
    <div class="quotes reveal">
${quotes.join('\n')}
    </div>
  </div>
</section>`;
};

R.contact = (s, ctx, site) => `<section class="contact" id="${ctx.id}">
  <div class="wrap">
    <div class="section-head reveal">
${sectionHead(s)}
    </div>
    ${s.button_label ? '<div class="c-cta reveal">\n      <a class="btn c-submit" ' + linkAttrs(s.button_link) + '>' + esc(s.button_label) + '</a>\n    </div>' : ''}
    ${site.email ? '<p class="c-alt">' + esc(s.alt_prefix || 'Prefer to reach out directly?') + ' <a href="mailto:' + esc(site.email) + '">' + esc(site.email) + '</a></p>' : ''}
  </div>
</section>`;

R.text_section = (s, ctx) => `<section class="text-section${s.background === 'tinted' ? ' alt' : ''}" id="${ctx.id}">
  <div class="wrap narrow">
    <div class="section-head reveal">
${sectionHead({ eyebrow: s.eyebrow, heading: s.heading, heading_em: s.heading_em })}
    </div>
    <div class="text-body reveal">
${brandify(md(s.body))}
    </div>
  </div>
</section>`;

/* ───────────── page assembly ───────────── */

function readJson(file) {
  const p = path.join(ROOT, file);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { throw new Error('Could not read ' + file + ': ' + e.message); }
}

function cssVars(colors) {
  const map = {
    cream: '--cream', cream_deep: '--cream-deep', ink: '--ink', ink_soft: '--ink-soft',
    accent: '--gold', accent_pale: '--gold-pale', deep: '--pine',
  };
  const out = [];
  for (const [k, v] of Object.entries(map)) {
    const val = colors && colors[k];
    if (val && /^#[0-9a-f]{3,8}$/i.test(String(val).trim())) out.push('    ' + v + ':' + String(val).trim() + ';');
    else if (val) warn('Colour "' + k + '" is not a valid hex value (' + val + ') — using the default.');
  }
  return out.length ? '\n  :root{\n' + out.join('\n') + '\n  }\n' : '';
}

function buildPage() {
  const site = readJson('content/settings.json');
  const home = readJson('content/home.json');
  const css = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'src/script.js'), 'utf8');

  // assign unique anchors
  const used = new Set(['top']);
  const sections = (home.sections || []).filter(Boolean);
  const nav = [];
  const body = [];
  for (const s of sections) {
    const render = R[s.type];
    if (!render) { warn('Unknown section type "' + s.type + '" — skipped.'); continue; }
    let id = '';
    if (DEFAULT_ANCHOR[s.type] || s.type === 'text_section') {
      let base = s.type === 'text_section'
        ? slug(s.anchor || s.nav_label || s.heading) || 'section'
        : DEFAULT_ANCHOR[s.type];
      id = base; let n = 2;
      while (used.has(id)) id = base + '-' + n++;
      used.add(id);
    }
    if (s.nav_label && id) nav.push({ label: s.nav_label, id });
    body.push(render(s, { id }, site));
  }

  const logo = imgSrc(site.logo);
  const wordmark = logo
    ? '<img src="' + esc(logo) + '" alt="' + esc(site.logo_alt || BRAND) + '">'
    : esc(BRAND);

  const ig = site.instagram_url
    ? `<a href="${esc(safeUrl(site.instagram_url))}" target="_blank" rel="noopener" aria-label="${esc(BRAND)} on Instagram">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5"></rect>
          <circle cx="12" cy="12" r="4"></circle>
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"></circle>
        </svg>
        <span>${esc(site.instagram_handle || '')}</span>
      </a>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(site.site_title || BRAND)}</title>
<meta name="description" content="${esc(site.meta_description || '')}">
<style>
${css}${cssVars(site.colors)}</style>
</head>
<body>
<header id="top">
  <div class="wrap nav">
    <a class="wordmark" href="#top">${wordmark}</a>
    <ul class="nav-links">
${nav.map((n) => '      <li><a href="#' + esc(n.id) + '">' + esc(n.label) + '</a></li>').join('\n')}
    </ul>
    ${site.nav_cta_label ? '<a class="nav-cta" ' + linkAttrs(site.nav_cta_link || '#contact') + '>' + esc(site.nav_cta_label) + '</a>' : ''}
    <button class="menu-btn" onclick="document.querySelector('header').classList.toggle('nav-open')">Menu</button>
  </div>
</header>

${body.join('\n\n')}

<footer class="site">
  <div class="wrap foot">
    <span class="brand">${esc(site.footer_brand || BRAND)}</span>
    <span>${esc(site.footer_text || '')}</span>
    <div class="foot-icons">
      ${ig}
      <span class="pride-badge" role="img" aria-label="Love is love — all welcome" title="Love is love — all welcome">
        <svg width="20" height="14" viewBox="0 0 20 14">
          <rect y="0" width="20" height="2.34" fill="#E40303"></rect>
          <rect y="2.34" width="20" height="2.34" fill="#FF8C00"></rect>
          <rect y="4.68" width="20" height="2.34" fill="#FFED00"></rect>
          <rect y="7.02" width="20" height="2.34" fill="#008026"></rect>
          <rect y="9.36" width="20" height="2.34" fill="#004DFF"></rect>
          <rect y="11.7" width="20" height="2.3" fill="#750787"></rect>
        </svg>
      </span>
    </div>
  </div>
</footer>

<script>
${js}</script>
</body>
</html>
`;
}

/* ───────────── images ───────────── */

const WEB_RASTER = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function processImage(srcFile, destFile) {
  const ext = path.extname(srcFile).toLowerCase();
  const size = fs.statSync(srcFile).size;
  if (!sharp || !WEB_RASTER.has(ext)) { fs.copyFileSync(srcFile, destFile); return 'copied'; }
  try {
    const meta = await sharp(srcFile, { failOn: 'none' }).metadata();
    const rotated = meta.orientation && meta.orientation > 1;
    const tooBig = Math.max(meta.width || 0, meta.height || 0) > MAX_IMAGE_PX;
    const hasExif = !!meta.exif && ext !== '.png';
    if (!rotated && !tooBig && !hasExif && size < RECOMPRESS_ABOVE_BYTES) {
      fs.copyFileSync(srcFile, destFile); return 'copied';
    }
    let img = sharp(srcFile, { failOn: 'none' }).rotate()
      .resize({ width: MAX_IMAGE_PX, height: MAX_IMAGE_PX, fit: 'inside', withoutEnlargement: true });
    if (ext === '.png') img = img.png({ compressionLevel: 9 });
    else if (ext === '.webp') img = img.webp({ quality: 84 });
    else img = img.jpeg({ quality: 84, mozjpeg: true });
    await img.toFile(destFile);
    // never make a file bigger
    if (fs.statSync(destFile).size >= size && !rotated && !tooBig && !hasExif) fs.copyFileSync(srcFile, destFile);
    return 'optimised';
  } catch (e) {
    warn('Could not optimise ' + path.basename(srcFile) + ' (' + e.message + ') — copied as-is.');
    fs.copyFileSync(srcFile, destFile); return 'copied';
  }
}

async function buildImages() {
  const srcDir = path.join(ROOT, 'images');
  const dstDir = path.join(OUT, 'images');
  fs.mkdirSync(dstDir, { recursive: true });
  if (!fs.existsSync(srcDir)) return;
  const stats = { copied: 0, optimised: 0 };
  for (const f of fs.readdirSync(srcDir)) {
    const p = path.join(srcDir, f);
    if (!fs.statSync(p).isFile() || f.startsWith('.')) continue;
    stats[await processImage(p, path.join(dstDir, f))]++;
  }
  console.log('  images: ' + stats.optimised + ' optimised, ' + stats.copied + ' copied unchanged');
  for (const rel of referencedImages) {
    if (!fs.existsSync(path.join(OUT, rel))) warn('The page uses "' + rel + '" but that file is not in the images folder.');
    else if (!WEB_RASTER.has(path.extname(rel).toLowerCase()) && !/\.(svg|gif|avif)$/i.test(rel)) {
      warn('"' + rel + '" may not display in browsers — please upload a JPG or PNG instead.');
    }
  }
}

/* ───────────── admin ───────────── */

function copyAdmin() {
  const src = path.join(ROOT, 'admin');
  const dst = path.join(OUT, 'admin');
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  try {
    if (/YOUR-GITHUB-USERNAME/.test(fs.readFileSync(path.join(src, 'config.yml'), 'utf8'))) {
      warn('admin/config.yml still says YOUR-GITHUB-USERNAME — set backend.repo to the real GitHub repository before using /admin.');
    }
  } catch (e) { warn('admin/config.yml is missing — /admin will not work.'); }
  const bundle = path.join(ROOT, 'node_modules', 'decap-cms', 'dist', 'decap-cms.js');
  if (fs.existsSync(bundle)) {
    fs.copyFileSync(bundle, path.join(dst, 'decap-cms.js'));
    console.log('  admin: Decap CMS bundle copied from node_modules');
  } else if (ALLOW_MISSING_CMS) {
    console.warn('  admin: decap-cms is not installed — /admin will not load (allowed by --allow-missing-cms)');
  } else {
    throw new Error('decap-cms is not installed (node_modules/decap-cms/dist/decap-cms.js). Run "npm install" first.');
  }
}

/* ───────────── main ───────────── */

(async () => {
  const t0 = Date.now();
  console.log('Building site → ' + path.relative(ROOT, OUT));
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const html = buildPage();           // also records which images the page uses
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /admin/\n');
  await buildImages();
  copyAdmin();

  console.log('Done in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's — index.html ' + Math.round(html.length / 1024) + ' KB' +
    (warnings.length ? ', ' + warnings.length + ' warning(s)' : ''));
})().catch((e) => { console.error('\nBUILD FAILED: ' + e.message); process.exit(1); });
