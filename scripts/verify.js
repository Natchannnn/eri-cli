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

console.log('--- ERI / CLI Automated Verification Suite ---');

// 1. Verify Core HTML Documents
console.log('\n1. Verifying Core Documents:');
const coreFiles = ['index.html', 'about.html', 'projects.html', 'README.md', 'DESIGN-SPECIFICATION.md'];
coreFiles.forEach(file => {
  const exists = fs.existsSync(path.join(root, file));
  report(exists, `Core file '${file}' present`);
});

// 2. Verify Modular CSS Imports
console.log('\n2. Verifying Modular CSS Architecture:');
const cssDir = path.join(root, 'assets', 'css');
const styleCssPath = path.join(cssDir, 'style.css');
if (fs.existsSync(styleCssPath)) {
  const content = fs.readFileSync(styleCssPath, 'utf8');
  const importRegex = /@import\s+['"]([^'"]+)['"]/g;
  let match;
  let moduleCount = 0;
  while ((match = importRegex.exec(content)) !== null) {
    moduleCount++;
    const target = path.resolve(cssDir, match[1]);
    const exists = fs.existsSync(target);
    const size = exists ? fs.statSync(target).size : 0;
    report(exists && size > 0, `Module '${match[1]}' (${size} bytes)`);
  }
  report(moduleCount === 11, `All 11 design system CSS modules referenced`);
} else {
  report(false, `style.css entrypoint found`);
}

// 3. Verify JavaScript Assets
console.log('\n3. Verifying JavaScript Subsystems:');
const jsFiles = ['snap-scroll.js', 'home.js', 'pages.js', 'terrain.js', 'three.min.js'];
jsFiles.forEach(file => {
  const p = path.join(root, 'assets', 'js', file);
  const exists = fs.existsSync(p);
  const size = exists ? fs.statSync(p).size : 0;
  report(exists && size > 0, `Script '${file}' (${size} bytes)`);
});

// 4. Verify Blog Static Site Generation
console.log('\n4. Verifying Blog Engine:');
const blogIndex = path.join(root, 'blog', 'index.html');
report(fs.existsSync(blogIndex), `Blog archive generated at blog/index.html`);

const articles = fs.existsSync(path.join(root, 'content', 'blog'))
  ? fs.readdirSync(path.join(root, 'content', 'blog')).filter(f => f.endsWith('.md'))
  : [];
report(articles.length > 0, `Content articles verified (${articles.length} posts)`);

console.log('\n----------------------------------------------');
if (errorCount === 0) {
  console.log('All verification checks passed with zero errors.');
  process.exit(0);
} else {
  console.error(`Verification completed with ${errorCount} error(s).`);
  process.exit(1);
}
