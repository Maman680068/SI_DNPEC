'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check, Lock, Paperclip, PenLine, Send, Undo2 } from 'lucide-react';
import { annulerActe, getActe, prendreConnaissance, renvoyerActe, soumettreActe, supprimerActe, telechargerPieceActe, ajouterPiecesActe } from '../../lib/api/courrier';
import type { Acte, Registre, Visa } from '../../lib/courrier/types';
import { ACTE_STATUT_LABEL, NIVEAU_VISA_LABEL, formatDate, nomPersonne } from '../../lib/courrier/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { TON_ACTE, dateHeureCourte } from '../../lib/courrier/affichage';
import { useInterim } from '../../lib/interim/InterimProvider';
import { CleValeur, Etapes, Pastille, SectionFenetre, type EtatEtape } from '../ui/Charte';
import { FenetreDetail } from '../ui/FenetreDetail';
import { AccesDelegues, FenetreFichiers, FenetreMotif } from './Communes';
import { FenetreExpedier, FenetreRediger, FenetreSigner, FenetreViser } from './FenetresActe';
import { ACTION, ACTION_DANGER, ACTION_PRINCIPALE, Historique, Pieces } from './TiroirArrivee';
import { messageErreur } from './ui';
import { messageErreur as messageAction, useToast } from '../ui/Toast';
import { SqueletteChamps } from './formulaire';

type FenetreActe = 'modifier' | 'viser' | 'renvoyer' | 'signer' | 'expedier' | 'annuler' | 'annexes';

type EtatLigne = 'fait' | 'courant' | 'saute' | 'renvoye' | 'avenir';
/** Ligne du circuit vertical : `cle` (redige, visa, signature, numero, expedition, connaissance, annule). */
type Ligne = { id: string; cle: string; titre: ReactNode; etat: EtatLigne; detail: ReactNode };

/** « Fatoumata Diallo (DRH) » : nom suivi de la fonction (ou du rôle). */
function nomFonction(p: Acte['personnes'], id: string | null): string {
  const x = id ? p[id] : undefined;
  if (!x) return nomPersonne(p, id);
  const fonction = x.jobTitle || ROLE_LABEL[x.role];
  return fonction ? `${x.firstName} ${x.lastName} (${fonction})` : `${x.firstName} ${x.lastName}`;
}

/** « au nom de Y » (intérim), en gras comme dans les fenêtres d'action. */
function auNomDe(p: Acte['personnes'], id: string | null): ReactNode {
  return id ? (
    <>
      {' '}
      <strong>au nom de</strong> {nomPersonne(p, id)}
    </>
  ) : null;
}

/** « 3 heures », « 1 jour », « 4 jours » depuis une date. */
function depuis(iso: string): string {
  const h = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3600e3));
  if (h < 1) return 'moins d’une heure';
  if (h < 24) return `${h} heure${h > 1 ? 's' : ''}`;
  const j = Math.floor(h / 24);
  return `${j} jour${j > 1 ? 's' : ''}`;
}

const niveauMinuscule = (v: Visa) => (NIVEAU_VISA_LABEL[v.niveau] ?? v.niveau).toLowerCase();

/** Lignes des visas d'un cycle (ordre du circuit). */
function lignesVisas(a: Acte, cycle: number): Ligne[] {
  const p = a.personnes;
  return a.visas
    .filter((v) => v.cycle === cycle)
    .sort((x, y) => x.ordre - y.ordre)
    .map((v): Ligne => {
      const commentaire = v.commentaire ? ` · « ${v.commentaire} »` : '';
      switch (v.statut) {
        case 'VISE':
          return {
            id: v.id,
            cle: 'visa',
            etat: 'fait',
            titre: (
              <>
                Visé par {nomPersonne(p, v.viseParId)}
                {auNomDe(p, v.viseAuNomDeId)}, {niveauMinuscule(v)}
              </>
            ),
            detail: `${dateHeureCourte(v.viseAt)}${commentaire}`,
          };
        case 'RENVOYE':
          return {
            id: v.id,
            cle: 'visa',
            etat: 'renvoye',
            titre: (
              <>
                Renvoyé au rédacteur par {nomPersonne(p, v.viseParId)}
                {auNomDe(p, v.viseAuNomDeId)}, {niveauMinuscule(v)}
              </>
            ),
            detail: `${dateHeureCourte(v.viseAt)}${commentaire}`,
          };
        case 'SAUTE':
          return { id: v.id, cle: 'visa', etat: 'saute', titre: <>Visa du {niveauMinuscule(v)} — sans objet</>, detail: v.motifSaut ?? 'étape sautée' };
        default: {
          // En attente : seule l'étape du visa courant (rendu par l'API) est en cours ; les suivantes sont à venir.
          const courant = v.id === a.visaCourant?.id && a.statut === 'EN_VISA';
          const precedent = a.visas.filter((x) => x.cycle === cycle && x.ordre < v.ordre && x.viseAt).sort((x, y) => y.ordre - x.ordre)[0];
          return {
            id: v.id,
            cle: 'visa',
            etat: courant ? 'courant' : 'avenir',
            titre: <>Visa du {niveauMinuscule(v)}</>,
            detail: courant ? `En attente de ${nomPersonne(p, v.viseurAttenduId)}${precedent?.viseAt ? ` depuis ${depuis(precedent.viseAt)}` : ''}` : `Ensuite : ${nomPersonne(p, v.viseurAttenduId)}`,
          };
        }
      }
    });
}

/**
 * Circuit complet du cycle en cours, de haut en bas (maquette « apres-acte-fenetre ») : rédaction,
 * visas, signature, attribution du numéro, expédition, prise de connaissance de l'agent concerné.
 */
function lignesCircuit(a: Acte): Ligne[] {
  const p = a.personnes;
  const annule = a.statut === 'ANNULE';
  const enRedaction = a.statut === 'BROUILLON' || a.statut === 'RENVOYE';
  const l: Ligne[] = [
    {
      id: 'redige',
      cle: 'redige',
      etat: enRedaction ? 'courant' : 'fait',
      titre: <>Rédigé par {nomFonction(p, a.redacteurId)}</>,
      detail: a.statut === 'RENVOYE' ? 'Correction demandée — à resoumettre' : a.statut === 'BROUILLON' ? `${dateHeureCourte(a.createdAt)} · brouillon, à soumettre au visa` : dateHeureCourte(a.createdAt),
    },
    ...(a.cycle > 0 ? lignesVisas(a, a.cycle) : []),
  ];
  const dernierVisa = a.visas.filter((v) => v.cycle === a.cycle && v.viseAt).sort((x, y) => y.viseAt!.localeCompare(x.viseAt!))[0];
  const qui = a.registre.portee === 'DIRECTION' ? 'du Directeur national ou de la DNA' : 'du chef de l’unité (ou du DN, de la DNA)';
  l.push(
    a.signeAt
      ? {
          id: 'signature',
          cle: 'signature',
          etat: 'fait',
          titre: (
            <>
              Signé par {nomPersonne(p, a.signataireId)}
              {auNomDe(p, a.signeAuNomDeId)}
            </>
          ),
          detail: dateHeureCourte(a.signeAt),
        }
      : {
          id: 'signature',
          cle: 'signature',
          etat: a.statut === 'A_SIGNER' ? 'courant' : 'avenir',
          titre: <>Signature {qui}</>,
          detail: a.statut === 'A_SIGNER' ? (dernierVisa?.viseAt ? `En attente depuis ${depuis(dernierVisa.viseAt)}` : 'En attente') : 'après les visas',
        },
  );
  l.push(
    a.numero
      ? { id: 'numero', cle: 'numero', etat: 'fait', titre: <>Numéro {a.numero} attribué</>, detail: `registre ${a.registre.code}, à la signature` }
      : { id: 'numero', cle: 'numero', etat: 'avenir', titre: 'Attribution du numéro', detail: 'automatique à la signature' },
  );
  l.push(
    a.expedieAt
      ? { id: 'expedition', cle: 'expedition', etat: 'fait', titre: <>Expédié par {nomPersonne(p, a.expedieParId)}</>, detail: `${dateHeureCourte(a.expedieAt)}${a.modeExpedition ? ` · ${a.modeExpedition}` : ''}` }
      : { id: 'expedition', cle: 'expedition', etat: a.statut === 'SIGNE' ? 'courant' : 'avenir', titre: 'Expédition', detail: a.statut === 'SIGNE' ? 'à faire par le secrétariat du registre' : 'par le secrétariat, après la signature' },
  );
  if (a.beneficiaireId && a.priseConnaissanceRequise)
    l.push({
      id: 'connaissance',
      cle: 'connaissance',
      etat: a.priseConnaissanceAt ? 'fait' : a.enAttentePriseConnaissance ? 'courant' : 'avenir',
      titre: <>Prise de connaissance par {nomPersonne(p, a.beneficiaireId)}</>,
      detail: a.priseConnaissanceAt ? dateHeureCourte(a.priseConnaissanceAt) : a.enAttentePriseConnaissance ? 'En attente de sa confirmation' : 'après la signature',
    });
  if (annule)
    l.push({
      id: 'annule',
      cle: 'annule',
      etat: 'renvoye',
      titre: <>Annulé par {nomPersonne(p, a.annuleParId)}</>,
      detail: `${dateHeureCourte(a.annuleAt)}${a.motifAnnulation ? ` · « ${a.motifAnnulation} »` : ''}`,
    });
  // Un acte annulé n'avance plus : ce qui restait à faire n'est plus « en cours ».
  return annule ? l.map((x) => (x.etat === 'courant' ? { ...x, etat: 'avenir' } : x)) : l;
}

const ROND: Record<EtatLigne, string> = {
  fait: 'border-sage bg-sage',
  courant: 'border-gold bg-surface shadow-[0_0_0_4px_theme(colors.gold.50)]',
  saute: 'border-[#CDD1DF] bg-[#ECEEF5]',
  renvoye: 'border-clay bg-clay',
  avenir: 'border-[#CDD1DF] bg-surface',
};
const ETAT_LU: Record<EtatLigne, string> = { fait: 'fait', courant: 'en cours', saute: 'sans objet', renvoye: 'renvoyé', avenir: 'à venir' };

/** Circuit de visa vertical (maquette : `.tl2`) : rond d'état, titre, détail (date, commentaire). */
function CircuitVertical({ lignes, label }: { lignes: Ligne[]; label: string }) {
  return (
    <ol aria-label={label} className="relative pl-[26px] before:absolute before:bottom-1.5 before:left-[9px] before:top-1.5 before:w-0.5 before:bg-[#E3E6EF]">
      {lignes.map((e) => (
        <li key={e.id} className="relative pb-3.5 last:pb-0" data-etape={e.etat} data-cle={e.cle} aria-current={e.etat === 'courant' ? 'step' : undefined}>
          <i aria-hidden className={`absolute -left-[26px] top-px h-5 w-5 rounded-full border-[3px] ${ROND[e.etat]}`} />
          <div className="min-w-0">
            <b className={`block break-words text-[13.5px] font-semibold ${e.etat === 'saute' ? 'text-text-muted' : 'text-text'}`}>
              {e.titre}
              <span className="sr-only"> ({ETAT_LU[e.etat]})</span>
            </b>
            <span className="block break-words text-[12.5px] text-text-muted">{e.detail}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Étapes de l'en-tête (maquette) : Rédigé → Visas → Signature → Numéro → Expédition. */
function etapesEntete(a: Acte): { label: string; etat: EtatEtape }[] {
  const s = a.statut;
  const enRedaction = s === 'BROUILLON' || s === 'RENVOYE';
  const visas = a.visas.filter((v) => v.cycle === a.cycle);
  const visasFaits = a.cycle > 0 && visas.every((v) => v.statut === 'VISE' || v.statut === 'SAUTE');
  return [
    { label: 'Rédigé', etat: enRedaction ? 'courant' : 'fait' },
    { label: 'Visas', etat: s === 'EN_VISA' ? 'courant' : a.signeAt || s === 'A_SIGNER' || (s === 'ANNULE' && visasFaits) ? 'fait' : 'avenir' },
    { label: 'Signature', etat: a.signeAt ? 'fait' : s === 'A_SIGNER' ? 'courant' : 'avenir' },
    { label: 'Numéro', etat: a.numero ? 'fait' : 'avenir' },
    { label: 'Expédition', etat: a.expedieAt ? 'fait' : s === 'SIGNE' ? 'courant' : 'avenir' },
  ];
}

/** Phrase d'explication sous les actions (selon l'action principale proposée par l'API). */
function explication(a: Acte): string {
  const d = a.droits;
  if (d.signer) return `La signature attribue le numéro suivant du registre ${a.registre.code} ; il ne pourra plus changer. Vous pouvez joindre l’acte signé scanné.`;
  if (d.viser) return 'Votre visa fait passer l’acte à l’étape suivante du circuit. « Renvoyer au rédacteur » le lui retourne avec votre motif.';
  if (d.expedier) return 'Indiquez le mode d’envoi : l’expédition est datée et tracée.';
  if (d.prendreConnaissance) return 'Confirmez avoir lu cet acte : votre confirmation est datée et tracée.';
  if (d.soumettre) return 'L’acte part au circuit de visa ; le numéro sera attribué à la signature.';
  if (d.modifier) return 'Brouillon : vous pouvez encore le modifier.';
  return 'Aucune action ne vous est demandée sur cet acte.';
}

function evenementsActe(a: Acte) {
  const p = a.personnes;
  const ev: { date: string | null; texte: ReactNode }[] = [{ date: a.createdAt, texte: <>rédigé par {nomPersonne(p, a.redacteurId)}</> }];
  for (const v of a.visas) {
    if (v.statut === 'VISE' || v.statut === 'RENVOYE')
      ev.push({
        date: v.viseAt,
        texte: (
          <>
            {v.statut === 'VISE' ? 'visé' : 'renvoyé'} par {nomPersonne(p, v.viseParId)}
            {v.viseAuNomDeId ? ` (au nom de ${nomPersonne(p, v.viseAuNomDeId)})` : ''}
          </>
        ),
      });
  }
  if (a.signeAt)
    ev.push({
      date: a.signeAt,
      texte: (
        <>
          signé par {nomPersonne(p, a.signataireId)}
          {a.signeAuNomDeId ? ` (au nom de ${nomPersonne(p, a.signeAuNomDeId)})` : ''}
          {a.numero ? ` — n° ${a.numero}` : ''}
        </>
      ),
    });
  if (a.priseConnaissanceAt) ev.push({ date: a.priseConnaissanceAt, texte: <>pris connaissance par {nomPersonne(p, a.beneficiaireId)}</> });
  if (a.expedieAt) ev.push({ date: a.expedieAt, texte: <>expédié par {nomPersonne(p, a.expedieParId)}{a.modeExpedition ? ` (${a.modeExpedition})` : ''}</> });
  for (const f of a.pieces) ev.push({ date: f.createdAt, texte: <>fichier « {f.fileName} » ajouté par {nomPersonne(p, f.deposeParId)}</> });
  if (a.annuleAt) ev.push({ date: a.annuleAt, texte: <>annulé par {nomPersonne(p, a.annuleParId)}</> });
  return ev;
}

/**
 * Fenêtre d'un départ ou d'un acte (?acte=<id>), maquette « apres-acte-fenetre » (étape 8) : fil
 * « Départ et acte · Registre … », titre « objet — bénéficiaire », étapes Rédigé → Visas →
 * Signature → Numéro → Expédition ; à gauche bandeaux, circuit de visa vertical (rédaction, visas
 * datés et commentés, signature, numéro, expédition, prise de connaissance ; soumissions
 * précédentes repliées), texte, pièces et accès délégués ; à droite les actions tirées de `droits`
 * uniquement (Signer l'acte, Viser, Expédier…, puis Renvoyer au rédacteur…), une phrase
 * d'explication, les informations (Objet, Bénéficiaire, Niveau, Registre…) et l'historique.
 */
export function TiroirActe({
  id,
  registres,
  onClose,
  onChange,
  onOuvrirArrivee,
}: {
  id: string;
  registres: Registre[];
  onClose: () => void;
  onChange: () => void;
  onOuvrirArrivee?: (id: string) => void;
}) {
  const { interim } = useInterim();
  const toast = useToast();
  const [a, setA] = useState<Acte | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<FenetreActe | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    getActe(id)
      .then((x) => {
        setA(x);
        setErreurChargement(null);
      })
      .catch((e) => setErreurChargement(messageErreur(e, 'Acte introuvable')));
  }, [id]);
  useEffect(() => charger(), [charger]);

  const apres = () => {
    setFenetre(null);
    charger();
    onChange();
  };

  /** Action directe après confirmation (mention d'intérim comprise). */
  async function directe(question: string, action: () => Promise<unknown>, defaut: string, succes: { titre: string; detail?: string }, ferme = false) {
    const auNom = interim ? `\n\nSera enregistré par vous, au nom de ${interim.titulaireName} (par intérim).` : '';
    if (!window.confirm(question + auNom)) return;
    setEnCours(true);
    try {
      await action();
      toast.succes(succes.titre, { detail: succes.detail });
      if (ferme) {
        onChange();
        onClose();
      } else apres();
    } catch (e) {
      toast.erreur(defaut, messageAction(e));
    } finally {
      setEnCours(false);
    }
  }

  const d = a?.droits;
  const cyclesPasses = a ? [...new Set(a.visas.map((v) => v.cycle))].filter((c) => c < a.cycle).sort((x, y) => y - x) : [];
  const ligne = (cle: ReactNode, valeur: ReactNode): [ReactNode, ReactNode][] => [[cle, valeur]];

  const cote =
    a && d ? (
      <>
        <div className="mb-4 flex flex-col gap-2" data-testid="actions-acte">
          {d.signer && (
            <button type="button" className={ACTION_PRINCIPALE} onClick={() => setFenetre('signer')}>
              <Check aria-hidden size={17} />
              Signer l’acte
            </button>
          )}
          {d.viser && (
            <button type="button" className={ACTION_PRINCIPALE} onClick={() => setFenetre('viser')}>
              <Check aria-hidden size={17} />
              Viser
            </button>
          )}
          {d.expedier && (
            <button type="button" className={ACTION_PRINCIPALE} onClick={() => setFenetre('expedier')}>
              <Send aria-hidden size={16} />
              Expédier
            </button>
          )}
          {d.prendreConnaissance && (
            <button
              type="button"
              className={ACTION_PRINCIPALE}
              disabled={enCours}
              onClick={() => directe('Confirmer que vous avez pris connaissance de cet acte ?', () => prendreConnaissance(a.id), 'Confirmation impossible', { titre: 'Prise de connaissance confirmée', detail: 'Votre confirmation est datée et tracée.' })}
            >
              J’ai pris connaissance
            </button>
          )}
          {d.soumettre && (
            <button
              type="button"
              className={ACTION_PRINCIPALE}
              disabled={enCours}
              onClick={() =>
                directe(
                  a.circuitObsolete ? 'Resoumettre l’acte ? Le circuit de visa sera recalculé.' : 'Soumettre l’acte au circuit de visa ?',
                  () => soumettreActe(a.id),
                  'Soumission impossible',
                  { titre: 'Acte soumis', detail: 'Le prochain intervenant du circuit est prévenu.' },
                )
              }
            >
              {a.circuitObsolete || a.statut === 'RENVOYE' ? 'Resoumettre' : 'Soumettre au visa'}
            </button>
          )}
          {d.renvoyer && (
            <button type="button" className={ACTION} onClick={() => setFenetre('renvoyer')}>
              <Undo2 aria-hidden size={16} />
              Renvoyer au rédacteur
            </button>
          )}
          {d.modifier && (
            <button type="button" className={ACTION} onClick={() => setFenetre('modifier')}>
              <PenLine aria-hidden size={16} />
              Modifier
            </button>
          )}
          {d.ajouterPiece && (
            <button type="button" className={ACTION} onClick={() => setFenetre('annexes')}>
              <Paperclip aria-hidden size={16} />
              Ajouter une annexe
            </button>
          )}
          <p className="text-[12px] leading-[1.45] text-text-muted" data-testid="explication-acte">
            {explication(a)}
          </p>
          {d.supprimer && (
            <button type="button" className={ACTION_DANGER} disabled={enCours} onClick={() => directe('Supprimer ce brouillon ? Il n’a jamais été soumis.', () => supprimerActe(a.id), 'Suppression impossible', { titre: 'Brouillon supprimé' }, true)}>
              Supprimer
            </button>
          )}
          {d.annuler && (
            <button type="button" className={ACTION_DANGER} onClick={() => setFenetre('annuler')}>
              Annuler l’acte
            </button>
          )}
        </div>
        <div className="mb-4 h-px bg-line" />
        <div className="mb-4">
          <CleValeur
            largeur={100}
            lignes={[
              ...ligne('Objet', <span className="break-words">{a.objet}</span>),
              ...(a.beneficiaireId
                ? ligne(
                    'Bénéficiaire',
                    <span>
                      {nomPersonne(a.personnes, a.beneficiaireId)}
                      {a.priseConnaissanceAt && <span className="block text-[12px] font-normal text-sage">A pris connaissance le {formatDate(a.priseConnaissanceAt)}</span>}
                    </span>,
                  )
                : []),
              ...ligne(
                'Niveau',
                <span className={`inline-flex items-center gap-1 ${a.confidentialite === 'CONFIDENTIEL' ? 'text-clay' : ''}`}>
                  {a.confidentialite === 'CONFIDENTIEL' && <Lock aria-hidden size={13} />}
                  {a.confidentialite === 'CONFIDENTIEL' ? 'Confidentiel' : 'Ordinaire'}
                </span>,
              ),
              ...ligne('Registre', `${a.registre.libelle} (${a.registre.code})`),
              ...(a.destinataires ? ligne('Destinataires', <span className="break-words">{a.destinataires}</span>) : []),
              ...(a.repondAId
                ? ligne(
                    'En réponse à',
                    onOuvrirArrivee ? (
                      <button type="button" className="text-left font-semibold text-ink underline" onClick={() => onOuvrirArrivee(a.repondAId!)}>
                        Voir le courrier arrivée
                      </button>
                    ) : (
                      'un courrier arrivée'
                    ),
                  )
                : []),
            ]}
          />
        </div>
        <div className="mb-4 h-px bg-line" />
        <Historique evenements={evenementsActe(a)} />
      </>
    ) : undefined;

  const titre = a ? `${a.objet}${a.beneficiaireId ? ` — ${nomPersonne(a.personnes, a.beneficiaireId)}` : ''}` : 'Départ ou acte';

  return (
    <FenetreDetail
      titre={titre}
      filAriane={[a ? `Départ et acte · Registre ${a.registre.libelle} · ${a.numero ? `N° ${a.numero}` : 'Non numéroté'}` : 'Départ et acte']}
      entete={
        a && (
          <div className="flex flex-wrap items-center gap-x-4">
            <Etapes etapes={etapesEntete(a)} label="Étapes du circuit" />
            <span className="mt-3.5">
              <Pastille ton={TON_ACTE[a.statut]} testid="statut-acte">
                {ACTE_STATUT_LABEL[a.statut]}
              </Pastille>
            </span>
          </div>
        )
      }
      cote={cote}
      onClose={onClose}
      testid="fenetre-acte"
    >
      {erreurChargement ? (
        <div role="alert" className="rounded-md bg-clay-soft px-3.5 py-3 text-[13px] text-clay">
          {erreurChargement}
        </div>
      ) : !a || !d ? (
        <SqueletteChamps champs={4} />
      ) : (
        <>
          {a.statut === 'RENVOYE' && a.motifRenvoi && (
            <div className="mb-4 rounded-md border border-[#E7B3BB] bg-clay-50 px-3.5 py-2.5 text-[12.5px] text-clay" data-testid="bandeau-renvoi">
              <strong>Renvoyé au rédacteur :</strong> {a.motifRenvoi}
            </div>
          )}
          {a.circuitObsolete && (
            <div className="mb-4 rounded-md border border-[#F2D58A] bg-gold-50 px-3.5 py-2.5 text-[12.5px] text-ink" data-testid="bandeau-obsolete">
              <strong>Circuit à recalculer.</strong> Le viseur attendu n’occupe plus ce poste : l’acte doit être resoumis.
            </div>
          )}
          {a.enAttentePriseConnaissance && (
            <div className="mb-4 rounded-md border border-line bg-ink-50 px-3.5 py-2.5 text-[12.5px] text-ink" data-testid="bandeau-connaissance">
              En attente de la prise de connaissance de <strong>{nomPersonne(a.personnes, a.beneficiaireId)}</strong>.
            </div>
          )}

          <section className="mb-[18px]" data-testid="circuit">
            <h3 className="mb-2.5 text-[13px] font-bold text-ink-900">Circuit de visa{a.cycle > 1 ? ` (soumission n° ${a.cycle})` : ''}</h3>
            <CircuitVertical lignes={lignesCircuit(a)} label="Circuit de visa" />
            {cyclesPasses.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[12.5px] font-semibold text-text-muted">Soumissions précédentes ({cyclesPasses.length})</summary>
                <div className="mt-2.5 space-y-4" data-testid="cycles-precedents">
                  {cyclesPasses.map((c) => (
                    <div key={c}>
                      <div className="mb-1.5 text-[12px] font-semibold text-text-muted">Soumission n° {c}</div>
                      <CircuitVertical lignes={lignesVisas(a, c)} label={`Soumission n° ${c}`} />
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>

          {a.corps && (
            <SectionFenetre titre="Texte">
              <div className="max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-[10px] border border-line bg-[#F7F8FB] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[#3A4152]">{a.corps}</div>
            </SectionFenetre>
          )}

          <SectionFenetre titre="Pièces" n={a.pieces.length}>
            <Pieces pieces={a.pieces} personnes={a.personnes} telecharger={(pid, nom) => telechargerPieceActe(a.id, pid, nom)} />
          </SectionFenetre>

          {d.deleguer && <AccesDelegues type="acte" id={a.id} />}

          {fenetre === 'modifier' && <FenetreRediger registres={registres} acte={a} onClose={() => setFenetre(null)} onEnregistre={apres} />}
          {fenetre === 'viser' && <FenetreViser acte={a} onClose={() => setFenetre(null)} onFait={apres} />}
          {fenetre === 'signer' && <FenetreSigner acte={a} onClose={() => setFenetre(null)} onFait={apres} />}
          {fenetre === 'expedier' && <FenetreExpedier acte={a} onClose={() => setFenetre(null)} onFait={apres} />}
          {fenetre === 'renvoyer' && (
            <FenetreMotif
              titre="Renvoyer au rédacteur"
              explication="L’acte revient au rédacteur avec votre motif ; il le corrigera puis le resoumettra."
              valider="Renvoyer"
              succes={{ titre: 'Acte renvoyé au rédacteur', detail: 'Il est prévenu avec votre motif.' }}
              onClose={() => setFenetre(null)}
              onValider={async (motif) => {
                await renvoyerActe(a.id, motif);
                apres();
              }}
            />
          )}
          {fenetre === 'annuler' && (
            <FenetreMotif
              titre="Annuler l’acte"
              explication={a.numero ? `Le numéro ${a.numero} reste consommé et apparaît « annulé » dans le registre.` : 'L’acte sort du circuit ; il reste tracé.'}
              valider="Annuler l’acte"
              succes={{ titre: 'Acte annulé', detail: a.numero ? `Le numéro ${a.numero} reste consommé.` : 'Il reste tracé.' }}
              onClose={() => setFenetre(null)}
              onValider={async (motif) => {
                await annulerActe(a.id, motif);
                apres();
              }}
            />
          )}
          {fenetre === 'annexes' && (
            <FenetreFichiers
              titre="Ajouter une annexe"
              explication={`« ${a.objet} »`}
              succes="Annexe ajoutée"
              onClose={() => setFenetre(null)}
              onValider={async (fichiers) => {
                await ajouterPiecesActe(a.id, fichiers);
                apres();
              }}
            />
          )}
        </>
      )}
    </FenetreDetail>
  );
}
