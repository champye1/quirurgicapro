import puppeteer from 'puppeteer';
import { marked } from 'marked';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DOCS = [
  {
    input:     resolve(ROOT, 'docs/manual_pabellon.md'),
    output:    resolve(ROOT, 'docs/manual_pabellon.pdf'),
    title:     'Manual de Usuario — Módulo de Gestión de Pabellón',
    shortTitle: 'GESTIÓN DE PABELLÓN',
    subtitle:  'Módulo de Gestión de Pabellón',
    role:      'Personal Administrativo de Pabellón Quirúrgico',
    version:   '1.0',
    date:      'Mayo 2026',
    system:    'QuirúrgicaPro',
  },
  {
    input:     resolve(ROOT, 'docs/manual_doctor.md'),
    output:    resolve(ROOT, 'docs/manual_doctor.pdf'),
    title:     'Manual de Usuario — Rol: Médico / Cirujano',
    shortTitle: 'MANUAL DEL MÉDICO',
    subtitle:  'Rol: Médico / Cirujano',
    role:      'Médicos y Cirujanos',
    version:   '1.0',
    date:      'Mayo 2026',
    system:    'QuirúrgicaPro',
  },
];

// ─── APA CSS ─────────────────────────────────────────────────────────────────
const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 2;
    color: #000000;
    background: #ffffff;
  }

  /* ── Portada ── */
  .portada {
    page-break-after: always;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 72pt;
    text-align: center;
  }
  .portada .sistema {
    font-size: 14pt;
    font-weight: bold;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #1e3a5f;
    margin-bottom: 80pt;
  }
  .portada h1 {
    font-size: 16pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 12pt;
    border: none;
  }
  .portada .subtitulo {
    font-size: 14pt;
    font-style: italic;
    margin-bottom: 48pt;
  }
  .portada .meta-block {
    font-size: 12pt;
    line-height: 2;
  }
  .portada .meta-block p { margin: 0; }

  /* ── Página de contenido ── */
  .page {
    padding: 72pt;        /* 1 pulgada = 72pt */
  }

  /* ── Encabezados APA ── */
  /* Nivel 1: Centrado, negrita */
  h1 {
    font-size: 12pt;
    font-weight: bold;
    font-style: normal;
    text-align: center;
    margin: 24pt 0 0;
    padding: 0;
    border: none;
    color: #000;
    page-break-after: avoid;
  }
  /* Nivel 2: Alineado izquierda, negrita */
  h2 {
    font-size: 12pt;
    font-weight: bold;
    font-style: normal;
    text-align: left;
    margin: 24pt 0 0;
    padding: 0;
    border: none;
    color: #000;
    page-break-after: avoid;
  }
  /* Nivel 3: Alineado izquierda, negrita cursiva */
  h3 {
    font-size: 12pt;
    font-weight: bold;
    font-style: italic;
    text-align: left;
    margin: 24pt 0 0;
    padding: 0;
    color: #000;
    page-break-after: avoid;
  }
  /* Nivel 4: Sangría, negrita, punto final en línea */
  h4 {
    font-size: 12pt;
    font-weight: bold;
    font-style: normal;
    text-align: left;
    margin: 24pt 0 0;
    padding-left: 36pt;
    color: #000;
    page-break-after: avoid;
  }

  /* ── Párrafos ── */
  p {
    margin: 0;
    text-indent: 36pt;
    text-align: justify;
  }
  /* Párrafos sin sangría: inmediatamente después de encabezado */
  h1 + p, h2 + p, h3 + p, h4 + p,
  ul + p, ol + p, table + p, figure + p,
  .tabla-wrapper + p, blockquote + p, pre + p,
  hr + p {
    text-indent: 0;
  }

  ul, ol {
    margin: 0 0 0 72pt;
    padding: 0;
  }
  li { margin: 0; text-align: justify; }

  /* ── Figuras (APA) ── */
  figure {
    margin: 24pt 0;
    text-align: center;
    page-break-inside: avoid;
  }
  figure img {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    border: 1px solid #ccc;
    margin: 0 auto 6pt;
  }
  figcaption {
    font-size: 11pt;
    text-align: left;
    text-indent: 0;
    color: #000;
    line-height: 1.5;
  }
  figcaption .fig-label { font-style: italic; }

  /* ── Tablas (APA) ── */
  .tabla-wrapper {
    margin: 24pt 0;
    page-break-inside: avoid;
  }
  .tabla-numero {
    font-size: 12pt;
    font-style: italic;
    font-weight: normal;
    text-align: left;
    margin-bottom: 2pt;
  }
  .tabla-titulo {
    font-size: 12pt;
    font-weight: bold;
    text-align: left;
    margin-bottom: 6pt;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11pt;
    line-height: 1.5;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
  }
  thead tr { border-bottom: 1px solid #000; }
  th {
    font-weight: bold;
    text-align: left;
    padding: 4pt 8pt;
    background: transparent;
    color: #000;
  }
  td {
    padding: 4pt 8pt;
    vertical-align: top;
    border: none;
  }

  /* ── Código / pre ── */
  pre {
    font-family: 'Courier New', monospace;
    font-size: 10pt;
    line-height: 1.5;
    background: #f8f8f8;
    border: 1px solid #ddd;
    padding: 12pt 16pt;
    margin: 12pt 0;
    white-space: pre-wrap;
    text-indent: 0;
  }
  code {
    font-family: 'Courier New', monospace;
    font-size: 10pt;
  }

  /* ── Nota / Blockquote (aviso) ── */
  blockquote {
    margin: 12pt 0 12pt 36pt;
    font-size: 11pt;
    color: #1e3a5f;
    border-left: 3px solid #1e3a5f;
    padding-left: 12pt;
    line-height: 1.6;
  }
  blockquote p { text-indent: 0; }

  /* ── Línea divisoria ── */
  hr {
    border: none;
    border-top: 1px solid #999;
    margin: 24pt 0;
  }

  /* Saltos de página */
  h1 { page-break-before: always; }
  /* La primera h1 del cuerpo no rompe página */
  .page > h1:first-child { page-break-before: avoid; }

  @media print {
    body { background: #fff; }
  }
`;

// ─── Portada HTML ─────────────────────────────────────────────────────────────
function buildPortada(doc) {
  return `
  <div class="portada">
    <div class="sistema">${doc.system}</div>
    <h1>${doc.title}</h1>
    <div class="subtitulo">${doc.subtitle}</div>
    <div class="meta-block">
      <p><strong>Dirigido a:</strong> ${doc.role}</p>
      <p><strong>Versión:</strong> ${doc.version}</p>
      <p><strong>Fecha:</strong> ${doc.date}</p>
    </div>
  </div>`;
}

// ─── Post-proceso APA: figuras y tablas ──────────────────────────────────────
function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/^\d+(\.\d+)*\s+/, '').trim();
}

function applyApaFormatting(html) {
  let figCount = 0;
  let tableCount = 0;
  let lastHeading = '';

  // Procesamos token a token rastreando el último encabezado visto
  const result = html.replace(
    /(<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>)|(<table>)|(<img([^>]*?)alt="([^"]*)"([^>]*)>)/g,
    (match, fullH, hInner, tableOpen, imgFull, imgBefore, imgAlt, imgAfter) => {
      if (fullH) {
        lastHeading = stripTags(hInner);
        return match; // encabezado sin cambios
      }
      if (tableOpen) {
        tableCount++;
        const titulo = lastHeading || `Tabla ${tableCount}`;
        return `<div class="tabla-wrapper">
  <div class="tabla-numero">Tabla ${tableCount}</div>
  <div class="tabla-titulo">${titulo}</div>
  <table>`;
      }
      if (imgFull) {
        figCount++;
        const label = `Figura ${figCount}`;
        const caption = imgAlt || label;
        return `<figure>
  <img${imgBefore}alt="${imgAlt}"${imgAfter}>
  <figcaption><span class="fig-label">${label}</span>. ${caption}</figcaption>
</figure>`;
      }
      return match;
    }
  );

  return result.replace(/<\/table>/g, '</table></div>');
}

// ─── Markdown → HTML ─────────────────────────────────────────────────────────
function mdToHtml(mdPath, doc) {
  const md = readFileSync(mdPath, 'utf8');
  const docsDir = dirname(mdPath);

  // Quitar el bloque de encabezado del .md (title, versión, fecha) — ya está en portada
  const mdBody = md
    .replace(/^#[^\n]*\n/, '')                   // primera h1
    .replace(/^\*\*Versión\*\*.*\n/m, '')
    .replace(/^\*\*Fecha\*\*.*\n/m, '')
    .replace(/^\*\*Dirigido a\*\*.*\n/m, '')
    .replace(/^\*\*Sistema\*\*.*\n/m, '');

  // Embeber imágenes como base64
  const mdFixed = mdBody.replace(
    /!\[([^\]]*)\]\(\.\.\/screenshots\/([^)]+)\)/g,
    (_, alt, file) => {
      const imgPath = resolve(docsDir, '../screenshots', file);
      try {
        const data = readFileSync(imgPath);
        const b64 = data.toString('base64');
        const ext = file.split('.').pop().toLowerCase();
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        return `![${alt}](data:${mime};base64,${b64})`;
      } catch {
        console.warn(`  ⚠ No encontrada: ${file}`);
        return '';
      }
    }
  );

  let body = marked(mdFixed);
  body = applyApaFormatting(body);

  const shortTitle = doc.shortTitle;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${doc.title}</title>
  <style>${CSS}</style>
</head>
<body>
  ${buildPortada(doc)}
  <div class="page">
    ${body}
  </div>
</body>
</html>`;
}

// ─── Generar PDF ─────────────────────────────────────────────────────────────
async function generatePdf(browser, doc) {
  const { output } = doc;
  const fileName = output.split('\\').pop().split('/').pop();
  console.log(`Generando: ${fileName}`);

  const html = mdToHtml(doc.input, doc);

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });

  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise(r => { img.onload = r; img.onerror = r; })
      )
    )
  );

  await page.pdf({
    path: output,
    format: 'A4',
    margin: { top: '25mm', right: '25mm', bottom: '25mm', left: '25mm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="width:100%;display:flex;justify-content:space-between;
                  font-family:'Times New Roman',Times,serif;font-size:9pt;
                  color:#000;padding:10mm 25mm 0;box-sizing:border-box;">
        <span>${doc.shortTitle}</span>
        <span class="pageNumber"></span>
      </div>`,
    footerTemplate: '<span></span>',
  });

  await page.close();
  console.log(`  ✓ ${fileName}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const doc of DOCS) {
      await generatePdf(browser, doc);
    }
    console.log('\nPDFs generados en docs/');
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
