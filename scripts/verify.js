'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
let errorCount = 0;

function report(status, message) {
  if (status) {
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    errorCount++;
  }
}

console.log('--- ERI / CLI Comprehensive Verification Suite ---');

// 1. Core Document Presence
console.log('\n1. Verifying Core Documents:');
const coreFiles = ['index.html', 'about.html', 'projects.html', 'README.md', 'DESIGN-SPECIFICATION.md', 'package.json'];
coreFiles.forEach(file => {
  const exists = fs.existsSync(path.join(root, file));
  report(exists, `Core file '${file}' present`);
});

// 2. Modular CSS & Bundle Verification
console.log('\n2. Verifying CSS Modules & Bundle:');
const cssDir = path.join(root, 'assets', 'css');
const modules = [
  'tokens.css', 'base.css', 'layout.css',
  'components/header.css', 'components/footer.css', 'components/lattice.css', 'components/project-card.css',
  'pages/home.css', 'pages/projects.css', 'pages/about.css', 'pages/blog.css'
];

let allModulesPresent = true;
modules.forEach(m => {
  const p = path.join(cssDir, m);
  const exists = fs.existsSync(p);
  const size = exists ? fs.statSync(p).size : 0;
  if (!exists || size === 0) allModulesPresent = false;
});
report(allModulesPresent, `All ${modules.length} CSS source modules present and non-empty`);

const styleCssPath = path.join(cssDir, 'style.css');
if (fs.existsSync(styleCssPath)) {
  const content = fs.readFileSync(styleCssPath, 'utf8');
  const hasImports = /@import\s+['"]\./.test(content);
  report(!hasImports, `Production style.css is bundled (zero @import waterfalls)`);
  const hasLegacyToken = /--signal-72\b/.test(content);
  report(!hasLegacyToken, `Zero legacy '--signal-72' tokens (canonical '--signal-high' enforced)`);
} else {
  report(false, `Production style.css exists`);
}

// 3. Tablet 900px Clipping Math Validator
console.log('\n3. Verifying Tablet Viewport Geometry (900px Safety):');
const homeCss = fs.readFileSync(path.join(cssDir, 'pages', 'home.css'), 'utf8');
const tabletMatch = homeCss.match(/@media\s*\(\s*min-width:\s*821px\s*\)\s*and\s*\(\s*max-width:\s*960px\s*\)[\s\S]*?grid-template-columns:\s*minmax\((\d+)px[^)]+\)\s*minmax\((\d+)px[^)]+\)\s*minmax\((\d+)px[^)]+\)/);
if (tabletMatch) {
  const t1 = Number(tabletMatch[1]);
  const t2 = Number(tabletMatch[2]);
  const t3 = Number(tabletMatch[3]);
  const minContentWidth = t1 + t2 + t3 + 36 + 36; // tracks + 2*18px gap + 2*18px padding
  report(minContentWidth < 900, `Tablet grid minimum width is ${minContentWidth}px (< 900px, margin: ${900 - minContentWidth}px safe)`);
} else {
  report(false, `Tablet breakpoint (821px-960px) defined in home.css`);
}

// 4. Internal Link Integrity
console.log('\n4. Verifying Internal Navigation Links:');
const htmlDocs = ['index.html', 'about.html', 'projects.html'];
let allLinksValid = true;
htmlDocs.forEach(doc => {
  const content = fs.readFileSync(path.join(root, doc), 'utf8');
  const linkMatches = [...content.matchAll(/href="([^"#:]+)(#[^"]*)?"/g)].map(m => m[1]);
  linkMatches.forEach(href => {
    // resolve relative to root
    const cleanHref = href.split('?')[0];
    const targetPath = path.join(root, cleanHref);
    if (!fs.existsSync(targetPath)) {
      report(false, `Broken link in ${doc}: ${href}`);
      allLinksValid = false;
    }
  });
});
report(allLinksValid, `All internal HTML links verified against filesystem`);

// 5. JavaScript & Blog Verification
console.log('\n5. Verifying JS Subsystems & Blog Engine:');
const jsFiles = ['snap-scroll.js', 'home.js', 'pages.js', 'terrain.js', 'three.min.js'];
jsFiles.forEach(file => {
  const p = path.join(root, 'assets', 'js', file);
  const exists = fs.existsSync(p);
  const size = exists ? fs.statSync(p).size : 0;
  report(exists && size > 0, `Script '${file}' (${size} bytes)`);
});

const blogIndex = path.join(root, 'blog', 'index.html');
report(fs.existsSync(blogIndex), `Blog archive generated at blog/index.html`);

const articles = fs.existsSync(path.join(root, 'content', 'blog'))
  ? fs.readdirSync(path.join(root, 'content', 'blog')).filter(f => f.endsWith('.md'))
  : [];
report(articles.length === 46, `All 46 Markdown blog posts verified`);

console.log('\n--------------------------------------------------');
if (errorCount === 0) {
  console.log('All verification checks passed with zero errors.');
  process.exit(0);
} else {
  console.error(`Verification completed with ${errorCount} error(s).`);
  process.exit(1);
}
