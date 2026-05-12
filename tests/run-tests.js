#!/usr/bin/env node
/**
 * Test suite for parallel-tpmm-demos.
 * Run: node tests/run-tests.js
 * Exits non-zero on any failure with a specific error log per failed assertion.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let failures = 0;

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'pass' });
  } catch (e) {
    failures++;
    results.push({ name, status: 'fail', error: e.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function read(p) {
  const full = path.join(ROOT, p);
  assert(fs.existsSync(full), `Expected file does not exist: ${p}`);
  return fs.readFileSync(full, 'utf8');
}

function countArticleWords(html) {
  const m = html.match(/<article>([\s\S]*?)<\/article>/);
  if (!m) return 0;
  return m[1]
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

// ─── Unit: file presence ─────────────────────────────────────────────
test('unit: root index.html exists', () => read('index.html'));
test('unit: essay/index.html exists', () => read('essay/index.html'));
test('unit: essay has <article> tag', () => {
  const html = read('essay/index.html');
  assert(/<article>/.test(html) && /<\/article>/.test(html), 'Missing <article> wrapper');
});

// ─── Unit: essay copy assertions ─────────────────────────────────────
test('unit: essay word count in [600, 750]', () => {
  const html = read('essay/index.html');
  const wc = countArticleWords(html);
  assert(wc >= 600 && wc <= 750, `Essay word count ${wc} out of bounds [600, 750]`);
});

test('unit: essay has exactly 4 H2 section headings', () => {
  const html = read('essay/index.html');
  const matches = html.match(/<article>[\s\S]*?<\/article>/)[0].match(/<h2[^>]*>/g) || [];
  assert(matches.length === 4, `Expected 4 H2s in essay article, found ${matches.length}`);
});

test('unit: essay includes the title "The Agent Loop Needs Plumbing, Not Snippets"', () => {
  const html = read('essay/index.html');
  assert(
    /The Agent Loop Needs Plumbing, Not Snippets/.test(html),
    'Working title not present in essay'
  );
});

test('unit: essay does NOT name competitors (Tavily, Exa, Perplexity, Brave, Serp)', () => {
  const html = read('essay/index.html');
  const competitors = ['Tavily', 'Exa', 'Perplexity', 'Brave Search', 'SerpAPI'];
  const found = competitors.filter(c => new RegExp(`\\b${c}\\b`, 'i').test(html));
  assert(found.length === 0, `Competitor naming leaked into essay: ${found.join(', ')}`);
});

test('unit: essay byline names Kevin Nguyen + May 2026', () => {
  const html = read('essay/index.html');
  assert(/Kevin Nguyen/.test(html), 'Byline missing "Kevin Nguyen"');
  assert(/May 2026/.test(html), 'Byline missing "May 2026"');
});

// ─── Feature: SVG diagram structure ──────────────────────────────────
test('feature: SVG diagram exists with viewBox', () => {
  const html = read('essay/index.html');
  const svg = html.match(/<svg[^>]*viewBox="([^"]+)"/);
  assert(svg, 'No SVG with viewBox found in essay');
  const dims = svg[1].split(/\s+/).map(Number);
  assert(dims.length === 4 && dims.every(n => !isNaN(n)), `Malformed viewBox: ${svg[1]}`);
});

test('feature: SVG diagram contains all 5 stage labels', () => {
  const html = read('essay/index.html');
  const svgBlock = html.match(/<svg[\s\S]*?<\/svg>/)[0];
  const stages = ['Perceive', 'Read', 'Reason', 'Watch', 'Source'];
  const missing = stages.filter(s => !new RegExp(`>${s}<`).test(svgBlock));
  assert(missing.length === 0, `SVG missing stage labels: ${missing.join(', ')}`);
});

test('feature: SVG diagram contains Basis trust-layer label', () => {
  const html = read('essay/index.html');
  const svgBlock = html.match(/<svg[\s\S]*?<\/svg>/)[0];
  assert(/Basis/.test(svgBlock), 'SVG diagram missing "Basis" trust-layer label');
});

test('feature: essay describes all 5 primitives in copy (Perceive/Read/Reason/Watch/Source)', () => {
  const html = read('essay/index.html');
  const article = html.match(/<article>([\s\S]*?)<\/article>/)[1];
  const primitives = ['Perceive', 'Read', 'Reason', 'Watch', 'Source'];
  const missing = primitives.filter(p => !new RegExp(`class="primitive">${p}\\.`).test(article));
  assert(missing.length === 0, `Essay copy missing primitive definitions: ${missing.join(', ')}`);
});

// ─── E2E: internal link integrity ────────────────────────────────────
test('e2e: root index links to essay/', () => {
  const html = read('index.html');
  assert(/href="essay\/"/.test(html), 'Root index missing href="essay/"');
});

test('e2e: essay back-link to root resolves', () => {
  const html = read('essay/index.html');
  assert(/href="\.\.\/"/.test(html), 'Essay missing back-link to ../');
});

test('e2e: essay closer points to demo/ and battlecard/ (placeholders OK)', () => {
  const html = read('essay/index.html');
  assert(/href="\.\.\/demo\/"/.test(html), 'Essay closer missing demo/ link');
  assert(/href="\.\.\/battlecard\/"/.test(html), 'Essay closer missing battlecard/ link');
});

// ─── Quality checks ──────────────────────────────────────────────────
test('quality: no TODO/TBD/FIXME markers in shipped HTML', () => {
  const files = ['index.html', 'essay/index.html'];
  for (const f of files) {
    const html = read(f);
    const markers = (html.match(/\b(TODO|TBD|FIXME|XXX)\b/g) || []);
    assert(markers.length === 0, `Found placeholder markers in ${f}: ${markers.join(', ')}`);
  }
});

test('quality: no second-person "you/your" in essay body (per voice rules)', () => {
  const html = read('essay/index.html');
  const article = html.match(/<article>([\s\S]*?)<\/article>/)[1];
  const stripped = article.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');
  // "you can tell" is the deliberate exception — diagnostic "you", not address.
  // Allow at most 2 occurrences.
  const matches = stripped.match(/\b(you|your)\b/gi) || [];
  assert(matches.length <= 2, `Second-person leakage: found ${matches.length} occurrences of you/your in essay body`);
});

test('quality: essay has open-graph meta tags', () => {
  const html = read('essay/index.html');
  assert(/property="og:title"/.test(html), 'Missing og:title');
  assert(/property="og:description"/.test(html), 'Missing og:description');
});

// ─── Report ──────────────────────────────────────────────────────────
console.log('');
console.log('━━━ parallel-tpmm-demos test results ━━━');
for (const r of results) {
  const icon = r.status === 'pass' ? '✓' : '✗';
  console.log(`${icon} ${r.name}${r.error ? '\n    → ' + r.error : ''}`);
}
console.log('');
console.log(`${results.length - failures}/${results.length} passed`);
if (failures > 0) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
