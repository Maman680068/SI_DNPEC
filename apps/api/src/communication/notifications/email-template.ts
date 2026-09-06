/**
 * Mise en page commune à tous les emails du SI DNPEC : petit en-tête, message,
 * un bouton d'action, et un pied de page — en HTML (avec repli en texte brut
 * pour les clients mail qui ne l'affichent pas). Centralisée ici pour que
 * tous les emails (réinitialisation de mot de passe, notifications) restent
 * visuellement cohérents et lisibles sur mobile (une seule colonne, largeur
 * limitée, bouton assez grand pour être touché au doigt).
 */

const INK = '#1B2A6B';
const BACKGROUND = '#F4F5F7';
const TEXT = '#1A1A1A';
const FOOTER_TEXT = '#8A8F98';
const ORG_NAME = 'Direction Nationale des Prévisions Économiques et de la Conjoncture (DNPEC)';

export interface EmailContentOptions {
  /** Prénom pour la formule d'appel ("Bonjour {prénom},"). */
  recipientFirstName: string;
  /** Paragraphes affichés avant le bouton, dans l'ordre. */
  paragraphs: string[];
  /** Libellé du bouton, adapté au contexte (ex. "Voir la tâche"). Omis si pas de lien. */
  buttonLabel?: string;
  /** Lien absolu (https://...) vers la ressource concernée. */
  buttonUrl?: string;
  /** Paragraphes affichés après le bouton (ex. "si vous n'êtes pas à l'origine de cette demande…"). */
  afterButtonParagraphs?: string[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildEmailContent(options: EmailContentOptions): { html: string; text: string } {
  const { recipientFirstName, paragraphs, buttonLabel, buttonUrl, afterButtonParagraphs = [] } = options;
  const hasButton = !!(buttonLabel && buttonUrl);

  const textParagraphs = [`Bonjour ${recipientFirstName},`, ...paragraphs];
  if (hasButton) {
    textParagraphs.push(`${buttonLabel} : ${buttonUrl}`);
  }
  textParagraphs.push(...afterButtonParagraphs);
  textParagraphs.push(`— ${ORG_NAME}`);
  const text = textParagraphs.join('\n\n');

  const paragraphsHtml = (items: string[]) =>
    items.map((p) => `<p style="margin:0 0 16px 0;">${escapeHtml(p)}</p>`).join('\n');

  const bodyHtml = `<p style="margin:0 0 16px 0;">Bonjour ${escapeHtml(recipientFirstName)},</p>\n${paragraphsHtml(paragraphs)}`;

  const buttonHtml = hasButton
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px 0;">
        <tr>
          <td style="border-radius:6px;background-color:${INK};">
            <a href="${escapeHtml(buttonUrl as string)}"
               style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;
                      font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">
              ${escapeHtml(buttonLabel as string)}
            </a>
          </td>
        </tr>
      </table>
      ${paragraphsHtml(afterButtonParagraphs)}
      <p style="margin:16px 0 4px 0;font-size:12.5px;color:${FOOTER_TEXT};">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
      </p>
      <p style="margin:0 0 16px 0;font-size:12.5px;word-break:break-all;">
        <a href="${escapeHtml(buttonUrl as string)}" style="color:${INK};">${escapeHtml(buttonUrl as string)}</a>
      </p>`
    : paragraphsHtml(afterButtonParagraphs);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:${BACKGROUND};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background-color:${BACKGROUND};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <div style="max-width:480px;margin:0 auto;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:${INK};padding:18px 24px;">
                <span style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;">DNPEC</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;font-family:Arial,Helvetica,sans-serif;color:${TEXT};font-size:15px;line-height:1.6;word-break:break-word;overflow-wrap:anywhere;">
                ${bodyHtml}
                ${buttonHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px;background-color:${BACKGROUND};font-family:Arial,Helvetica,sans-serif;color:${FOOTER_TEXT};font-size:11.5px;">
                ${escapeHtml(ORG_NAME)}
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text };
}
