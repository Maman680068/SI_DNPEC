// Guides de prise en main d'UNE page par profil (formation, octobre 2026), en PDF A4 :
// docs/formation/Prise_en_main_<profil>.pdf et le recueil Prise_en_main_tous_profils.pdf.
// Contenu : docs/formation/prise_en_main.json ; captures : apps/web/public/aide/ (celles du guide
// d'aide, régénérées par captures_aide.js). Échoue si une fiche dépasse une page.
//   PW_CHROMIUM=/opt/pw-browsers/chromium node tests/e2e/outils/prise_en_main_pdf.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RACINE = path.resolve(__dirname, '../../..');
const DEST = path.join(RACINE, 'docs/formation');
const AIDE = path.join(RACINE, 'apps/web/public/aide');
const { profils } = JSON.parse(fs.readFileSync(path.join(DEST, 'prise_en_main.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function fiche(p) {
  const img = fs.existsSync(path.join(AIDE, p.capture)) ? `data:image/png;base64,${fs.readFileSync(path.join(AIDE, p.capture)).toString('base64')}` : null;
  return `<section class="fiche">
    <div class="bande"><span style="background:#CE1126"></span><span style="background:#F0B429"></span><span style="background:#1C8B4B"></span></div>
    <div class="tete"><div class="sigle">SI DNPEC — prise en main</div><h1>${esc(p.titre)}</h1><div class="pour">${esc(p.pour)}</div></div>
    ${img ? `<img src="${img}" alt="">` : ''}
    <h2>Vos gestes essentiels</h2>
    <ol>${p.gestes.map((g) => `<li>${esc(g)}</li>`).join('')}</ol>
    <h2>À retenir</h2>
    <ul>${p.retenir.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
    <div class="pied">Aide complète : menu « Aide » de l’application (guides de votre profil et guide PDF). Un problème : l’administrateur système (CSID).</div>
  </section>`;
}

const STYLE = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #1C2233; }
  .fiche { width: 210mm; height: 297mm; padding: 12mm 15mm 10mm; position: relative; page-break-after: always; overflow: hidden; }
  .fiche:last-child { page-break-after: auto; }
  .bande { display: flex; height: 2.2mm; margin: -12mm -15mm 8mm; }
  .bande span { flex: 1; }
  .sigle { font-size: 9pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #1C8B4B; }
  h1 { margin: 1mm 0 0; font-size: 20pt; color: #1B2A6B; }
  .pour { font-size: 10pt; color: #5C6270; margin-bottom: 4mm; }
  img { width: 100%; max-height: 92mm; object-fit: cover; object-position: top; border: 1px solid #E2E4EE; border-radius: 2mm; }
  h2 { font-size: 12pt; color: #1B2A6B; margin: 5mm 0 2mm; }
  ol, ul { margin: 0; padding-left: 6mm; font-size: 10.2pt; line-height: 1.42; }
  li { margin-bottom: 1.6mm; }
  .pied { position: absolute; bottom: 9mm; left: 15mm; right: 15mm; font-size: 8.5pt; color: #5C6270; border-top: 1px solid #E2E4EE; padding-top: 2mm; }
`;
const html = (corps) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${STYLE}</style></head><body>${corps}</body></html>`;
const pages = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const p = await b.newPage();
  let erreurs = 0;
  for (const prof of profils) {
    await p.setContent(html(fiche(prof)), { waitUntil: 'load' });
    const pdf = await p.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    const n = pages(pdf);
    fs.writeFileSync(path.join(DEST, `Prise_en_main_${prof.cle}.pdf`), pdf);
    console.log(`${n === 1 ? '  ✓' : '  ✗'} Prise_en_main_${prof.cle}.pdf (${n} page${n > 1 ? 's' : ''})`);
    if (n !== 1) erreurs++;
  }
  await p.setContent(html(profils.map(fiche).join('')), { waitUntil: 'load' });
  const tout = await p.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(path.join(DEST, 'Prise_en_main_tous_profils.pdf'), tout);
  console.log(`  ✓ Prise_en_main_tous_profils.pdf (${pages(tout)} pages)`);
  await b.close();
  if (erreurs) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
