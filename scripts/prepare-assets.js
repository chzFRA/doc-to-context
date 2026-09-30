import { cp, mkdir } from 'node:fs/promises';
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
  await mkdir('public/vendor/pdfjs', { recursive: true });
  await cp(`node_modules/pdfjs-dist/${directory}`, `public/vendor/pdfjs/${directory}`, { recursive: true });
}
await cp('node_modules/pdfjs-dist/LICENSE', 'public/vendor/pdfjs/LICENSE');
