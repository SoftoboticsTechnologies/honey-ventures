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
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const partials = {
  header: read('partials/header.html').trim(),
  footer: read('partials/footer.html').trim(),
};

const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
let changed = 0;

for (const file of pages) {
  const full = path.join(root, file);
  const before = fs.readFileSync(full, 'utf8');
  const page = (before.match(/<body[^>]*data-page="([^"]+)"/) || [])[1];

  let html = before;
  for (const [name, markup] of Object.entries(partials)) {
    const marker = new RegExp(`(<!-- @${name}:start -->)[\\s\\S]*?(<!-- @${name}:end -->)`);
    if (!marker.test(html)) {
      console.warn(`! ${file}: missing @${name} markers, skipped`);
      continue;
    }
    let block = markup;
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
