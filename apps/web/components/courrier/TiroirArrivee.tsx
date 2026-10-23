'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, FileText, Lock, Plus } from 'lucide-react';
import { ajouterPiecesArrivee, annulerArrivee, classerArrivee, getArrivee, telechargerPieceArrivee } from '../../lib/api/courrier';
import type { Arrivee, Imputation, Unite } from '../../lib/courrier/types';
import { CONFIDENTIALITE_LABEL, NATURE_IMPUTATION_LABEL, formatDate, formatDateHeure, formatTaille, nomPersonne } from '../../lib/courrier/types';
import { dateCourte, dateHeureCourte, enRetard, pastilleArrivee } from '../../lib/courrier/affichage';
import { useInterim } from '../../lib/interim/InterimProvider';
import { BTN_LIGNE, BTN_LIGNE_PRINCIPAL, BTN_PRINCIPAL, BTN_SECONDAIRE, CleValeur, Etapes, IconeFichier, Pastille, SectionFenetre, type EtatEtape } from '../ui/Charte';
import { FenetreDetail } from '../ui/FenetreDetail';
import { AccesDelegues, FenetreFichiers, FenetreMotif } from './Communes';
import {
  FenetreCompleterPli,
  FenetreConvertir,
  FenetreCorriger,
  FenetreImputer,
  FenetreRequalifier,
  FenetreTraiter,
  FormulaireImputer,
  ID_FORMULAIRE_IMPUTER,
} from './FenetresArrivee';
import { messageErreur } from './ui';
import { messageErreur as messageAction, useToast } from '../ui/Toast';
import { SqueletteChamps } from './formulaire';

type Fenetre =
  | { type: 'sous-imputer'; imp: Imputation }
  | { type: 'traiter'; imp: Imputation }
  | { type: 'convertir'; imp: Imputation }
  | { type: 'corriger' | 'annuler' | 'scans' | 'completer' | 'requalifier' };

/** Boutons de la colonne de droite (pleine largeur). */
export const ACTION_PRINCIPALE = `${BTN_PRINCIPAL} !h-[42px] w-full`;
export const ACTION = `${BTN_SECONDAIRE} !h-10 w-full`;
export const ACTION_DANGER = 'mx-auto mt-1 block text-[13px] font-semibold text-clay hover:underline disabled:opacity-50';

/** Liste des fichiers (scans, annexes, acte signé) : vignette, nom à télécharger, taille, dépôt. */
export function Pieces({ pieces, telecharger, personnes }: { pieces: Arrivee['pieces']; telecharger: (id: string, nom: string) => Promise<void>; personnes: Arrivee['personnes'] }) {
  const toast = useToast();
  if (pieces.length === 0) return <p className="text-[12.5px] text-text-faint">Aucun fichier.</p>;
  return (
    <>
      <ul className="flex flex-col gap-2">
        {pieces.map((p) => (
          <li key={p.id} className="flex min-w-0 items-center gap-[9px] rounded-[9px] border border-line bg-surface px-2.5 py-2 text-[13px]">
            <IconeFichier nom={p.fileName} />
            <span className="min-w-0">
              <button
                type="button"
                className="block max-w-full break-all text-left font-semibold text-ink hover:underline"
                onClick={() => telecharger(p.id, p.fileName).catch((e) => toast.erreur('Téléchargement impossible', messageAction(e)))}
              >
                {p.fileName}
              </button>
              <small className="block text-[11.5px] text-text-muted">
                {formatTaille(p.sizeBytes)} · {nomPersonne(personnes, p.deposeParId)}, {formatDate(p.createdAt)}
              </small>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Historique daté (colonne de droite). */
export function Historique({ evenements }: { evenements: { date: string | null; texte: ReactNode }[] }) {
  const tries = evenements.filter((e) => e.date).sort((x, y) => x.date!.localeCompare(y.date!));
  const sansDate = evenements.filter((e) => !e.date);
  return (
    <section aria-label="Historique" data-testid="historique">
      <h3 className="mb-2 text-[13px] font-bold text-ink-900">Historique</h3>
      <ol className="space-y-1.5 text-[12.5px] leading-[1.6] text-text-muted">
        {[...tries, ...sansDate].map((e, i) => (
          <li key={i}>
            {e.date ? `${dateHeureCourte(e.date)} — ` : ''}
            {e.texte}
          </li>
        ))}
      </ol>
    </section>
  );
}

function etapesArrivee(a: Arrivee): { label: string; etat: EtatEtape }[] {
  const enregistre = { label: `Enregistré le ${dateCourte(a.dateReception)}`, etat: 'fait' as EtatEtape };
  if (a.statut === 'ANNULE') return [enregistre, { label: 'Annulé', etat: 'courant' }];
  if (a.confidentialite === 'PERSONNEL') return [enregistre, { label: 'Classé', etat: a.statut === 'CLASSE' ? 'fait' : 'avenir' }];
  const rang = { ENREGISTRE: 1, IMPUTE: 2, TRAITE: 3, CLASSE: 4 }[a.statut];
  const etat = (i: number): EtatEtape => (i < rang ? 'fait' : i === rang ? 'courant' : 'avenir');
  return [enregistre, { label: 'Imputation', etat: etat(1) }, { label: 'Traitement', etat: etat(2) }, { label: 'Classé', etat: a.statut === 'CLASSE' ? 'fait' : etat(3) }];
}

function evenementsArrivee(a: Arrivee) {
  const p = a.personnes;
  const ev: { date: string | null; texte: ReactNode }[] = [{ date: a.createdAt, texte: 'enregistré au registre' }];
  for (const i of a.imputations) {
    ev.push({
      date: i.createdAt,
      texte: (
        <>
          {i.parentId ? 'sous-imputé' : 'imputé'} à {nomPersonne(p, i.imputeAId)} par {nomPersonne(p, i.imputeParId)}
          {i.auNomDeId ? ` (P.I. de ${nomPersonne(p, i.auNomDeId)})` : ''}
        </>
      ),
    });
    if (i.traiteeAt) ev.push({ date: i.traiteeAt, texte: <>traité par {nomPersonne(p, i.traiteeParId ?? i.imputeAId)}</> });
  }
  for (const f of a.pieces) ev.push({ date: f.createdAt, texte: <>scan « {f.fileName} » ajouté par {nomPersonne(p, f.deposeParId)}</> });
  if (a.statut === 'CLASSE') ev.push({ date: null, texte: 'classé' });
  if (a.statut === 'ANNULE') ev.push({ date: null, texte: `enregistrement annulé${a.motifAnnulation ? ` : ${a.motifAnnulation}` : ''}` });
  return ev;
}

/**
 * Fenêtre d'un courrier arrivé (maquette validée) : fil « Courrier arrivé · Registre … », titre
 * « numéro — objet », étapes ; à gauche le scan, les informations, le formulaire d'imputation (si
 * la personne peut imputer) puis les imputations ; à droite les actions permises et l'historique.
 * Selon le niveau d'accès rendu par l'API : EXISTENCE (pli personnel d'un autre) → carte seule ;
 * METADONNEES → bandeau « contenu protégé » ; CONTENU → tout. Chaque bouton vient de `droits`.
 */
export function TiroirArrivee({
  id,
  unites,
  onClose,
  onChange,
  onRepondre,
  onOuvrirActe,
}: {
  id: string;
  unites: Unite[];
  onClose: () => void;
  onChange: () => void;
  onRepondre?: (a: Arrivee) => void;
  onOuvrirActe?: (id: string) => void;
}) {
  const { interim } = useInterim();
  const toast = useToast();
  const [a, setA] = useState<Arrivee | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);
  const [imputationEnCours, setImputationEnCours] = useState(false);

  const charger = useCallback(() => {
    getArrivee(id)
      .then((x) => {
        setA(x);
        setErreurChargement(null);
      })
      .catch((e) => setErreurChargement(messageErreur(e, 'Courrier introuvable')));
  }, [id]);
  useEffect(() => charger(), [charger]);

  const apres = () => {
    setFenetre(null);
    charger();
    onChange();
  };

  async function classer() {
    if (!a) return;
    const auNom = interim ? `\n\nSera enregistré par vous, au nom de ${interim.titulaireName} (par intérim).` : '';
    if (!window.confirm(`Classer le courrier ${a.numero} ? Il sortira des courriers en cours.${auNom}`)) return;
    try {
      await classerArrivee(a.id);
      toast.succes(`Courrier ${a.numero} classé`, { detail: 'Il sort des courriers en cours.' });
      apres();
    } catch (e) {
      toast.erreur('Classement impossible', messageAction(e));
    }
  }

  const unite = a ? unites.find((u) => u.key === a.uniteKey) : undefined;
  const d = a?.droits;
  const registre = a ? `Registre ${a.registre.libelle}${a.registre.portee === 'UNITE' && unite ? ` · ${unite.code}` : ''}` : null;
  const objet = a ? (a.niveau === 'EXISTENCE' ? 'Pli personnel' : a.objet ?? (a.confidentialite === 'PERSONNEL' ? 'Pli personnel' : 'Objet non renseigné')) : '';
  const contenu = a?.niveau === 'CONTENU';
  const sousImputable = a && contenu ? (a.imputations.find((i) => i.droits.sousImputer) ?? null) : null;
  const formulaire = !!(a && d && contenu && d.imputer);
  const statut = a ? pastilleArrivee(a) : null;

  const cote =
    a && d ? (
      <>
        <div className="mb-[18px] flex flex-col gap-2" data-testid="actions-arrivee">
          {formulaire && (
            <button type="submit" form={ID_FORMULAIRE_IMPUTER} className={ACTION_PRINCIPALE} disabled={imputationEnCours}>
              <Check aria-hidden size={16} />
              {imputationEnCours ? 'Imputation…' : 'Imputer'}
            </button>
          )}
          {d.repondre && onRepondre && (
            <button type="button" className={ACTION} onClick={() => onRepondre(a)}>
              Rédiger une réponse
            </button>
          )}
          {d.completer && (
            <button type="button" className={ACTION} onClick={() => setFenetre({ type: 'completer' })}>
              Compléter le pli
            </button>
          )}
          {d.requalifier && (
            <button type="button" className={ACTION} onClick={() => setFenetre({ type: 'requalifier' })}>
              Requalifier
            </button>
          )}
          {d.ajouterPiece && (
            <button type="button" className={ACTION} onClick={() => setFenetre({ type: 'scans' })}>
              <Plus aria-hidden size={16} />
              Ajouter un scan
            </button>
          )}
          {d.corriger && (
            <button type="button" className={ACTION} onClick={() => setFenetre({ type: 'corriger' })}>
              Corriger l’enregistrement
            </button>
          )}
          {d.classer && (
            <button type="button" className={ACTION} onClick={classer}>
              Classer
            </button>
          )}
          {d.annuler && (
            <button type="button" className={ACTION_DANGER} onClick={() => setFenetre({ type: 'annuler' })}>
              Annuler l’enregistrement
            </button>
          )}
        </div>
        <div className="mb-4 h-px bg-line" />
        <Historique evenements={evenementsArrivee(a)} />
      </>
    ) : undefined;

  return (
    <FenetreDetail
      titre={a ? `${a.numero} — ${objet}` : 'Courrier arrivé'}
      filAriane={['Courrier arrivé', registre]}
      entete={
        a && (
          <div className="flex flex-wrap items-center gap-x-4">
            <Etapes etapes={etapesArrivee(a)} label="Étapes du courrier" />
            {statut && (
              <span className="mt-3.5">
                <Pastille ton={statut.ton} testid="statut-arrivee">
                  {statut.label}
                </Pastille>
              </span>
            )}
          </div>
        )
      }
      cote={cote}
      onClose={onClose}
      testid="fenetre-arrivee"
    >
      {erreurChargement ? (
        <div role="alert" className="rounded-md bg-clay-soft px-3.5 py-3 text-[13px] text-clay">
          {erreurChargement}
        </div>
      ) : !a || !d ? (
        <SqueletteChamps champs={4} />
      ) : (
        <>
          {a.statut === 'ANNULE' && a.motifAnnulation && <div className="mb-4 rounded-md bg-clay-soft px-3.5 py-2.5 text-[12.5px] text-clay">Annulé : {a.motifAnnulation}</div>}

          {a.niveau === 'EXISTENCE' ? (
            <div className="mb-5 rounded-lg border border-gold bg-gold-soft px-4 py-3.5 text-[13px] text-ink" data-testid="pli-personnel">
              <div className="mb-1 font-bold">Pli personnel</div>
              Pli fermé adressé à <strong>{nomPersonne(a.personnes, a.destinataireId)}</strong>, reçu le {formatDate(a.dateReception)} de {a.expediteur}. Son contenu
              n’est visible que de son destinataire.
            </div>
          ) : (
            <>
              {a.niveau === 'METADONNEES' && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-clay-bord bg-clay-50 px-3.5 py-2.5 text-[12.5px] text-clay" data-testid="contenu-protege">
                  <Lock aria-hidden size={14} className="mt-0.5 flex-none" />
                  <span>
                    <strong>Contenu protégé.</strong> Courrier confidentiel : vous en voyez l’enregistrement, pas le contenu (scans, imputations).
                  </span>
                </div>
              )}
              {a.confidentialite === 'PERSONNEL' && a.destinataireId && (
                <div className="mb-4 rounded-md bg-gold-soft px-3.5 py-2.5 text-[12.5px] text-ink">
                  Pli personnel qui vous est adressé : vous seul(e) le voyez. Pour le faire imputer, requalifiez-le.
                </div>
              )}
              <div className="mb-[18px] grid gap-[18px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div data-testid="scans">
                  {contenu && a.pieces.length > 0 ? (
                    <Pieces pieces={a.pieces} personnes={a.personnes} telecharger={(pid, nom) => telechargerPieceArrivee(a.id, pid, nom)} />
                  ) : (
                    <div className="flex min-h-[120px] items-center justify-center gap-2.5 rounded-[10px] border border-line bg-fond-doux px-3 text-center text-[13px] font-semibold text-text-muted sm:h-[150px]">
                      <FileText aria-hidden size={18} />
                      {!contenu ? (
                        'Scan non visible'
                      ) : d.ajouterPiece ? (
                        <button type="button" className="font-semibold text-text-muted hover:text-ink hover:underline" onClick={() => setFenetre({ type: 'scans' })}>
                          Aucun scan · Ajouter le scan
                        </button>
                      ) : (
                        'Aucun scan'
                      )}
                    </div>
                  )}
                </div>
                <CleValeur
                  largeur={100}
                  lignes={[
                    ['Expéditeur', a.expediteur],
                    ['Référence', a.referenceExpediteur ?? '—'],
                    ['Daté du', formatDate(a.dateCourrier)],
                    ['Reçu le', formatDate(a.dateReception)],
                    [
                      'Niveau',
                      <span key="n" data-testid="niveau" className={`inline-flex items-center gap-1 ${a.confidentialite === 'CONFIDENTIEL' ? 'text-clay' : ''}`}>
                        {a.confidentialite !== 'ORDINAIRE' && <Lock aria-hidden size={13} />}
                        {CONFIDENTIALITE_LABEL[a.confidentialite]}
                      </span>,
                    ],
                  ]}
                />
              </div>
              {a.motifDerogationDate && (
                <div className="mb-4 rounded-md bg-gold-soft px-3 py-2 text-[12.5px] text-ink" data-testid="derogation-date">
                  <strong>Date confirmée par dérogation :</strong> {a.motifDerogationDate}
                </div>
              )}
            </>
          )}

          {formulaire && (
            <FormulaireImputer
              key={a.imputations.length}
              arrivee={a}
              sousImputable={sousImputable}
              onEnCours={setImputationEnCours}
              onFait={() => {
                setImputationEnCours(false);
                apres();
              }}
            />
          )}

          {contenu && a.confidentialite !== 'PERSONNEL' && (a.imputations.length > 0 || !formulaire) && (
            <SectionFenetre titre="Imputations" n={a.imputations.length}>
              <div data-testid="imputations">
                {a.imputations.length === 0 ? (
                  <p className="text-[12.5px] text-text-faint">Pas encore imputé.</p>
                ) : (
                  <ArbreImputations a={a} parentId={null} onAction={(type, imp) => setFenetre({ type, imp })} onOuvrirActe={onOuvrirActe} />
                )}
              </div>
            </SectionFenetre>
          )}

          {contenu && d.deleguer && <AccesDelegues type="arrivee" id={a.id} />}

          {fenetre?.type === 'sous-imputer' && <FenetreImputer arrivee={a} parent={fenetre.imp} onClose={() => setFenetre(null)} onFait={apres} />}
          {fenetre?.type === 'traiter' && <FenetreTraiter arrivee={a} imputation={fenetre.imp} onClose={() => setFenetre(null)} onFait={apres} />}
          {fenetre?.type === 'convertir' && <FenetreConvertir arrivee={a} imputation={fenetre.imp} onClose={() => setFenetre(null)} onFait={apres} />}
          {fenetre?.type === 'corriger' && <FenetreCorriger arrivee={a} onClose={() => setFenetre(null)} onFait={apres} />}
          {fenetre?.type === 'completer' && <FenetreCompleterPli arrivee={a} onClose={() => setFenetre(null)} onFait={apres} />}
          {fenetre?.type === 'requalifier' && <FenetreRequalifier arrivee={a} onClose={() => setFenetre(null)} onFait={apres} />}
          {fenetre?.type === 'annuler' && (
            <FenetreMotif
              titre="Annuler l’enregistrement"
              explication={`Le numéro ${a.numero} reste consommé (jamais réattribué) ; le courrier apparaît « annulé » dans le registre.`}
              valider="Annuler l’enregistrement"
              succes={{ titre: 'Enregistrement annulé', detail: `Le numéro ${a.numero} reste consommé.` }}
              onClose={() => setFenetre(null)}
              onValider={async (motif) => {
                await annulerArrivee(a.id, motif);
                apres();
              }}
            />
          )}
          {fenetre?.type === 'scans' && (
            <FenetreFichiers
              titre="Ajouter un scan"
              explication={`Courrier ${a.numero}`}
              succes="Scan ajouté"
              onClose={() => setFenetre(null)}
              onValider={async (fichiers) => {
                await ajouterPiecesArrivee(a.id, fichiers);
                apres();
              }}
            />
          )}
        </>
      )}
    </FenetreDetail>
  );
}

function ArbreImputations({
  a,
  parentId,
  onAction,
  onOuvrirActe,
}: {
  a: Arrivee;
  parentId: string | null;
  onAction: (type: 'sous-imputer' | 'traiter' | 'convertir', imp: Imputation) => void;
  onOuvrirActe?: (id: string) => void;
}) {
  const enfants = a.imputations.filter((i) => i.parentId === parentId);
  if (enfants.length === 0) return null;
  return (
    <ul className={parentId ? 'ml-3 mt-2 space-y-2 border-l-2 border-line pl-3' : 'space-y-2.5'}>
      {enfants.map((i) => {
        const retard = enRetard(i);
        return (
          <li key={i.id} data-testid="imputation">
            <div className="rounded-[10px] border border-line px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-semibold">{nomPersonne(a.personnes, i.imputeAId)}</span>
                <span className="text-[12px] text-text-muted">{NATURE_IMPUTATION_LABEL[i.nature]}</span>
                <span className="ml-auto">
                  {i.statut === 'TRAITEE' ? <Pastille ton="vert">Traitée</Pastille> : retard ? <Pastille ton="rouge">En retard</Pastille> : <Pastille ton="ambre">En cours</Pastille>}
                </span>
              </div>
              <div className="mt-1 text-[12px] text-text-muted">
                Par {nomPersonne(a.personnes, i.imputeParId)}
                {i.auNomDeId && (
                  <>
                    {' '}
                    <span className="font-semibold">P.I.</span> de {nomPersonne(a.personnes, i.auNomDeId)}
                  </>
                )}
                , le {formatDate(i.createdAt)}
                {i.echeance && <span className={retard ? 'font-semibold text-clay' : ''}> · échéance {formatDate(i.echeance)}</span>}
              </div>
              {i.instructions && <p className="mt-1.5 whitespace-pre-wrap text-[12.5px]">{i.instructions}</p>}
              {i.statut === 'TRAITEE' && (
                <p className="mt-1.5 text-[12px] text-sage">
                  Traitée le {formatDateHeure(i.traiteeAt)}
                  {i.traiteeParId && i.traiteeParId !== i.imputeAId ? ` par ${nomPersonne(a.personnes, i.traiteeParId)} (P.I.)` : ''}
                  {i.compteRendu && <span className="block whitespace-pre-wrap text-text">« {i.compteRendu} »</span>}
                </p>
              )}
              {i.reponseActeId && onOuvrirActe && (
                <button type="button" className="mt-1 text-[12px] font-semibold text-ink hover:underline" onClick={() => onOuvrirActe(i.reponseActeId!)}>
                  Voir la réponse
                </button>
              )}
              {i.tache && (
                <Link href={`/tasks/${i.tache.id}`} className="mt-1 block text-[12px] font-semibold text-ink hover:underline">
                  Tâche associée →
                </Link>
              )}
              {(i.droits.traiter || i.droits.sousImputer || i.droits.convertir) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {i.droits.traiter && (
                    <button type="button" className={BTN_LIGNE_PRINCIPAL} onClick={() => onAction('traiter', i)}>
                      Marquer traité
                    </button>
                  )}
                  {i.droits.sousImputer && (
                    <button type="button" className={BTN_LIGNE} onClick={() => onAction('sous-imputer', i)}>
                      Sous-imputer
                    </button>
                  )}
                  {i.droits.convertir && (
                    <button type="button" className={BTN_LIGNE} onClick={() => onAction('convertir', i)}>
                      Convertir en tâche
                    </button>
                  )}
                </div>
              )}
            </div>
            <ArbreImputations a={a} parentId={i.id} onAction={onAction} onOuvrirActe={onOuvrirActe} />
          </li>
        );
      })}
    </ul>
  );
}
