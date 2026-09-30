import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePageRange, createPackets, selectedPages, characterCount, packetsMarkdown, safeSourceName } from '../src/core.js';

test('page ranges accept commas, Chinese commas, duplicates and whitespace in sorted order', () => {
  assert.deepEqual(parsePageRange(' 4, 1-2，2 ', 5), [1, 2, 4]);
  assert.deepEqual(parsePageRange('', 3), [1, 2, 3]);
});
test('page ranges reject invalid, descending, zero, out-of-range and unsafe integers', () => {
  for (const value of ['0', '3-1', '6', '1,,2', '1.5', '-1', '1-', 'foo', '9007199254740992']) assert.throws(() => parsePageRange(value, 5));
  for (const count of [0, 101, 1.5, Infinity, 9007199254740992]) assert.throws(() => parsePageRange('1', count));
});
test('selection preserves actual physical PDF page references, never renumbers selected pages', () => {
  const files = [{ id: 9, sourceId: 'S09', name: 'brief.pdf', kind: 'pdf', range: '2', pages: [{ number: 1, text: 'a' }, { number: 2, text: 'b' }] }];
  const pages = selectedPages(files);
  assert.equal(pages.length, 1); assert.equal(pages[0].label, 'S09 | brief.pdf | PDF 第 2 页'); assert.equal(pages[0].text, 'b');
});
test('same-named files remain identifiable through unique source IDs', () => {
  const files = [1, 2].map(id => ({ id, sourceId: `S0${id}`, name: 'notes.md', kind: 'text', pages: [{ number: 1, text: `fact ${id}` }] }));
  const packets = createPackets(selectedPages(files));
  assert.equal(packets[0].sources.length, 2); assert.match(packets[0].text, /S01/); assert.match(packets[0].text, /S02/);
});
test('complete prompt plus references fits every budget and preserves long Unicode text without loss', () => {
  const text = '🌱你好 e\u0301｜garden\n'.repeat(500);
  for (const budget of [500, 600, 1000, 6000, 20000]) {
    const packets = createPackets([{ label: 'S01 | 🌱.pdf | PDF 第 9 页', text }], { budget });
    assert.ok(packets.every(packet => packet.characters <= budget && packet.characters === characterCount(packet.text)));
    assert.equal(packets.flatMap(packet => packet.excerpts).map(part => part.text).join(''), text);
    assert.ok(packets.every(packet => packet.text.includes('PDF 第 9 页')));
  }
});
test('multiple pages are preserved and a packet never contains an unattributed excerpt', () => {
  const pages = Array.from({ length: 9 }, (_, index) => ({ label: `S01 | page ${index + 1}`, text: `unique ${index}: ${'abc '.repeat(145)}` }));
  const packets = createPackets(pages, { budget: 900 });
  for (const page of pages) assert.equal(packets.flatMap(packet => packet.excerpts).filter(part => part.label === page.label).map(part => part.text).join(''), page.text);
});
test('whitespace pages are skipped, but an entirely empty selection is clearly rejected', () => {
  assert.equal(createPackets([{ label: 'blank', text: '  \n' }, { label: 'text', text: 'hello' }]).length, 1);
  assert.throws(() => createPackets([{ label: 'blank', text: '' }]), /可能是扫描件、空白页或字体编码问题/);
});
test('invalid budget and overlong questions fail instead of producing oversized output', () => {
  for (const budget of [0, 499, 20001, 500.5, NaN, Infinity]) assert.throws(() => createPackets([{ label: 'a', text: 'b' }], { budget }));
  assert.throws(() => createPackets([{ label: 'a', text: 'b' }], { question: 'x'.repeat(401) }), /400/);
  assert.throws(() => createPackets([{ label: 'a', text: 'b' }], { budget: 500, mode: 'question', question: 'x'.repeat(400) }), /预算太小/);
});
test('question and comparison modes include evidence constraints and actual user question', () => {
  const page = [{ label: 'S01 | notes | 文本全文', text: 'actual evidence' }];
  assert.match(createPackets(page, { mode: 'question', question: '谁负责？' })[0].text, /谁负责？/);
  assert.match(createPackets(page, { mode: 'compare' })[0].text, /不能编造另一方观点/);
});
test('source labels neutralize newline delimiters and Markdown-like filename input', () => {
  assert.equal(safeSourceName('x\n[evil]|<img>.md'), 'x evil img .md');
  assert.ok(characterCount(safeSourceName('😀'.repeat(200))) <= 100);
});
test('Markdown download includes complete prompt, source labels and packet sequence', () => {
  const packets = createPackets([{ label: 'S03 | notes | 文本全文', text: 'fact '.repeat(300) }], { budget: 500 });
  const md = packetsMarkdown(packets);
  assert.match(md, /字符数不是 token 数/);
  packets.forEach(packet => assert.ok(md.includes(packet.text)));
  assert.match(md, new RegExp(`材料包 ${packets.length} / ${packets.length}`));
});
