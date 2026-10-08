#!/usr/bin/env node
/*
 * Copies the shared header and footer (partials/*.html) into every page.
 *
 * Each page keeps real, crawlable header/footer markup (no client-side
 * includes, works from file://), while the partials stay the single source
 * of truth. Edit a partial, then run:
 *
 *   node tools/sync-partials.js
 *
 * Pages mark the insertion points with
 *   <!-- @header:start --> … <!-- @header:end -->
 *   <!-- @footer:start --> … <!-- @footer:end -->
 * and declare their nav entry with <body data-page="…">, which becomes
 * aria-current="page" on the matching nav links.
 *
 * Pages may also live one folder down as <folder>/index.html (e.g.
 * projects/index.html, served at /projects/). The partials' relative URLs
 * are written from the site root, so they get a "../" prefix there.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const partials = {
  header: read('partials/header.html').trim(),
  footer: read('partials/footer.html').trim(),
};

const SKIP_DIRS = new Set(['.git', 'assets', 'css', 'js', 'partials', 'tools', 'node_modules']);
const pages = [];
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html')) pages.push(entry.name);
  else if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)
    && fs.existsSync(path.join(root, entry.name, 'index.html'))) {
    pages.push(`${entry.name}/index.html`);
  }
}

// Prefixes the partials' relative URLs (href, src, srcset) for nested pages.
const isRelative = (url) => !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(url);
function prefixUrls(markup, prefix) {
  if (!prefix) return markup;
  return markup
    .replace(/(?<![\w-])(href|src)="([^"]*)"/g, (m, attr, url) =>
      url && isRelative(url) ? `${attr}="${prefix}${url}"` : m)
    .replace(/(?<![\w-])srcset="([^"]*)"/g, (m, list) =>
      `srcset="${list.split(',').map((part) => {
        const item = part.trim();
        return isRelative(item) ? prefix + item : item;
      }).join(', ')}"`);
}

let changed = 0;

for (const file of pages) {
  const full = path.join(root, file);
  const before = fs.readFileSync(full, 'utf8');
  const page = (before.match(/<body[^>]*data-page="([^"]+)"/) || [])[1];

  const prefix = '../'.repeat(file.split('/').length - 1);

  let html = before;
  for (const [name, markup] of Object.entries(partials)) {
    const marker = new RegExp(`(<!-- @${name}:start -->)[\\s\\S]*?(<!-- @${name}:end -->)`);
    if (!marker.test(html)) {
      console.warn(`! ${file}: missing @${name} markers, skipped`);
      continue;
    }
    let block = prefixUrls(markup, prefix);
    if (page) {
      block = block.replace(
        new RegExp(`data-page="${page}"`, 'g'),
        `data-page="${page}" aria-current="page"`
      );
    }
    html = html.replace(marker, (_, start, end) => `${start}\n${block}\n${end}`);
  }

  if (html !== before) {
    fs.writeFileSync(full, html);
    changed++;
    console.log(`✓ ${file}`);
  }
}

console.log(`${changed} of ${pages.length} page(s) updated.`);
