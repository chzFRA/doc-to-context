import { writeFile, mkdir } from 'node:fs/promises';
// Self-authored fixtures. PDF byte offsets are computed from the actual bytes.
function pdf(objects) {
  const parts = [Buffer.from('%PDF-1.4\n')]; const offsets = [0]; let size = parts[0].length;
  objects.forEach((body, index) => { offsets.push(size); const part = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), Buffer.isBuffer(body) ? body : Buffer.from(body), Buffer.from('\nendobj\n')]); parts.push(part); size += part.length; });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));
  return Buffer.concat(parts);
}
function stream(text) { const data = Buffer.isBuffer(text) ? text : Buffer.from(text); return Buffer.concat([Buffer.from(`<< /Length ${data.length} >>\nstream\n`), data, Buffer.from('\nendstream')]); }
function textPage(lines) { return stream(`BT /F1 16 Tf 52 740 Td 24 TL\n${lines.map((line, i) => `${i ? 'T* ' : ''}(${line.replace(/[()\\]/g, '\\$&')}) Tj`).join('\n')}\nET`); }
const page1 = ['COMMUNITY GARDEN - PROJECT BRIEF', '', 'This is a fictional sample created for Doc to Context.', 'Goal: grow vegetables and share weekly gardening lessons.', 'Start date: 12 April 2027.', 'Participants: 18 households.', 'Available space: 120 square metres.', 'Planned budget: 2,400 dollars.', '', 'The planning group has not selected a supplier yet.', 'The final water-access agreement is still pending.'];
const page2 = ['COMMUNITY GARDEN - MEETING NOTES', '', 'Meeting date: 3 March 2027.', 'Confirmed volunteers: 11 people.', 'Raised beds: 8 beds planned for the first stage.', 'The first stage will use 80 square metres.', 'The remaining area is reserved for paths and storage.', '', 'Action: Alex will compare three supplier quotations.', 'Action: Mei will confirm water access by 20 March.', 'A final cost has not been approved.', 'Do not treat the planned budget as an actual expense.'];
const textPdf = pdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', textPage(page1), textPage(page2)]);
// One raster image, deliberately without any PDF text object or text layer.
const width = 160, height = 100; const pixels = Buffer.alloc(width * height * 3, 246);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const ink = (x > 15 && x < 144 && y > 16 && y < 25) || (x > 15 && x < 120 && [39, 51, 63, 75].some(line => y >= line && y < line + 3));
  if (ink) { const pos = (y * width + x) * 3; pixels[pos] = 77; pixels[pos + 1] = 76; pixels[pos + 2] = 100; }
}
const imageObject = Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n`), pixels, Buffer.from('\nendstream')]);
const imagePdf = pdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>', imageObject, stream('q 480 0 0 300 55 450 cm /Im1 Do Q')]);
await mkdir('public/samples', { recursive: true });
await writeFile('public/samples/community-garden.pdf', textPdf);
await writeFile('public/samples/image-only.pdf', imagePdf);
await mkdir('test/fixtures', { recursive: true });
await writeFile('test/fixtures/font-switch.pdf', pdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>', stream('BT /F1 12 Tf 20 100 Td (AB) Tj /F2 12 Tf (123) Tj /F1 12 Tf ( is the account ID.) Tj ET')]));
console.log('Created two self-authored sample PDFs and the font-switch regression fixture.');
