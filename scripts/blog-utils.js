'use strict';

const BLOG_CATEGORIES = Object.freeze(['Homelab', 'Projects', 'Web']);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseFrontmatter(text, filename = 'Markdown file') {
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

function readingTime(body) {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

module.exports = { BLOG_CATEGORIES, escapeHtml, parseFrontmatter, readingTime, slugify };
