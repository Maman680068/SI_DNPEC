// Guide utilisateur imprimable (docs/Guide_utilisateur_SI_DNPEC.pdf) : même contenu que la
// page /aide (apps/web/lib/aide/guides.json) et mêmes captures (apps/web/public/aide).
//   node tests/e2e/outils/guide_pdf.js
const fs = require('fs');
const path = require('path');
const E = require('../config');
const { browser } = require('../ui/helpers');
const { guides } = require(path.join(E.RACINE, 'apps/web/lib/aide/guides.json'));
const IMG = path.join(E.RACINE, 'apps/web/public/aide');
const SORTIE = path.join(E.RACINE, 'docs/Guide_utilisateur_SI_DNPEC.pdf');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const image = (f) => {
  const p = path.join(IMG, f);
  return fs.existsSync(p) ? `<img src="data:image/png;base64,${fs.readFileSync(p).toString('base64')}" alt="">` : '';
};

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: "DejaVu Sans", Arial, sans-serif; color: #141a26; font-size: 10.5pt; line-height: 1.45; }
  .couverture { height: 250mm; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; }
  .couverture h1 { font-size: 26pt; margin: 0 0 6mm; } .couverture p { color: #555; margin: 1mm 0; }
  .bandeau { height: 3mm; background: linear-gradient(90deg, #ce1126 33%, #fcd116 33% 66%, #009460 66%); margin: 8mm 0; }
  h2 { font-size: 17pt; margin: 0 0 1mm; page-break-before: always; } .pour { color: #666; margin: 0 0 5mm; }
  h3 { font-size: 12pt; margin: 6mm 0 2mm; } ol { margin: 0 0 3mm 5mm; padding-left: 4mm; } li { margin-bottom: 1mm; }
  img { width: 100%; border: 0.3mm solid #d8dce4; border-radius: 1.5mm; margin: 1mm 0 3mm; page-break-inside: avoid; }
  .sommaire li { margin-bottom: 2mm; }
</style></head><body>
<section class="couverture">
  <p>République de Guinée — Ministère de l’Économie, des Finances et du Budget</p>
  <div class="bandeau"></div>
  <h1>SI DNPEC<br>Guide d’utilisation</h1>
  <p>Direction Nationale des Prévisions Économiques et de la Conjoncture</p>
  <div class="bandeau"></div>
  <p>Un guide par profil. Dans l’application, la page « Aide » ne montre à chacun que les siens.</p>
  <ol class="sommaire" style="text-align:left;display:inline-block;margin-top:10mm">${guides.map((g) => `<li>${esc(g.titre)} — <em>${esc(g.pour)}</em></li>`).join('')}</ol>
  <p style="margin-top:12mm">Édition du ${new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}</p>
</section>
${guides
  .map(
    (g) => `<h2>${esc(g.titre)}</h2><p class="pour">${esc(g.pour)}</p>${g.sections
      .map((s) => `<h3>${esc(s.titre)}</h3><ol>${s.etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>${s.capture ? image(s.capture) : ''}`)
      .join('')}`,
  )
  .join('')}
</body></html>`;

(async () => {
  const b = await browser();
  const p = await b.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.pdf({ path: SORTIE, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#888">SI DNPEC — Guide d’utilisation — page <span class="pageNumber"></span> / <span class="totalPages"></span></div>', margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' } });
  await b.close();
  console.log('PDF :', SORTIE, `(${Math.round(fs.statSync(SORTIE).size / 1024)} Ko)`);
})().catch((e) => { console.error(e); process.exit(1); });
