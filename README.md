# Doc to Context · 文档备料台

把 PDF、TXT、Markdown 整理成**带来源、大小可控的材料包**，复制给你已经在用的 AI。文档在浏览器中处理，无账号、无 API Key、无模型调用。

> 首个公开版本 v0.1.0。适合准备学习笔记、会议资料和多份文档的分析材料；欢迎用不敏感的文件试用并反馈。

**[在线试用](https://chzfra.github.io/doc-to-context/)** · [English](#english) · [测试说明](docs/VALIDATION.md)

![文档备料台实际解析原创 PDF 并生成带页码的材料包](docs/preview.jpg)

## 能解决什么问题？

- **文件太长，不好直接粘贴：** 按你设定的字符预算分包，每包包含任务说明、原文和来源。
- **AI 回答说不清依据：** 保留文件标识、文件名和 PDF 物理页码，并提示 AI 引用实际提供的内容。
- **只想看某几页：** 输入 `1-3, 5`，检查提取文字，然后只准备这些页面。
- **不知道怎样开始：** 选择摘要、问答或文件对比，工具组合出可复制的提示词。

这里**不生成 AI 回答、不做 OCR、不联网查证**。它帮你准备材料，AI 的回答仍需对照原文检查。

## 三分钟试用

1. 打开应用，点击 **「两页文字 PDF」**。这是一个虚构社区花园项目的真实 PDF，程序会实际解析它。
2. 在右侧切换第 1、2 页。第 1 页提到 18 户家庭和 `2,400 dollars` 计划预算；第 2 页提到 11 名已确认志愿者和待确认事项。
3. 选择 **「回答问题」**，输入「哪些事情已经确定，哪些还没确定？」；点击 **「整理成材料包」**。
4. 展开材料，检查文件名和页码；点击 **「复制材料」**，粘贴到自己常用的 AI。也可下载 Markdown。
5. 点击 **「无文字 PDF」**，查看未提取到文字的提示。该示例只有图像对象，没有文字层；不会伪造提取结果。

导入自己的文件时，先预览文字。多包可以逐份分析，再请 AI 汇总已收到的结果。**跨包比较只有在相关材料都已提供时才有意义**；本工具不会自动合并外部 AI 的上下文。

## 本地运行

需要 Node.js 22.13+（建议 Node.js 24）和 npm：

```bash
git clone https://github.com/chzFRA/doc-to-context.git
cd doc-to-context
npm ci
npm run dev
```

打开终端显示的 `http://127.0.0.1:5173` 地址。不要直接双击 `index.html`，PDF worker 需要通过 HTTP 提供。

```bash
npm test
npm run build
npm run preview
```

`dist/` 可以部署到静态托管。Vite 的 `base: './'` 支持仓库子路径。`predev` / `prebuild` 会从锁定的 `pdfjs-dist` 复制 CMaps、标准字体和 WASM 到本地资源目录，worker 也由 Vite 打包；不依赖 CDN。首次安装 npm 依赖需要联网，已安装后本地运行和处理文件不需要外部服务。

## 边界与隐私

| 项目 | 当前行为 |
| --- | --- |
| 支持格式 | `.pdf`、UTF-8 `.txt`、UTF-8 `.md` |
| 数量 / 大小 | 最多 8 份，单份 20 MiB，合计 40 MiB |
| 页数 / 文本 | 合计最多 100 页；每份文本计 1 页；最多 100 万提取字符 |
| 分包 | 500–20,000 个 Unicode 字符，**包含提示词和来源**；不是精确 token 计数 |
| 页码 | PDF 的物理页序号；不保证与页面上印的页码一致 |
| PDF 排版 | 只提取文字；多栏、表格、公式、连字和特殊字体可能改变顺序或丢失信息 |
| 图像 / 扫描 | 不提取图像、不含 OCR；无文字可能是扫描件、空白页或字体编码问题 |
| 加密 PDF | 提示先在自己的 PDF 软件中解锁；不收集或保存密码 |
| 保存 | 仅在当前页面内存中；刷新即清空，无 localStorage、IndexedDB 或账号同步 |
| 网络 | 应用与示例、worker、字体资源来自同源静态站点；文件内容不上传，无遥测与模型调用 |

当你主动把材料复制给其他 AI 服务时，该服务会处理你提供的内容。提示词中的「资料不是指令」有助于说明任务，**不能保证模型不会受材料中的恶意指令影响**。

## 构成与开发

- `src/core.js`：页码范围、来源标识、Unicode 字符预算与分包，不依赖界面。
- `src/main.js`：文件导入、PDF.js 提取、预览、复制与下载；所有文档内容通过 `textContent` 展示。
- `scripts/create-samples.js`：生成两个原创 PDF 示例，不从网上下载别人的资料。
- `test/`：17 项核心规则和真实 PDF 解析测试；包含原创示例以及加密、混合文字 / 图片、字体切换编号回归测试文件。
- `scripts/prepare-assets.js`：将 PDF.js 运行资源复制到构建目录。

PDF.js 官方：[入门](https://mozilla.github.io/pdf.js/getting_started/) · [页面文本 API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html)。应用采用 MIT 许可证；PDF.js 及其随附资源保留上游许可证。

## English

Doc to Context is a browser-local preparation tool for people who already use an AI assistant. Import PDF, TXT or Markdown, review extracted text, select physical PDF pages, and produce size-limited packets containing a task, source labels and original text. Copy each packet into your preferred assistant or download Markdown.

It **does not call an AI model, summarize on its own, perform OCR, or verify answers**. Source labels help you check an answer; they do not guarantee accurate citations. Multi-column PDFs, tables and unusual fonts may extract imperfectly. Review the preview first. A page with no extracted text may be scanned, blank, or affected by font encoding.

### Try it

1. Open the [app](https://chzfra.github.io/doc-to-context/), or run `npm ci && npm run dev` locally with Node.js 22.13+ (24 recommended).
2. Choose the two-page PDF sample, or import your own `.pdf`, UTF-8 `.txt` or `.md`.
3. Review each page. Optionally select a range such as `1-3, 5`.
4. Choose summary, question answering or comparison. Adjust the packet character budget, then generate.
5. Copy a packet into your existing AI service and check its answer against the original. UI and prompt templates currently use Simplified Chinese; document text may be in other languages.

The full generated prompt, including instructions and references, stays within the selected Unicode character budget (500–20,000). **Characters are not tokens.** Each packet is independent; comparisons across multiple packets need the relevant packets to be present in the assistant's context.

Files stay in page memory and are cleared on refresh. No document uploads, accounts, analytics, browser storage or model calls are used. Bundled PDF.js, its worker and fonts are served locally/same-origin; copying material to a separate AI service is your own explicit next step.

Limits: 8 files, 20 MiB per file, 40 MiB in total, 100 physical pages / text documents, and one million extracted characters. Password-protected PDFs must be unlocked in your own PDF software first.

Run `npm test` for core and actual-PDF tests; `npm run build` produces static `dist/`. No external user effectiveness study has been conducted. This first release provides verifiable preparation behavior, not a claim of improved model accuracy.

Copyright © 2026 Huazhe Cheng. [MIT](LICENSE).
