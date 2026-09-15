'use strict';

const fs = require('node:fs');
const path = require('node:path');

const vm = require('node:vm');
const { generateBundle } = require('./build-css');
const { BLOG_CATEGORIES, escapeHtml, parseFrontmatter, readingTime, slugify } = require('./blog-utils');
const { markdownToHtml } = require('./markdown');

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

console.log('--- ERI / CLI Static Repository Checks ---');

// 1. Core Document Presence
console.log('\n1. Verifying Core Documents:');
const coreFiles = ['index.html', 'about.html', 'projects.html', 'README.md', 'DESIGN-SPECIFICATION.md', 'package.json', 'LICENSE.md', 'THIRD_PARTY_NOTICES.md'];
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

  // Detect out-of-sync edits: compare current style.css with freshly generated bundle
  try {
    const expectedBundle = generateBundle();
    const cleanActual = content.replace(/\r\n/g, '\n').trim();
    const cleanExpected = expectedBundle.replace(/\r\n/g, '\n').trim();
    const isSynced = cleanActual === cleanExpected;
    report(isSynced, isSynced
      ? `Production style.css is fully synchronized with CSS source modules`
      : `Production style.css is OUT OF SYNC with source modules. Run 'npm run build:css' to update.`
    );
  } catch (err) {
    report(false, `Error validating bundle freshness: ${err.message}`);
  }
} else {
  report(false, `Production style.css exists`);
}

// 3. Viewport Geometry & Responsive Safety (Width & Height)
console.log('\n3. Verifying Viewport Geometry & Responsive Safety:');
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

const aboutCss = fs.readFileSync(path.join(cssDir, 'pages', 'about.css'), 'utf8');
const shortHeightMatch = /@media\s*\(\s*max-height:\s*640px\s*\)[\s\S]*?overflow:\s*visible/.test(aboutCss);
report(shortHeightMatch, `About page defines its short-height overflow rule at height <= 640px`);

const specContent = fs.readFileSync(path.join(root, 'DESIGN-SPECIFICATION.md'), 'utf8');
report(!/--signal-72\b/.test(specContent), `Zero legacy '--signal-72' tokens in DESIGN-SPECIFICATION.md`);

// 4. Internal Link Integrity
console.log('\n4. Verifying Internal Navigation Links:');
function collectHtmlFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectHtmlFiles(target);
    return entry.isFile() && entry.name.endsWith('.html') ? [target] : [];
  });
}

const htmlDocs = [
  path.join(root, 'index.html'),
  path.join(root, 'about.html'),
  path.join(root, 'projects.html'),
  ...collectHtmlFiles(path.join(root, 'blog'))
];
let allLinksValid = true;
htmlDocs.forEach(doc => {
  const content = fs.readFileSync(doc, 'utf8');
  const linkMatches = [...content.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  linkMatches.forEach(href => {
    if (/^(?:https?:|mailto:|tel:|#)/.test(href)) return;
    const cleanHref = href.split('#')[0].split('?')[0];
    if (!cleanHref) return;
    const targetPath = cleanHref.startsWith('/')
      ? path.join(root, cleanHref.replace(/^\/+/, ''))
      : path.resolve(path.dirname(doc), cleanHref);
    if (!fs.existsSync(targetPath)) {
      report(false, `Broken link in ${path.relative(root, doc)}: ${href}`);
      allLinksValid = false;
    }
  });
});
report(allLinksValid, `Internal links resolve across ${htmlDocs.length} HTML pages`);

// 5. JavaScript Syntax & Blog Verification
console.log('\n5. Verifying JS Syntax & Blog Engine:');
const jsFiles = [
  'assets/js/snap-scroll.js',
  'assets/js/home.js',
  'assets/js/pages.js',
  'assets/js/terrain.js',
  'scripts/build-css.js',
  'scripts/build-blog.js',
  'scripts/blog-utils.js',
  'scripts/markdown.js',
  'scripts/verify.js'
];
jsFiles.forEach(file => {
  const p = path.join(root, file);
  const exists = fs.existsSync(p);
  const size = exists ? fs.statSync(p).size : 0;
  report(exists && size > 0, `Script '${file}' (${size} bytes)`);

  if (exists) {
    try {
      const code = fs.readFileSync(p, 'utf8');
      new vm.Script(code, { filename: file });
      report(true, `Syntax valid: ${file}`);
    } catch (err) {
      report(false, `Syntax error in ${file}: ${err.message}`);
    }
  }
});

const threePath = path.join(root, 'assets', 'js', 'three.min.js');
report(fs.existsSync(threePath) && fs.statSync(threePath).size > 0, `Vendored Three.js r128 is present`);

const blogIndex = path.join(root, 'blog', 'index.html');
report(fs.existsSync(blogIndex), `Blog archive generated at blog/index.html`);

const parserFixture = [
  'Opening paragraph with **strong text** and `code`.',
  '',
  '## Checks',
  '',
  '1. Parent',
  '   - Nested child',
  '2. Sibling',
  '',
  '> Quoted evidence',
  '',
  '```bash',
  'printf "<safe>"',
  '```'
].join('\n');
const parserOutput = markdownToHtml(parserFixture);
const parserWorks = parserOutput.includes('<strong>strong text</strong>')
  && parserOutput.includes('<code>code</code>')
  && parserOutput.includes('<ol><li>Parent<ul><li>Nested child</li></ul></li><li>Sibling</li></ol>')
  && parserOutput.includes('<blockquote><p>Quoted evidence</p></blockquote>')
  && parserOutput.includes('<pre><code class="language-bash">printf &quot;&lt;safe&gt;&quot;</code></pre>');
report(parserWorks, `Markdown fixture preserves nesting, inline markup, quotes and escaped code`);

const articles = fs.existsSync(path.join(root, 'content', 'blog'))
  ? fs.readdirSync(path.join(root, 'content', 'blog')).filter(f => f.endsWith('.md'))
  : [];
report(articles.length === 46, `Found the expected 46 Markdown source posts`);

const allowedCategories = new Set(BLOG_CATEGORIES);
const seenSlugs = new Set();
let allPostsValid = true;
const parsedArticles = [];

articles.forEach((filename) => {
  const source = fs.readFileSync(path.join(root, 'content', 'blog', filename), 'utf8');
  let parsed;
  try {
    parsed = parseFrontmatter(source, filename);
  } catch (error) {
    report(false, error.message);
    allPostsValid = false;
    return;
  }
  const { data } = parsed;

  const filenameMatch = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/.exec(filename);
  const filenameDate = filenameMatch ? filenameMatch[1] : '';
  const filenameSlug = filenameMatch ? filenameMatch[2] : '';
  const slug = data.slug ? slugify(data.slug) : filenameSlug;
  const validFields = Boolean(data.title && data.date && data.category && data.summary);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') && data.date === filenameDate;
  const validCategory = allowedCategories.has(data.category);
  const uniqueSlug = Boolean(slug) && !seenSlugs.has(slug);
  seenSlugs.add(slug);

  const route = path.join(root, 'blog', slug, 'index.html');
  const routeExists = fs.existsSync(route);
  let outputMatches = false;
  if (routeExists) {
    const html = fs.readFileSync(route, 'utf8');
    outputMatches = html.includes(`<title>${escapeHtml(data.title)} — ERI / CLI</title>`)
      && html.includes(`<meta name="description" content="${escapeHtml(data.summary)}">`);
  }

  if (!(validFields && validDate && validCategory && uniqueSlug && routeExists && outputMatches)) {
    report(false, `${filename}: source metadata or generated route is inconsistent`);
    allPostsValid = false;
  }
  parsedArticles.push({ filename, data, slug, body: parsed.body });
});
report(allPostsValid, `Frontmatter and generated output agree for all ${parsedArticles.length} posts`);

const indexContent = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const featureMatch = indexContent.match(/<article class="region blog-feature" id="blog">[\s\S]*?<h3><a href="blog\/([^"/]+)\/index\.html">([\s\S]*?)<\/a><\/h3>/);
if (featureMatch) {
  const selectedSlug = featureMatch[1];
  const selectedTitle = featureMatch[2].trim();
  const targetPost = parsedArticles.find((post) => post.slug === selectedSlug);
  if (targetPost) {
    const metaMatch = indexContent.match(/<article class="region blog-feature" id="blog">[\s\S]*?<p class="meta">Blog · Selected post<br>(\d{4}-\d{2}-\d{2}) · (\d+) min read<\/p>/);
    const expectedReadingTime = readingTime(targetPost.body);
    const expectedTitle = escapeHtml(targetPost.data.title);
    const isMatched = selectedTitle === expectedTitle
      && Boolean(metaMatch)
      && metaMatch[1] === targetPost.data.date
      && Number(metaMatch[2]) === expectedReadingTime;
    report(isMatched, isMatched
      ? `Homepage featured post title, date and reading time match '${targetPost.filename}'`
      : `Homepage featured post metadata is out of sync. Run 'npm run build:blog'.`
    );
  } else {
    report(false, `Homepage featured post slug '${selectedSlug}' not found in content/blog/`);
  }
} else {
  report(false, `Homepage blog-feature section found in index.html`);
}

console.log('\n--------------------------------------------------');
if (errorCount === 0) {
  console.log('All verification checks passed with zero errors.');
  process.exit(0);
} else {
  console.error(`Verification completed with ${errorCount} error(s).`);
  process.exit(1);
}
