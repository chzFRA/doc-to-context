import './style.css';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { LIMITS, characterCount, parsePageRange, selectedPages, createPackets, packetsMarkdown, pdfItemsText } from './core.js';

GlobalWorkerOptions.workerSrc = workerUrl;
const $ = id => document.getElementById(id);
const state = { files: [], nextId: 1, packets: [], selectedId: null, page: 1, busy: false };
const emptyWarning = '本页没有提取到文字：可能是扫描件、空白页或字体编码问题。这里不含 OCR；请核对原文，必要时先做 OCR。';
function element(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
function notice(message = '', error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); $('notice').hidden = !message; }
function totals() { return state.files.reduce((sum, file) => ({ bytes: sum.bytes + file.bytes, pages: sum.pages + file.pages.length, chars: sum.chars + file.characters }), { bytes: 0, pages: 0, chars: 0 }); }
function mode() { return document.querySelector('input[name="mode"]:checked').value; }
function invalidatePackets() { state.packets = []; renderPackets(); }
function setBusy(busy, message = '') {
  state.busy = busy;
  for (const id of ['file-input', 'sample-text', 'sample-scan']) $(id).disabled = busy;
  $('clear').disabled = busy || !state.files.length;
  $('progress').hidden = !busy;
  $('progress-text').textContent = message;
  document.querySelectorAll('.remove-file,.file-range input').forEach(el => { el.disabled = busy; });
  updateGenerate();
}
function updateGenerate() {
  let valid = !!state.files.length;
  for (const file of state.files) { try { parsePageRange(file.range, file.pages.length); } catch { valid = false; } }
  $('generate').disabled = state.busy || !valid;
}

async function extractPdf(file, remainingPages, remainingCharacters) {
  const data = new Uint8Array(await file.arrayBuffer());
  const base = new URL(`${import.meta.env.BASE_URL}vendor/pdfjs/`, location.href).href;
  const task = getDocument({ data, cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/`, isEvalSupported: false });
  let passwordProtected = false;
  task.onPassword = () => { passwordProtected = true; task.destroy(); };
  try {
    const pdf = await task.promise;
    if (pdf.numPages > remainingPages) throw new Error(`合计最多 ${LIMITS.pages} 页；请拆分文件后再导入。`);
    const pages = [];
    let characters = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      $('progress-text').textContent = `正在读取 ${file.name} · 第 ${number} / ${pdf.numPages} 页`;
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = pdfItemsText(content.items);
      characters += characterCount(text);
      if (characters > remainingCharacters) throw new Error('提取的文字合计超过 100 万字符，请拆分文件后再导入。');
      pages.push({ number, text });
      page.cleanup();
    }
    return { pages, characters };
  } catch (error) {
    if (passwordProtected || error.name === 'PasswordException') throw new Error('这份 PDF 需要密码。请先在自己的 PDF 软件中解锁，再导入。');
    if (['InvalidPDFException', 'UnknownErrorException'].includes(error.name)) throw new Error('无法读取 PDF，它可能已损坏或格式不受支持。请重新导出 PDF 后再试。');
    throw error;
  } finally { await task.destroy(); }
}

async function importFiles(incoming) {
  if (state.busy) return;
  const candidates = Array.from(incoming);
  if (!candidates.length) return;
  setBusy(true, '正在准备文件…'); notice();
  const failures = []; let added = 0;
  try {
    for (const file of candidates) {
      try {
        const current = totals();
        if (state.files.length >= LIMITS.files) throw new Error('最多同时导入 8 份文件，请先删除一些文件。');
        if (!/\.(pdf|txt|md)$/i.test(file.name)) throw new Error('只支持 .pdf、.txt 和 .md 文件。');
        if (!file.size) throw new Error('这是一个空文件。');
        if (file.size > LIMITS.fileBytes) throw new Error('单份文件不能超过 20 MB。');
        if (current.bytes + file.size > LIMITS.totalBytes) throw new Error('文件大小合计不能超过 40 MB。');
        if (state.files.some(item => item.name === file.name && item.bytes === file.size && item.lastModified === file.lastModified)) throw new Error('这份文件已导入。');
        const kind = /\.pdf$/i.test(file.name) ? 'pdf' : 'text';
        let extracted;
        if (kind === 'pdf') extracted = await extractPdf(file, LIMITS.pages - current.pages, LIMITS.textCharacters - current.chars);
        else {
          if (current.pages >= LIMITS.pages) throw new Error('合计最多 100 页；每份文本文件计为 1 页。');
          let text;
          try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/\r\n?/g, '\n'); }
          catch { throw new Error('文字编码无法识别。请把文件另存为 UTF-8 编码后再试。'); }
          const characters = characterCount(text);
          if (characters + current.chars > LIMITS.textCharacters) throw new Error('提取的文字合计超过 100 万字符，请拆分文件后再导入。');
          extracted = { pages: [{ number: 1, text }], characters };
        }
        const id = state.nextId++;
        const record = { id, sourceId: `S${String(id).padStart(2, '0')}`, name: file.name, kind, bytes: file.size, lastModified: file.lastModified, range: '', ...extracted };
        state.files.push(record); state.selectedId = id; state.page = 1; added++;
        invalidatePackets(); renderFiles(); renderPreview();
      } catch (error) { failures.push(`${file.name}：${error.message || '读取失败，请检查文件后重试。'}`); }
    }
  } finally { setBusy(false); $('file-input').value = ''; }
  const emptyPages = state.files.reduce((sum, file) => sum + file.pages.filter(page => !page.text.trim()).length, 0);
  if (failures.length) notice(`${added ? `已成功导入 ${added} 份，其余文件未加入。\n` : ''}${failures.join('\n')}`, true);
  else if (emptyPages) notice(`已导入。共有 ${emptyPages} 页未提取到文字，可能是扫描件、空白页或字体编码问题；请在预览中检查。`);
  else notice(`已导入 ${added} 份文件。先检查文字，再整理材料包。`);
}

function renderFiles() {
  $('file-list').replaceChildren();
  for (const file of state.files) {
    const li = element('li', 'file-card');
    const top = element('div', 'file-card-top');
    top.append(element('span', 'file-symbol', file.kind === 'pdf' ? 'PDF' : 'TXT'));
    const info = element('div', 'file-info');
    const name = element('div', 'file-name', file.name); name.title = file.name;
    info.append(name, element('div', 'file-meta', `${file.sourceId} · ${file.pages.length} ${file.kind === 'pdf' ? '页' : '份全文'} · ${file.characters.toLocaleString()} 字符`));
    const remove = element('button', 'remove-file', '×'); remove.setAttribute('aria-label', `删除 ${file.name}`); remove.disabled = state.busy;
    remove.addEventListener('click', () => {
      state.files = state.files.filter(item => item.id !== file.id);
      if (state.selectedId === file.id) { state.selectedId = state.files[0]?.id ?? null; state.page = 1; }
      invalidatePackets(); renderFiles(); renderPreview(); setBusy(false); notice();
    });
    top.append(info, remove); li.append(top);
    if (file.kind === 'pdf') {
      const range = element('label', 'file-range', '选取页码');
      const input = document.createElement('input'); input.type = 'text'; input.placeholder = '全部页，例如 1-3, 5'; input.value = file.range; input.setAttribute('aria-label', `${file.name} 的页码范围`); input.disabled = state.busy;
      const error = element('p', 'range-error'); error.id = `range-error-${file.id}`; input.setAttribute('aria-describedby', error.id);
      input.addEventListener('input', () => {
        file.range = input.value; invalidatePackets();
        try { parsePageRange(file.range, file.pages.length); error.textContent = ''; input.setAttribute('aria-invalid', 'false'); }
        catch (failure) { error.textContent = failure.message; input.setAttribute('aria-invalid', 'true'); }
        updateGenerate();
      });
      try { parsePageRange(file.range, file.pages.length); } catch (failure) { error.textContent = failure.message; input.setAttribute('aria-invalid', 'true'); }
      range.append(input); li.append(range, error);
    }
    $('file-list').append(li);
  }
  $('clear').disabled = state.busy || !state.files.length;
  updateGenerate();
}

function renderPreview() {
  const file = state.files.find(item => item.id === state.selectedId);
  $('preview-empty').hidden = !!file; $('preview-content').hidden = !file;
  $('preview-count').textContent = state.files.length ? `${totals().pages} 页 / 全文` : '等待文档';
  $('preview-file').replaceChildren();
  for (const item of state.files) { const option = element('option', '', `${item.sourceId} · ${item.name}`); option.value = item.id; option.selected = item.id === state.selectedId; $('preview-file').append(option); }
  if (!file) { $('page-text').textContent = ''; return; }
  state.page = Math.min(Math.max(state.page, 1), file.pages.length);
  const page = file.pages[state.page - 1];
  $('page-label').textContent = file.kind === 'pdf' ? `PDF 第 ${state.page} / ${file.pages.length} 页` : '文本全文';
  $('previous-page').disabled = state.page <= 1; $('next-page').disabled = state.page >= file.pages.length;
  $('page-text').textContent = page.text || '（没有提取到文字）';
  $('page-warning').hidden = !!page.text.trim(); $('page-warning').textContent = emptyWarning;
}

function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderPackets() {
  $('packet-list').replaceChildren();
  const has = !!state.packets.length;
  for (const id of ['result-summary', 'download-all', 'next-step']) $(id).hidden = !has;
  $('result-empty').hidden = has;
  if (!has) return;
  $('result-summary').textContent = `已整理 ${state.packets.length} 包 · 共 ${state.packets.reduce((sum, packet) => sum + packet.characters, 0).toLocaleString()} 字符（含提示词）· ${mode() === 'summary' ? '摘要' : mode() === 'question' ? '问答' : '对比'}任务`;
  state.packets.forEach((packet, index) => {
    const card = element('article', 'packet-card'); const heading = element('div', 'packet-heading');
    const description = element('div'); description.append(element('h3', '', `材料包 ${String(index + 1).padStart(2, '0')}`), element('small', '', `${packet.characters.toLocaleString()} 字符 · ${packet.sources.length} 个页面 / 全文来源`));
    const actions = element('div', 'packet-actions');
    const copy = element('button', 'button primary', '复制材料'); copy.setAttribute('aria-label', `复制材料包 ${index + 1}`);
    const details = document.createElement('details'); const summary = element('summary', '', '查看完整提示词和材料'); const text = element('pre', 'packet-text', packet.text); text.tabIndex = 0;
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(packet.text); copy.textContent = '已复制 ✓'; setTimeout(() => { copy.textContent = '复制材料'; }, 1800); notice(`材料包 ${index + 1} 已复制，现在可以粘贴到你常用的 AI。`); }
      catch { details.open = true; const range = document.createRange(); range.selectNodeContents(text); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); text.focus(); notice('浏览器未允许自动复制。材料已展开并选中，请按 Ctrl+C 或 ⌘C，也可以下载 Markdown。'); }
    });
    const save = element('button', 'button secondary', '下载'); save.setAttribute('aria-label', `下载材料包 ${index + 1}`); save.addEventListener('click', () => download(packet.text, `doc-context-${String(index + 1).padStart(2, '0')}.md`));
    actions.append(copy, save); heading.append(description, actions); details.append(summary, text); card.append(heading, details); $('packet-list').append(card);
  });
}

$('file-input').addEventListener('change', event => importFiles(event.target.files));
for (const eventName of ['dragenter', 'dragover']) $('dropzone').addEventListener(eventName, event => { event.preventDefault(); if (!state.busy) $('dropzone').classList.add('dragging'); });
for (const eventName of ['dragleave', 'drop']) $('dropzone').addEventListener(eventName, event => { event.preventDefault(); $('dropzone').classList.remove('dragging'); });
$('dropzone').addEventListener('drop', event => importFiles(event.dataTransfer.files));
$('clear').addEventListener('click', () => { state.files = []; state.selectedId = null; state.page = 1; state.nextId = 1; invalidatePackets(); renderFiles(); renderPreview(); notice('已清空本次导入的内容。'); });
$('preview-file').addEventListener('change', event => { state.selectedId = Number(event.target.value); state.page = 1; renderPreview(); });
$('previous-page').addEventListener('click', () => { state.page--; renderPreview(); });
$('next-page').addEventListener('click', () => { state.page++; renderPreview(); });
document.querySelectorAll('input[name="mode"]').forEach(input => input.addEventListener('change', () => { $('question-area').hidden = mode() !== 'question'; invalidatePackets(); }));
for (const id of ['budget', 'question']) $(id).addEventListener('input', invalidatePackets);
$('generate').addEventListener('click', () => {
  try {
    const pages = selectedPages(state.files);
    state.packets = createPackets(pages, { budget: Number($('budget').value), mode: mode(), question: $('question').value });
    renderPackets();
    const skipped = pages.filter(page => !page.text.trim()).length;
    notice(`材料已准备好。${skipped ? ` ${skipped} 个无文字页面已跳过，请核对原文。` : ''}`);
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { invalidatePackets(); notice(error.message, true); }
});
$('download-all').addEventListener('click', () => download(packetsMarkdown(state.packets), 'doc-to-context-materials.md'));
async function loadSample(name) {
  if (state.busy) return;
  setBusy(true, '正在打开示例 PDF…');
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}samples/${name}`);
    if (!response.ok) throw new Error('示例加载失败，请检查网络，或改用本地文件。');
    const data = await response.blob(); setBusy(false);
    await importFiles([new File([data], name, { type: 'application/pdf', lastModified: 0 })]);
  } catch (error) { setBusy(false); notice(error.message, true); }
}
$('sample-text').addEventListener('click', () => loadSample('community-garden.pdf'));
$('sample-scan').addEventListener('click', () => loadSample('image-only.pdf'));
