import PDFKit from 'pdfkit';
import PizZip from 'pizzip';

/**
 * Modèle de page commun des documents générés (SIG-RF-DOC-02/03/04) : un seul contenu, rendu à
 * l'identique en PDF (aperçu fidèle = ce PDF) et en Word. En-tête de la République et de la
 * Direction, titre, numéro, mention (projet, duplicata, statut), corps, lieu et date, signature.
 */
export type Bloc =
  | { type: 'paragraphe'; texte: string }
  | { type: 'intertitre'; texte: string }
  | { type: 'champs'; lignes: [string, string][] }
  | { type: 'tableau'; entetes: string[]; lignes: string[][]; largeurs?: number[] };

export interface PageDocument {
  titre: string;
  numero?: string | null;
  /** Mention en rouge sous le titre : « PROJET — non signé », « DUPLICATA », statut de diffusion. */
  mentions?: string[];
  corps: Bloc[];
  lieuDate: string;
  signature?: { qualite: string; nom?: string | null };
}

export const EN_TETE = [
  'RÉPUBLIQUE DE GUINÉE',
  'Travail — Justice — Solidarité',
  'Ministère de l’Économie, des Finances et du Budget',
  'Direction Nationale des Prévisions Économiques et de la Conjoncture (DNPEC)',
];

export const MIME_PDF = 'application/pdf';
export const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ------------------------------------------------------------------ PDF

export function renduPdf(doc: PageDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFKit({ size: 'A4', margin: 56, info: { Title: doc.titre, Producer: 'NIMBA — DNPEC' } });
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    const largeur = pdf.page.width - 112;

    pdf.font('Helvetica-Bold').fontSize(10).text(EN_TETE[0]!, { align: 'center' });
    pdf.font('Helvetica-Oblique').fontSize(9).text(EN_TETE[1]!, { align: 'center' });
    pdf.moveDown(0.6).font('Helvetica').fontSize(9.5).text(EN_TETE[2]!, { align: 'center' });
    pdf.font('Helvetica-Bold').text(EN_TETE[3]!, { align: 'center' });
    const y = pdf.y + 6;
    pdf.moveTo(56 + largeur * 0.35, y).lineTo(56 + largeur * 0.65, y).lineWidth(0.8).stroke();

    pdf.moveDown(2).font('Helvetica-Bold').fontSize(15).text(doc.titre.toUpperCase(), { align: 'center' });
    pdf.moveDown(0.3).font('Helvetica').fontSize(10.5).text(doc.numero ? `N° ${doc.numero}` : 'N° —', { align: 'center' });
    for (const m of doc.mentions ?? []) pdf.moveDown(0.3).fillColor('#b22222').font('Helvetica-Bold').fontSize(11).text(m, { align: 'center' }).fillColor('black');
    pdf.moveDown(1.5);

    for (const b of doc.corps) {
      if (b.type === 'paragraphe') pdf.font('Helvetica').fontSize(11).text(b.texte, { align: 'justify', lineGap: 2 }).moveDown(0.8);
      else if (b.type === 'intertitre') pdf.moveDown(0.3).font('Helvetica-Bold').fontSize(11.5).text(b.texte).moveDown(0.4);
      else if (b.type === 'champs') {
        for (const [libelle, valeur] of b.lignes) {
          pdf.font('Helvetica-Bold').fontSize(10.5).text(`${libelle} : `, { continued: true }).font('Helvetica').text(valeur || '—');
        }
        pdf.moveDown(0.8);
      } else tableauPdf(pdf, b, largeur);
    }

    pdf.moveDown(1).font('Helvetica').fontSize(11).text(doc.lieuDate, { align: 'right' });
    if (doc.signature) {
      pdf.moveDown(1).font('Helvetica-Bold').text(doc.signature.qualite, { align: 'right' });
      pdf.moveDown(2.5).font('Helvetica').text(doc.signature.nom ?? '', { align: 'right' });
    }
    pdf.end();
  });
}

function tableauPdf(pdf: PDFKit.PDFDocument, b: Extract<Bloc, { type: 'tableau' }>, largeur: number) {
  const n = b.entetes.length;
  const parts = b.largeurs ?? b.entetes.map(() => 1);
  const total = parts.reduce((s, x) => s + x, 0);
  const cols = parts.map((p) => (p / total) * largeur);
  const ligne = (cells: string[], gras: boolean) => {
    pdf.font(gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    const hauteur = Math.max(...cells.map((c, i) => pdf.heightOfString(c || '—', { width: cols[i]! - 6 }))) + 6;
    if (pdf.y + hauteur > pdf.page.height - 70) pdf.addPage();
    const y = pdf.y;
    let x = 56;
    for (let i = 0; i < n; i++) {
      pdf.rect(x, y, cols[i]!, hauteur).lineWidth(0.4).stroke();
      pdf.text(cells[i] || '—', x + 3, y + 3, { width: cols[i]! - 6 });
      x += cols[i]!;
    }
    pdf.x = 56;
    pdf.y = y + hauteur;
  };
  ligne(b.entetes, true);
  for (const l of b.lignes) ligne(l, false);
  pdf.moveDown(1);
}

// ------------------------------------------------------------------ Word (.docx)

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const run = (t: string, o: { gras?: boolean; italique?: boolean; taille?: number; couleur?: string } = {}) =>
  `<w:r><w:rPr>${o.gras ? '<w:b/>' : ''}${o.italique ? '<w:i/>' : ''}${o.couleur ? `<w:color w:val="${o.couleur}"/>` : ''}<w:sz w:val="${(o.taille ?? 11) * 2}"/></w:rPr><w:t xml:space="preserve">${xml(t)}</w:t></w:r>`;
const para = (runs: string, jc: 'center' | 'right' | 'both' | 'left' = 'left', apres = 120) =>
  `<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:after="${apres}"/></w:pPr>${runs}</w:p>`;

export function renduDocx(doc: PageDocument): Buffer {
  const corps: string[] = [];
  corps.push(para(run(EN_TETE[0]!, { gras: true, taille: 10 }), 'center', 0));
  corps.push(para(run(EN_TETE[1]!, { italique: true, taille: 9 }), 'center', 160));
  corps.push(para(run(EN_TETE[2]!, { taille: 9.5 }), 'center', 0));
  corps.push(para(run(EN_TETE[3]!, { gras: true, taille: 9.5 }), 'center', 480));
  corps.push(para(run(doc.titre.toUpperCase(), { gras: true, taille: 15 }), 'center', 60));
  corps.push(para(run(doc.numero ? `N° ${doc.numero}` : 'N° —', { taille: 10.5 }), 'center', 120));
  for (const m of doc.mentions ?? []) corps.push(para(run(m, { gras: true, couleur: 'B22222' }), 'center', 60));
  corps.push(para('', 'left', 240));
  for (const b of doc.corps) {
    if (b.type === 'paragraphe') corps.push(para(run(b.texte), 'both', 200));
    else if (b.type === 'intertitre') corps.push(para(run(b.texte, { gras: true, taille: 11.5 }), 'left', 100));
    else if (b.type === 'champs') {
      for (const [l, v] of b.lignes) corps.push(para(run(`${l} : `, { gras: true }) + run(v || '—'), 'left', 40));
      corps.push(para('', 'left', 120));
    } else {
      const parts = b.largeurs ?? b.entetes.map(() => 1);
      const total = parts.reduce((s, x) => s + x, 0);
      const grille = parts.map((p) => `<w:gridCol w:w="${Math.round((p / total) * 9000)}"/>`).join('');
      const cellule = (t: string, gras: boolean, i: number) =>
        `<w:tc><w:tcPr><w:tcW w:w="${Math.round((parts[i]! / total) * 9000)}" w:type="dxa"/></w:tcPr>${para(run(t || '—', { gras, taille: 9 }), 'left', 0)}</w:tc>`;
      const ligne = (cells: string[], gras: boolean) => `<w:tr>${cells.map((c, i) => cellule(c, gras, i)).join('')}</w:tr>`;
      const bord = '<w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/>';
      corps.push(`<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>${bord}</w:tblBorders></w:tblPr><w:tblGrid>${grille}</w:tblGrid>${ligne(b.entetes, true)}${b.lignes.map((l) => ligne(l, false)).join('')}</w:tbl>`);
      corps.push(para('', 'left', 200));
    }
  }
  corps.push(para(run(doc.lieuDate), 'right', 240));
  if (doc.signature) {
    corps.push(para(run(doc.signature.qualite, { gras: true }), 'right', 720));
    corps.push(para(run(doc.signature.nom ?? ''), 'right', 0));
  }
  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    corps.join('') +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
    '</w:body></w:document>';
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', document);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export const dateFr = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
