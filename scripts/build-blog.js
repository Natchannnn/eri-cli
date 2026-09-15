'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const contentDir = path.join(root, 'content', 'blog');
const templatesDir = path.join(root, 'templates');
const outputDir = path.join(root, 'blog');
const tempDir = path.join(root, '.blog-build-tmp');
const markerName = '.generated-by-build-blog';
const allowedCategories = new Set(['Homelab', 'Projects', 'Web']);

function assertDirectChild(target) {
  if (path.dirname(path.resolve(target)) !== root) {
    throw new Error(`Refusing to replace a path outside the project root: ${target}`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMarkdown(value) {
  const code = [];
  let output = value.replace(/`([^`]+)`/g, (_, text) => {
    code.push(`<code>${escapeHtml(text)}</code>`);
    return `\u0000CODE${code.length - 1}\u0000`;
  });
  output = escapeHtml(output);
  output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  output = output.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => code[Number(index)]);
  return output;
}

function buildListTree(rawItems) {
  const root = { indent: -1, children: [] };
  const stack = [root];
  for (const item of rawItems) {
    while (stack.length > 1 && stack[stack.length - 1].indent >= item.indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    parent.children.push(item);
    stack.push(item);
  }
  return root.children;
}

function renderListItems(items) {
  if (!items || items.length === 0) return '';
  let html = '';
  let i = 0;
  while (i < items.length) {
    const currentTag = items[i].tag;
    html += `<${currentTag}>`;
    while (i < items.length && items[i].tag === currentTag) {
      const item = items[i];
      let itemHtml = inlineMarkdown(item.text);
      if (item.children && item.children.length > 0) {
        itemHtml += renderListItems(item.children);
      }
      html += `<li>${itemHtml}</li>`;
      i++;
    }
    html += `</${currentTag}>`;
  }
  return html;
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const blocks = [];
  let index = 0;
  let paragraphCount = 0;

  const beginsBlock = (line) => /^(\s*#{2,3}\s|\s*[-*+]\s|\s*\d+\.\s|>\s|```|---+(\s*)$)/.test(line);

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    if (/^---+$/.test(line.trim())) {
      blocks.push('<hr>');
      index += 1;
      continue;
    }

    const fence = /^```(.*)$/.exec(line);
    if (fence) {
      const language = fence[1].trim();
      const code = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      const className = language ? ` class="language-${escapeHtml(language)}"` : '';
      blocks.push(`<pre><code${className}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    const listMatch = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (listMatch) {
      const rawItems = [];
      const baseIndent = listMatch[1].length;

      while (index < lines.length) {
        const curLine = lines[index];
        if (!curLine.trim()) {
          let nextNonEmpty = index + 1;
          while (nextNonEmpty < lines.length && !lines[nextNonEmpty].trim()) {
            nextNonEmpty++;
          }
          if (nextNonEmpty < lines.length) {
            const nextMatch = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[nextNonEmpty]);
            if (nextMatch && nextMatch[1].length >= baseIndent) {
              index = nextNonEmpty;
              continue;
            }
          }
          break;
        }

        const itemMatch = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(curLine);
        if (itemMatch) {
          if (itemMatch[1].length < baseIndent) break;
          rawItems.push({
            indent: itemMatch[1].length,
            tag: /\d+\./.test(itemMatch[2]) ? 'ol' : 'ul',
            text: itemMatch[3],
            children: []
          });
          index++;
        } else if (rawItems.length > 0 && curLine.search(/\S/) > baseIndent && !beginsBlock(curLine)) {
          rawItems[rawItems.length - 1].text += ' ' + curLine.trim();
          index++;
        } else {
          break;
        }
      }

      const tree = buildListTree(rawItems);
      blocks.push(renderListItems(tree));
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(`<blockquote><p>${inlineMarkdown(quote.join(' '))}</p></blockquote>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !beginsBlock(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    const paragraphText = paragraph.join(' ');
    if (paragraphCount++ === 0) {
      const sentenceBreak = paragraphText.search(/(?<=[.!?])\s+(?=[A-Z0-9])/);
      if (sentenceBreak > 24 && sentenceBreak < paragraphText.length - 1) {
        blocks.push(`<p class="reader-lede">${inlineMarkdown(paragraphText.slice(0, sentenceBreak))}</p>`);
        blocks.push(`<p>${inlineMarkdown(paragraphText.slice(sentenceBreak).trim())}</p>`);
      } else {
        blocks.push(`<p class="reader-lede">${inlineMarkdown(paragraphText)}</p>`);
      }
    } else {
      blocks.push(`<p>${inlineMarkdown(paragraphText)}</p>`);
    }
  }

  return blocks.join('\n          ');
}

function parseFrontmatter(text, filename) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n'));
  if (!match) throw new Error(`${filename}: missing frontmatter.`);
  const data = {};
  match[1].split('\n').forEach((line) => {
    if (!line.trim()) return;
    const separator = line.indexOf(':');
    if (separator === -1) throw new Error(`${filename}: invalid frontmatter line: ${line}`);
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    data[key] = raw.startsWith('"') ? JSON.parse(raw) : raw;
  });
  return { data, body: match[2].trim() };
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

function formatMonth(value) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

function renderTemplate(template, values) {
  let output = template;
  Object.entries(values).forEach(([key, value]) => {
    output = output.replaceAll(`{{${key}}}`, String(value));
  });
  const unresolved = output.match(/{{[A-Z_]+}}/g);
  if (unresolved) throw new Error(`Unresolved template values: ${[...new Set(unresolved)].join(', ')}`);
  return output;
}

function adjacentLink(label, post, className) {
  if (!post) return '';
  return `<a class="adjacent-post ${className}" href="../../blog/${escapeHtml(post.slug)}/index.html"><span class="meta">${label}</span>${escapeHtml(post.title)}</a>`;
}

if (!fs.existsSync(contentDir)) throw new Error('content/blog/ does not exist. Run node scripts/migrate-blogs.js first.');
const articleTemplate = fs.readFileSync(path.join(templatesDir, 'blog-post.html'), 'utf8');
const indexTemplate = fs.readFileSync(path.join(templatesDir, 'blog-index.html'), 'utf8');

const posts = fs.readdirSync(contentDir)
  .filter((name) => name.endsWith('.md'))
  .map((filename) => {
    const parsed = parseFrontmatter(fs.readFileSync(path.join(contentDir, filename), 'utf8'), filename);
    const { title, date, category, summary } = parsed.data;
    if (!title || !date || !category || !summary) throw new Error(`${filename}: title, date, category and summary are required.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error(`${filename}: invalid date ${date}.`);
    if (!allowedCategories.has(category)) throw new Error(`${filename}: category must be Homelab, Projects or Web.`);
    const filenameSlug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
    const slug = parsed.data.slug ? slugify(parsed.data.slug) : filenameSlug;
    const words = parsed.body.split(/\s+/).filter(Boolean).length;
    return { filename, title, date, category, summary, slug, body: parsed.body, readingTime: Math.max(1, Math.ceil(words / 220)) };
  })
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

if (!posts.length) throw new Error('No Markdown posts found in content/blog/.');
const duplicate = posts.find((post, index) => posts.findIndex((candidate) => candidate.slug === post.slug) !== index);
if (duplicate) throw new Error(`Duplicate blog slug: ${duplicate.slug}.`);

assertDirectChild(tempDir);
assertDirectChild(outputDir);
fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });
fs.writeFileSync(path.join(tempDir, markerName), 'Generated by scripts/build-blog.js. Do not edit files in blog/ directly.\n');

posts.forEach((post, index) => {
  const older = posts[index + 1];
  const newer = posts[index - 1];
  const article = renderTemplate(articleTemplate, {
    TITLE: escapeHtml(post.title),
    DESCRIPTION: escapeHtml(post.summary),
    CATEGORY: escapeHtml(post.category),
    CATEGORY_KEY: post.category.toLowerCase(),
    DATE: post.date,
    DATE_FORMATTED: formatDate(post.date),
    READING_TIME: post.readingTime,
    ARTICLE_HTML: markdownToHtml(post.body),
    ADJACENT_NAV: `${adjacentLink('Older', older, 'older-post')}${adjacentLink('Newer', newer, 'newer-post')}`
  });
  const destination = path.join(tempDir, post.slug);
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'index.html'), article, 'utf8');
});

let activeMonth = '';
const archive = [];
posts.forEach((post, index) => {
  const month = post.date.slice(0, 7);
  if (month !== activeMonth) {
    activeMonth = month;
    archive.push(`<li class="archive-month" data-archive-month="${month}"><h2>${escapeHtml(formatMonth(post.date))}</h2></li>`);
  }
  archive.push(`<li class="post-entry" data-post-category="${post.category.toLowerCase()}" data-post-month="${month}" data-lattice-target="${index}">
          <p class="post-date meta"><time datetime="${post.date}">${escapeHtml(formatDate(post.date))}</time><br>${escapeHtml(post.category)}<br>${post.readingTime} min read</p>
          <article class="post-copy"><a href="./${escapeHtml(post.slug)}/index.html">${escapeHtml(post.title)}</a></article>
        </li>`);
});

const indexHtml = renderTemplate(indexTemplate, { POSTS: archive.join('\n        ') });
fs.writeFileSync(path.join(tempDir, 'index.html'), indexHtml, 'utf8');

if (fs.existsSync(outputDir)) {
  if (!fs.existsSync(path.join(outputDir, markerName))) {
    throw new Error('Refusing to replace blog/: it is not marked as generated output.');
  }
  fs.rmSync(outputDir, { recursive: true, force: false });
}
fs.renameSync(tempDir, outputDir);

// Sync to dist destination
const distTargets = [
  path.join(root, 'dist', 'blog')
];
for (const target of distTargets) {
  if (fs.existsSync(path.dirname(target))) {
    fs.cpSync(outputDir, target, { recursive: true });
  }
}

console.log(`Built blog/index.html and ${posts.length} article routes.`);
