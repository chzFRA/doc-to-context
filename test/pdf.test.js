import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfItemsText } from '../src/core.js';
async function extract(path) {
  const task = getDocument({ data: new Uint8Array(await readFile(path)), useSystemFonts: true, isEvalSupported: false });
  try {
    const pdf = await task.promise; const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number); const content = await page.getTextContent();
      pages.push(pdfItemsText(content.items));
    }
    return pages;
  } finally { await task.destroy(); }
}
test('actual two-page PDF extraction returns page-specific source evidence', async () => {
  const pages = await extract('public/samples/community-garden.pdf');
  assert.equal(pages.length, 2); assert.match(pages[0], /18 households/); assert.match(pages[0], /2,400 dollars/);
  assert.match(pages[1], /11 people/); assert.match(pages[1], /80 square metres/); assert.doesNotMatch(pages[0], /11 people/);
});
test('actual image-only PDF has no selectable text, never fabricated content', async () => {
  const pages = await extract('public/samples/image-only.pdf');
  assert.equal(pages.length, 1); assert.equal(pages[0], '');
});
test('damaged PDF rejects instead of being treated as a successful empty document', async () => {
  const task = getDocument({ data: new TextEncoder().encode('this is not a PDF document') });
  try { await assert.rejects(task.promise, /Invalid PDF/); } finally { await task.destroy(); }
});
test('password callback cancellation settles promptly and the next PDF still parses', { timeout: 4000 }, async () => {
  const task = getDocument({ data: new Uint8Array(await readFile('test/fixtures/password-protected.pdf')) });
  let passwordProtected = false;
  task.onPassword = () => { passwordProtected = true; task.destroy(); };
  try { await assert.rejects(task.promise); assert.equal(passwordProtected, true); }
  finally { await task.destroy(); }
  assert.equal((await extract('public/samples/community-garden.pdf')).length, 2);
});
test('mixed text and image-only pages keep their actual page positions', async () => {
  const pages = await extract('test/fixtures/mixed-text-image.pdf');
  assert.equal(pages.length, 2); assert.match(pages[0], /18 households/); assert.equal(pages[1], '');
});
test('font style changes inside identifiers do not introduce artificial spaces', async () => {
  const pages = await extract('test/fixtures/font-switch.pdf');
  assert.equal(pages[0], 'AB123 is the account ID.');
});
