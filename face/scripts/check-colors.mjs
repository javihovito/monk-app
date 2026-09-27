// Fails if any UI file names a colour outside demo/tokens.css.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const files = ['index.html', ...readdirSync('demo').map((f) => join('demo', f))]
  .filter((f) => /\.(css|html|ts)$/.test(f) && !f.endsWith('tokens.css'));
const pattern = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch|lab|lch)\(/g;
let bad = 0;
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    // In CSS, ids in selectors (like #face) are not colours: only check declarations.
    const text = f.endsWith('.css') && line.includes('{') ? line.slice(line.indexOf('{')) : line;
    for (const m of text.matchAll(pattern)) {
      console.error(`${f}:${i + 1}: colour "${m[0]}" belongs in demo/tokens.css`);
      bad++;
    }
  });
}
if (bad) process.exit(1);
console.log(`colours ok (${files.length} files checked)`);
