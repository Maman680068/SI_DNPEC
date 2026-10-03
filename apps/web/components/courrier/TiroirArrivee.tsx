'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ajouterPiecesArrivee, annulerArrivee, classerArrivee, getArrivee, telechargerPieceArrivee } from '../../lib/api/courrier';
import type { Arrivee, Imputation, Unite } from '../../lib/courrier/types';
import {
  ARRIVEE_STATUT_LABEL,
  ARRIVEE_STATUT_TONE,
  CONFIDENTIALITE_LABEL,
  CONFIDENTIALITE_TONE,
  NATURE_IMPUTATION_LABEL,
  formatDate,
  formatDateHeure,
  formatTaille,
  nomPersonne,
} from '../../lib/courrier/types';
import { useInterim } from '../../lib/interim/InterimProvider';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AccesDelegues, FenetreFichiers, FenetreMotif } from './Communes';
import {
  FenetreCompleterPli,
  FenetreConvertir,
  FenetreCorriger,
  FenetreImputer,
  FenetreRequalifier,
  FenetreTraiter,
} from './FenetresArrivee';
import { enRetard } from './Lignes';
import { Erreur, messageErreur } from './ui';
import { FenetreDetail } from '../ui/FenetreDetail';

type Fenetre =
  | { type: 'imputer' }
  | { type: 'sous-imputer'; imp: Imputation }
  | { type: 'traiter'; imp: Imputation }
  | { type: 'convertir'; imp: Imputation }
  | { type: 'corriger' | 'annuler' | 'scans' | 'completer' | 'requalifier' };

export function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">{label}</div>
      <div className="break-words text-[13.5px]">{children}</div>
    </div>
  );
}

/** Fenêtre de détail du courrier (arrivée, acte) : cadre commun FenetreDetail (refonte de l'interface). */
export function Tiroir({ onClose, titre, children }: { onClose: () => void; titre: string; children: React.ReactNode }) {
  return (
    <FenetreDetail titre={titre} onClose={onClose} sansEntete largeur={720}>
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <div className="text-xs text-text-faint">{titre}</div>
        <button onClick={onClose} aria-label="Fermer" className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-md bg-bg text-text-muted">
          ✕
        </button>
      </div>
      {children}
    </FenetreDetail>
  );
}

export function Pieces({ pieces, telecharger, personnes }: { pieces: Arrivee['pieces']; telecharger: (id: string, nom: string) => Promise<void>; personnes: Arrivee['personnes'] }) {
  const [erreur, setErreur] = useState<string | null>(null);
  if (pieces.length === 0) return <p className="text-[12.5px] text-text-faint">Aucun fichier.</p>;
  return (
    <>
      <Erreur message={erreur} />
      <ul className="space-y-1.5">
        {pieces.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-2 rounded-md bg-bg px-3 py-2 text-[12.5px]">
            <button
              type="button"
              className="min-w-0 break-all text-left font-semibold text-accent hover:underline"
              onClick={() => telecharger(p.id, p.fileName).catch((e) => setErreur(messageErreur(e, 'Téléchargement impossible')))}
            >
              {p.fileName}
            </button>
            <span className="text-text-faint">
              {formatTaille(p.sizeBytes)} · {nomPersonne(personnes, p.deposeParId)}, {formatDate(p.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Fiche d'un courrier arrivée, selon le niveau d'accès rendu par l'API :
 * EXISTENCE (pli personnel d'un autre) → carte seule ; METADONNEES → bandeau
 * « contenu protégé » ; CONTENU → tout. Chaque bouton vient de `droits`.
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
  const [a, setA] = useState<Arrivee | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);

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
    setErreur(null);
    try {
      await classerArrivee(a.id);
      apres();
    } catch (e) {
      setErreur(messageErreur(e, 'Classement impossible'));
    }
  }

  const unite = a ? unites.find((u) => u.key === a.uniteKey) : undefined;
  const d = a?.droits;

  return (
    <Tiroir onClose={onClose} titre={a ? `Courrier arrivée · ${a.registre.code}${a.registre.portee === 'UNITE' && unite ? ` · ${unite.code}` : ''}` : 'Courrier arrivée'}>
      {erreurChargement ? (
        <div role="alert" className="rounded-md bg-clay-soft px-3.5 py-3 text-[13px] text-clay">
          {erreurChargement}
        </div>
      ) : !a || !d ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : (
        <>
          <h2 className="mb-2 font-heading text-[20px] font-bold text-ink">{a.numero}</h2>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Badge tone={ARRIVEE_STATUT_TONE[a.statut]}>{ARRIVEE_STATUT_LABEL[a.statut].toUpperCase()}</Badge>
            <Badge tone={CONFIDENTIALITE_TONE[a.confidentialite]}>{CONFIDENTIALITE_LABEL[a.confidentialite].toUpperCase()}</Badge>
          </div>

          {a.statut === 'ANNULE' && a.motifAnnulation && (
            <div className="mb-4 rounded-md bg-clay-soft px-3.5 py-2.5 text-[12.5px] text-clay">Annulé : {a.motifAnnulation}</div>
          )}

          {a.niveau === 'EXISTENCE' ? (
            <div className="mb-5 rounded-lg border border-gold bg-gold-soft px-4 py-3.5 text-[13px] text-ink" data-testid="pli-personnel">
              <div className="mb-1 font-bold">Pli personnel</div>
              Pli fermé adressé à <strong>{nomPersonne(a.personnes, a.destinataireId)}</strong>, reçu le {formatDate(a.dateReception)} de {a.expediteur}. Son
              contenu n’est visible que de son destinataire.
            </div>
          ) : (
            <>
              {a.niveau === 'METADONNEES' && (
                <div className="mb-4 rounded-md border border-clay bg-clay-soft px-3.5 py-2.5 text-[12.5px] text-clay" data-testid="contenu-protege">
                  <strong>Contenu protégé.</strong> Courrier confidentiel : vous en voyez l’enregistrement, pas le contenu (scans, imputations).
                </div>
              )}
              {a.confidentialite === 'PERSONNEL' && a.destinataireId && (
                <div className="mb-4 rounded-md bg-gold-soft px-3.5 py-2.5 text-[12.5px] text-ink">
                  Pli personnel qui vous est adressé : vous seul(e) le voyez. Pour le faire imputer, requalifiez-le.
                </div>
              )}
              <div className="mb-5 space-y-3">
                <Info label="Objet">{a.objet ?? <span className="italic text-text-faint">Non renseigné</span>}</Info>
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Expéditeur">{a.expediteur}</Info>
                  <Info label="Reçu le">{formatDate(a.dateReception)}</Info>
                  <Info label="Référence">{a.referenceExpediteur ?? '—'}</Info>
                  <Info label="Daté du">{formatDate(a.dateCourrier)}</Info>
                </div>
                {a.motifDerogationDate && (
                  <div className="rounded-md bg-gold-soft px-3 py-2 text-[12.5px] text-ink" data-testid="derogation-date">
                    <strong>Date confirmée par dérogation :</strong> {a.motifDerogationDate}
                  </div>
                )}
              </div>
            </>
          )}

          <Erreur message={erreur} />
          <div className="mb-6 flex flex-wrap gap-2" data-testid="actions-arrivee">
            {d.imputer && (
              <Button variant="gold" onClick={() => setFenetre({ type: 'imputer' })}>
                Imputer
              </Button>
            )}
            {d.repondre && onRepondre && <Button onClick={() => onRepondre(a)}>Rédiger une réponse</Button>}
            {d.completer && <Button onClick={() => setFenetre({ type: 'completer' })}>Compléter le pli</Button>}
            {d.requalifier && <Button onClick={() => setFenetre({ type: 'requalifier' })}>Requalifier</Button>}
            {d.ajouterPiece && <Button onClick={() => setFenetre({ type: 'scans' })}>Ajouter un scan</Button>}
            {d.corriger && <Button onClick={() => setFenetre({ type: 'corriger' })}>Corriger</Button>}
            {d.classer && <Button onClick={classer}>Classer</Button>}
            {d.annuler && (
              <Button onClick={() => setFenetre({ type: 'annuler' })} className="!text-clay">
                Annuler l’enregistrement
              </Button>
            )}
          </div>

          {a.niveau === 'CONTENU' && (
            <>
              <section className="mb-6">
                <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-text-faint">Scans</h3>
                <Pieces pieces={a.pieces} personnes={a.personnes} telecharger={(pid, nom) => telechargerPieceArrivee(a.id, pid, nom)} />
              </section>

              {a.confidentialite !== 'PERSONNEL' && (
                <section className="mb-6" data-testid="imputations">
                  <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-text-faint">Imputations</h3>
                  {a.imputations.length === 0 ? (
                    <p className="text-[12.5px] text-text-faint">Pas encore imputé.</p>
                  ) : (
                    <ArbreImputations
                      a={a}
                      parentId={null}
                      onAction={(type, imp) => setFenetre({ type, imp })}
                      onOuvrirActe={onOuvrirActe}
                    />
                  )}
                </section>
              )}

              {d.deleguer && <AccesDelegues type="arrivee" id={a.id} />}
            </>
          )}

          {fenetre?.type === 'imputer' && <FenetreImputer arrivee={a} onClose={() => setFenetre(null)} onFait={apres} />}
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
              onClose={() => setFenetre(null)}
              onValider={async (fichiers) => {
                await ajouterPiecesArrivee(a.id, fichiers);
                apres();
              }}
            />
          )}
        </>
      )}
    </Tiroir>
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
            <div className="rounded-md border border-line px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-semibold">{nomPersonne(a.personnes, i.imputeAId)}</span>
                <Badge tone="accent">{NATURE_IMPUTATION_LABEL[i.nature].toUpperCase()}</Badge>
                {i.statut === 'TRAITEE' ? <Badge tone="sage">TRAITÉE</Badge> : retard ? <Badge tone="clay">EN RETARD</Badge> : <Badge tone="gold">EN COURS</Badge>}
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
                <button type="button" className="mt-1 text-[12px] font-semibold text-accent hover:underline" onClick={() => onOuvrirActe(i.reponseActeId!)}>
                  Voir la réponse
                </button>
              )}
              {i.tache && (
                <Link href={`/tasks/${i.tache.id}`} className="mt-1 block text-[12px] font-semibold text-accent hover:underline">
                  Tâche associée →
                </Link>
              )}
              {(i.droits.traiter || i.droits.sousImputer || i.droits.convertir) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {i.droits.traiter && (
                    <Button variant="gold" className="!px-3 !py-1.5 !text-[12.5px]" onClick={() => onAction('traiter', i)}>
                      Marquer traité
                    </Button>
                  )}
                  {i.droits.sousImputer && (
                    <Button className="!px-3 !py-1.5 !text-[12.5px]" onClick={() => onAction('sous-imputer', i)}>
                      Sous-imputer
                    </Button>
                  )}
                  {i.droits.convertir && (
                    <Button className="!px-3 !py-1.5 !text-[12.5px]" onClick={() => onAction('convertir', i)}>
                      Convertir en tâche
                    </Button>
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
