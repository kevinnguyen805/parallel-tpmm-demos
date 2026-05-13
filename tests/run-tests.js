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

// ─── Unit: demo page ─────────────────────────────────────────────────
test('unit: demo/index.html exists', () => read('demo/index.html'));

test('unit: demo includes title "From Brief to Outreach"', () => {
  const html = read('demo/index.html');
  assert(/From Brief to Outreach/.test(html), 'Demo title not present');
});

test('unit: demo has 4 numbered stage blocks (Stage 01-04)', () => {
  const html = read('demo/index.html');
  for (let i = 1; i <= 4; i++) {
    const tag = `Stage 0${i}`;
    assert(html.includes(tag), `Missing stage marker "${tag}"`);
  }
});

test('unit: demo names all 4 Parallel APIs (FindAll, Task, Monitor, Search)', () => {
  const html = read('demo/index.html');
  const apis = ['FindAll API', 'Task API', 'Monitor API', 'Search API'];
  const missing = apis.filter(a => !html.includes(a));
  assert(missing.length === 0, `Demo missing API labels: ${missing.join(', ')}`);
});

test('unit: demo has explicit methodology / sample-output disclosure', () => {
  const html = read('demo/index.html');
  assert(/Methodology/i.test(html), 'Missing Methodology block');
  // Accept any honest framing of how the API outputs were produced.
  assert(/constructed|reconstruct|illustrat|sample/i.test(html),
    'Methodology must clearly disclose how the API outputs were produced (constructed / reconstructed / illustrative / sample)');
});

test('unit: demo trigger event has at least 2 distinct news sources cited', () => {
  const html = read('demo/index.html');
  // Should cite the May 4 2026 event from multiple sources for triangulation.
  const newsHosts = ['techcrunch.com', 'cnbc.com', 'techstartups.com', 'cmswire.com', 'theaiinsider.tech'];
  const hits = newsHosts.filter(h => html.includes(h));
  assert(hits.length >= 2,
    `Trigger event should be cross-cited; found only ${hits.length} of expected news hosts: ${hits.join(', ')}`);
});

test('unit: demo names the real trigger company (Sierra) and its co-founders', () => {
  const html = read('demo/index.html');
  assert(/\bSierra\b/.test(html), 'Demo missing trigger company "Sierra"');
  assert(/Bret Taylor/.test(html), 'Demo missing co-founder "Bret Taylor"');
  assert(/Clay Bavor/.test(html), 'Demo missing co-founder "Clay Bavor"');
});

test('feature: demo has API request examples (POST + endpoint)', () => {
  const html = read('demo/index.html');
  const posts = (html.match(/POST/g) || []).length;
  const endpoints = (html.match(/api\.parallel\.ai/g) || []).length;
  assert(posts >= 4, `Expected ≥4 POST examples in demo, found ${posts}`);
  assert(endpoints >= 4, `Expected ≥4 api.parallel.ai endpoints, found ${endpoints}`);
});

test('feature: demo final artifact has at least 3 cited claims', () => {
  const html = read('demo/index.html');
  // The artifact is the .letter block (renamed from .artifact in the redesign).
  const artifactBlock = html.match(/class="letter">[\s\S]*?class="citations"/);
  assert(artifactBlock, 'No .letter block found');
  const cites = (artifactBlock[0].match(/class="cite"/g) || []).length;
  assert(cites >= 3, `Expected ≥3 citations in final artifact, found ${cites}`);
});

// ─── Unit: battlecard ────────────────────────────────────────────────
test('unit: battlecard/index.html exists', () => read('battlecard/index.html'));

test('unit: battlecard includes title "Same Task, Four APIs, Audited"', () => {
  const html = read('battlecard/index.html');
  assert(/Same Task, Four APIs, Audited/.test(html), 'Battlecard title not present');
});

test('unit: battlecard names all 4 competitors (Parallel, Exa, Perplexity, Tavily)', () => {
  const html = read('battlecard/index.html');
  const vendors = ['Parallel', 'Exa', 'Perplexity', 'Tavily'];
  const missing = vendors.filter(v => !new RegExp(`\\b${v}\\b`).test(html));
  assert(missing.length === 0, `Battlecard missing vendor names: ${missing.join(', ')}`);
});

test('unit: battlecard has methodology disclosure (no personal re-run claim)', () => {
  const html = read('battlecard/index.html');
  assert(/Methodology/i.test(html), 'Missing Methodology block');
  assert(/did not personally re-run|public sources|vendor-published/i.test(html),
    'Methodology must explicitly note the numbers are not personally re-run');
});

test('feature: battlecard summary table has expected dimension columns', () => {
  const html = read('battlecard/index.html');
  const tableBlock = html.match(/<table class="grid">[\s\S]*?<\/table>/);
  assert(tableBlock, 'No summary grid table found');
  const required = ['BrowseComp', 'confidence', 'Citation', 'Index', 'M&amp;A'];
  const missing = required.filter(c => !tableBlock[0].includes(c));
  assert(missing.length === 0, `Battlecard summary table missing columns: ${missing.join(', ')}`);
});

test('feature: battlecard "what I would audit beyond" section has 5 items', () => {
  const html = read('battlecard/index.html');
  // Capture from .gap div start to next major section (.verdict).
  const gapBlock = html.match(/class="gap">([\s\S]*?)class="verdict"/);
  assert(gapBlock, 'Missing .gap block (TPMM audit-beyond-this section)');
  const lis = (gapBlock[1].match(/<li>/g) || []).length;
  assert(lis === 5, `Expected exactly 5 audit-gap items, found ${lis}`);
});

test('quality: battlecard cites public sources per row', () => {
  const html = read('battlecard/index.html');
  const sources = (html.match(/class="source-note"/g) || []).length;
  assert(sources >= 4, `Expected ≥4 source-note citations across dimensions, found ${sources}`);
});

// ─── Cross-page consistency ──────────────────────────────────────────
test('cross: all 3 pieces share the same kevin.energy footer link', () => {
  const pages = ['essay/index.html', 'demo/index.html', 'battlecard/index.html'];
  for (const p of pages) {
    const html = read(p);
    assert(/href="https:\/\/kevin\.energy"/.test(html), `${p} missing kevin.energy footer link`);
    assert(/github\.com\/kevinnguyen805\/parallel-tpmm-demos/.test(html),
      `${p} missing GitHub source link`);
  }
});

test('cross: root index marks demo + battlecard Live (not Coming Soon)', () => {
  const html = read('index.html');
  assert(!/>\s*Coming soon\s*</i.test(html),
    'Root index still has "Coming soon" status — should be Live');
  // Permissive class match — design system may add extras like "entry card".
  const liveCards = (html.match(/<a\s+class="[^"]*\bcard\b[^"]*"\s+data-status="live"/g) || []).length;
  assert(liveCards === 3, `Expected 3 Live card elements on landing, found ${liveCards}`);
});

// ─── Design-language compliance ──────────────────────────────────────
test('design: all 4 pages reference Newsreader serif token', () => {
  const pages = ['index.html', 'essay/index.html', 'demo/index.html', 'battlecard/index.html'];
  for (const p of pages) {
    const html = read(p);
    assert(/Newsreader/i.test(html), `${p} missing Newsreader font reference`);
  }
});

test('design: all 4 pages reference Departure Mono', () => {
  const pages = ['index.html', 'essay/index.html', 'demo/index.html', 'battlecard/index.html'];
  for (const p of pages) {
    const html = read(p);
    assert(/Departure Mono/i.test(html), `${p} missing Departure Mono font reference`);
  }
});

test('design: all 4 pages use cobalt accent (#0a3bd6 or oklch token)', () => {
  const pages = ['index.html', 'essay/index.html', 'demo/index.html', 'battlecard/index.html'];
  for (const p of pages) {
    const html = read(p);
    const hasCobalt = /#0a3bd6/i.test(html) || /oklch\(50\.58%\s*0\.2886\s*264\.84\)/i.test(html);
    assert(hasCobalt, `${p} missing cobalt accent token`);
  }
});

test('design: all 4 pages end with ASCII END marker', () => {
  const pages = ['index.html', 'essay/index.html', 'demo/index.html', 'battlecard/index.html'];
  for (const p of pages) {
    const html = read(p);
    assert(/end-marker/i.test(html) && /END/.test(html),
      `${p} missing ASCII END marker`);
  }
});

test('design: pages use paper-sheet container (.sheet) and prose max-width pattern', () => {
  const pages = ['index.html', 'essay/index.html', 'demo/index.html', 'battlecard/index.html'];
  for (const p of pages) {
    const html = read(p);
    assert(/class="sheet"/.test(html), `${p} missing .sheet container`);
    assert(/class="prose"/.test(html), `${p} missing .prose inner column`);
  }
});

test('design: no orphan dark-theme tokens left over (#0a0a0b, #d4a574)', () => {
  const pages = ['index.html', 'essay/index.html', 'demo/index.html', 'battlecard/index.html'];
  for (const p of pages) {
    const html = read(p);
    // Old amber accent and dark background must be gone from every page.
    assert(!/#d4a574/i.test(html), `${p} still references old amber accent #d4a574`);
    assert(!/#0a0a0b/i.test(html), `${p} still references old near-black bg #0a0a0b`);
  }
});

// ─── E2E: internal link integrity ────────────────────────────────────
test('e2e: root index links to essay/', () => {
  const html = read('index.html');
  assert(/href="essay\/"/.test(html), 'Root index missing href="essay/"');
});

test('e2e: root index links to demo/ and battlecard/', () => {
  const html = read('index.html');
  assert(/href="demo\/"/.test(html), 'Root index missing href="demo/"');
  assert(/href="battlecard\/"/.test(html), 'Root index missing href="battlecard/"');
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
