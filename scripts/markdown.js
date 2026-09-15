'use strict';

const { escapeHtml } = require('./blog-utils');

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

module.exports = { inlineMarkdown, markdownToHtml };
