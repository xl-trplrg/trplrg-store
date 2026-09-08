// Eseguito dopo "vite build" e dopo la build SSR (npm run postbuild).
// Per ogni rotta della sitemap: genera un file index.html VERO con dentro il
// contenuto già renderizzato e i meta tag corretti — non più uno stesso
// index.html generico per tutte le pagine.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const ssrEntryPath = join(__dirname, '..', 'dist-ssr', 'entry-server.js');

if (!existsSync(ssrEntryPath)) {
  console.error('Build SSR non trovata:', ssrEntryPath);
  process.exit(1);
}

const { render, getMeta, getProductJsonLd, routes } = await import(ssrEntryPath);

const template = readFileSync(join(distDir, 'index.html'), 'utf-8');

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPage(route) {
  const appHtml = render(route);
  const meta = getMeta(route);
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = escapeHtml(meta.image);
  const url = `https://trplrg.com${route === '/' ? '' : route}`;

  let html = template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

  // <title>
  html = html.replace(/<title>.*?<\/title>/s, `<title>${title}</title>`);

  // description (name + og)
  html = html.replace(
    /<meta name="description" content=".*?" \/>/s,
    `<meta name="description" content="${description}" />`
  );
  html = html.replace(
    /<meta property="og:description" content=".*?" \/>/s,
    `<meta property="og:description" content="${description}" />`
  );

  // og:title / og:image / og:url
  html = html.replace(/<meta property="og:title" content=".*?" \/>/s, `<meta property="og:title" content="${title}" />`);
  html = html.replace(/<meta property="og:image" content=".*?" \/>/s, `<meta property="og:image" content="${image}" />`);
  html = html.replace(/<meta property="og:url" content=".*?" \/>/s, `<meta property="og:url" content="${url}" />`);

  const productJsonLd = getProductJsonLd(route);
  if (productJsonLd) {
    html = html.replace('</head>', `  <script type="application/ld+json">${productJsonLd}</script>\n</head>`);
  }

  return html;
}

for (const route of routes) {
  const html = buildPage(route);
  if (route === '/') {
    writeFileSync(join(distDir, 'index.html'), html);
  } else {
    const outDir = join(distDir, route);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), html);
  }
  console.log('Prerenderizzata:', route);
}

console.log(`Fatto — ${routes.length} pagine prerenderizzate.`);
