'use strict';

const fs = require('node:fs');
const path = require('node:path');

const cssDir = path.resolve(__dirname, '..', 'assets', 'css');
const outputFile = path.join(cssDir, 'style.css');

const modules = [
  'tokens.css',
  'base.css',
  'layout.css',
  'components/header.css',
  'components/footer.css',
  'components/lattice.css',
  'components/project-card.css',
  'pages/home.css',
  'pages/projects.css',
  'pages/about.css',
  'pages/blog.css'
];

function generateBundle() {
  const chunks = [
    '/* ERI / CLI — bundled stylesheet */\n'
  ];

  for (const relPath of modules) {
    const fullPath = path.join(cssDir, relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing CSS module: ${relPath}`);
    }
    const content = fs.readFileSync(fullPath, 'utf8').trim();
    chunks.push(`/* --- ${relPath} --- */\n${content}\n`);
  }

  return chunks.join('\n');
}

function build() {
  console.log('Bundling modular CSS into assets/css/style.css...');
  const bundled = generateBundle();
  fs.writeFileSync(outputFile, bundled, 'utf8');
  console.log(`Successfully bundled ${modules.length} modules into ${outputFile} (${bundled.length} bytes).`);
}

if (require.main === module) {
  build();
}

module.exports = { generateBundle, build, modules, outputFile };
