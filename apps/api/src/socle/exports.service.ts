import { Injectable, Logger } from '@nestjs/common';
import { StatutDiffusion } from '@prisma/client';
import PizZip from 'pizzip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/** Libellés du statut de diffusion (§7.1). */
export const LIBELLE_STATUT: Record<StatutDiffusion, string> = {
  BROUILLON: 'Brouillon',
  VALIDE: 'Validé',
  DIFFUSABLE: 'Diffusable',
};

/** Mention portée par tout fichier exporté d'un objet (§7.1 : jamais l'apparence d'un chiffre officiel). */
export const MENTION_STATUT: Record<StatutDiffusion, string> = {
  BROUILLON: 'BROUILLON — usage interne, non citable',
  VALIDE: 'VALIDÉ — usage interne à la DNPEC',
  DIFFUSABLE: 'DIFFUSABLE — autorisé hors de la Direction',
};

export interface FichierExporte {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const echapperXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Service d'export unique (socle N4, §7.1) : tout fichier qui sort d'un objet porteur d'un statut de
 * diffusion passe par `marquer`. PDF : bandeau en haut de chaque page ; Word : paragraphe inséré en
 * tête ; autres formats : statut dans le nom du fichier. Le contenu déposé n'est jamais modifié en
 * stockage : seule la copie remise est marquée.
 */
@Injectable()
export class ExportsService {
  private readonly logger = new Logger('Exports');

  async marquer(fichier: FichierExporte, statut: StatutDiffusion): Promise<FichierExporte> {
    const mention = MENTION_STATUT[statut];
    try {
      if (fichier.mimeType === 'application/pdf' || /\.pdf$/i.test(fichier.fileName)) {
        return { ...fichier, buffer: await this.bandeauPdf(fichier.buffer, mention, statut) };
      }
      if (fichier.mimeType === DOCX || /\.docx$/i.test(fichier.fileName)) {
        return { ...fichier, buffer: this.enTeteDocx(fichier.buffer, mention, statut) };
      }
    } catch (e) {
      // Fichier illisible (PDF chiffré, Word corrompu) : le statut passe alors par le nom du fichier.
      this.logger.warn(`Marquage impossible (${fichier.fileName}) : ${e instanceof Error ? e.message : e}`);
    }
    return { ...fichier, fileName: this.nomAvecStatut(fichier.fileName, statut) };
  }

  nomAvecStatut(fileName: string, statut: StatutDiffusion): string {
    const i = fileName.lastIndexOf('.');
    const suffixe = ` (${LIBELLE_STATUT[statut].toUpperCase()})`;
    return i > 0 ? `${fileName.slice(0, i)}${suffixe}${fileName.slice(i)}` : `${fileName}${suffixe}`;
  }

  /** Bandeau horizontal en haut de chaque page : rouge (brouillon), bleu (validé), vert (diffusable). */
  async bandeauPdf(buffer: Buffer, mention: string, statut?: StatutDiffusion): Promise<Buffer> {
    const pdf = await PDFDocument.load(buffer);
    const police = await pdf.embedFont(StandardFonts.HelveticaBold);
    const couleur = statut === 'DIFFUSABLE' ? rgb(0.1, 0.45, 0.2) : statut === 'VALIDE' ? rgb(0.1, 0.25, 0.55) : rgb(0.7, 0.1, 0.1);
    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      const taille = 9;
      const largeur = police.widthOfTextAtSize(mention, taille);
      page.drawRectangle({ x: 0, y: height - 18, width, height: 18, color: rgb(1, 1, 1), opacity: 0.85 });
      page.drawText(mention, { x: (width - largeur) / 2, y: height - 13, size: taille, font: police, color: couleur });
    }
    return Buffer.from(await pdf.save());
  }

  /** Paragraphe en gras, centré, en tête du corps du document Word. */
  enTeteDocx(buffer: Buffer, mention: string, statut?: StatutDiffusion): Buffer {
    const zip = new PizZip(buffer);
    const f = zip.file('word/document.xml');
    if (!f) throw new Error('document.xml absent');
    const xml = f.asText();
    const couleur = statut === 'DIFFUSABLE' ? '1A7333' : statut === 'VALIDE' ? '1A408C' : 'B31A1A';
    const para = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${couleur}"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${echapperXml(mention)}</w:t></w:r></w:p>`;
    const i = xml.search(/<w:body[^>]*>/);
    if (i < 0) throw new Error('corps du document introuvable');
    const fin = xml.indexOf('>', i) + 1;
    zip.file('word/document.xml', xml.slice(0, fin) + para + xml.slice(fin));
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
