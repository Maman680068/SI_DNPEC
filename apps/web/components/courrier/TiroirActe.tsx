'use client';

import { useCallback, useEffect, useState } from 'react';
import { annulerActe, getActe, prendreConnaissance, renvoyerActe, soumettreActe, supprimerActe, telechargerPieceActe, ajouterPiecesActe } from '../../lib/api/courrier';
import type { Acte, Registre, Visa } from '../../lib/courrier/types';
import { ACTE_STATUT_LABEL, ACTE_STATUT_TONE, NIVEAU_VISA_LABEL, formatDate, formatDateHeure, nomPersonne } from '../../lib/courrier/types';
import { useInterim } from '../../lib/interim/InterimProvider';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AccesDelegues, FenetreFichiers, FenetreMotif } from './Communes';
import { FenetreExpedier, FenetreRediger, FenetreSigner, FenetreViser } from './FenetresActe';
import { Info, Pieces, Tiroir } from './TiroirArrivee';
import { Erreur, messageErreur } from './ui';

type FenetreActe = 'modifier' | 'viser' | 'renvoyer' | 'signer' | 'expedier' | 'annuler' | 'annexes';

type Etape = { cle: string; titre: string; etat: 'fait' | 'courant' | 'saute' | 'renvoye' | 'avenir'; detail: React.ReactNode };

function libelleVisa(v: Visa, p: Acte['personnes']): React.ReactNode {
  const par = (id: string | null, auNomDe: string | null) => (
    <>
      {nomPersonne(p, id)}
      {auNomDe && (
        <>
          {' '}
          <strong>au nom de</strong> {nomPersonne(p, auNomDe)}
        </>
      )}
    </>
  );
  switch (v.statut) {
    case 'VISE':
      return (
        <>
          Visé par {par(v.viseParId, v.viseAuNomDeId)}, le {formatDateHeure(v.viseAt)}
          {v.commentaire && <span className="block italic">« {v.commentaire} »</span>}
        </>
      );
    case 'RENVOYE':
      return (
        <>
          Renvoyé par {par(v.viseParId, v.viseAuNomDeId)}, le {formatDateHeure(v.viseAt)}
          {v.commentaire && <span className="block italic">« {v.commentaire} »</span>}
        </>
      );
    case 'SAUTE':
      return <>Sans objet — {v.motifSaut ?? 'étape sautée'}</>;
    default:
      return <>En attente de {nomPersonne(p, v.viseurAttenduId)}</>;
  }
}

function etapesDuCycle(a: Acte, cycle: number): Etape[] {
  const visas = a.visas.filter((v) => v.cycle === cycle).sort((x, y) => x.ordre - y.ordre);
  const etapes: Etape[] = visas.map((v) => ({
    cle: v.id,
    titre: NIVEAU_VISA_LABEL[v.niveau] ?? v.niveau,
    // En attente : seule l'étape du visa courant (rendu par l'API) est en cours ;
    // les suivantes sont à venir.
    etat:
      v.statut === 'VISE' ? 'fait' : v.statut === 'SAUTE' ? 'saute' : v.statut === 'RENVOYE' ? 'renvoye' : v.id === a.visaCourant?.id ? 'courant' : 'avenir',
    detail: v.statut === 'EN_ATTENTE' && v.id !== a.visaCourant?.id ? <>Ensuite : {nomPersonne(a.personnes, v.viseurAttenduId)}</> : libelleVisa(v, a.personnes),
  }));
  if (cycle === a.cycle) {
    const signe = a.signeAt !== null;
    etapes.push({
      cle: 'signature',
      titre: 'Signature',
      etat: signe ? 'fait' : a.statut === 'A_SIGNER' ? 'courant' : 'avenir',
      detail: signe ? (
        <>
          Signé par {nomPersonne(a.personnes, a.signataireId)}
          {a.signeAuNomDeId && (
            <>
              {' '}
              <strong>au nom de</strong> {nomPersonne(a.personnes, a.signeAuNomDeId)}
            </>
          )}
          , le {formatDateHeure(a.signeAt)}
        </>
      ) : a.statut === 'A_SIGNER' ? (
        <>En attente de signature ({a.registre.portee === 'DIRECTION' ? 'DN ou DNA' : 'chef de l’unité, ou DN/DNA'})</>
      ) : (
        <>Après les visas</>
      ),
    });
  }
  return etapes;
}

const PASTILLE: Record<Etape['etat'], string> = {
  fait: 'border-sage bg-sage text-white',
  courant: 'border-gold bg-gold text-ink',
  saute: 'border-line bg-bg text-text-faint',
  renvoye: 'border-clay bg-clay text-white',
  avenir: 'border-line bg-surface text-text-faint',
};
const SYMBOLE: Record<Etape['etat'], string> = { fait: '✓', courant: '•', saute: '–', renvoye: '↩', avenir: '' };

function Circuit({ etapes }: { etapes: Etape[] }) {
  return (
    <ol className="space-y-0">
      {etapes.map((e, i) => (
        <li key={e.cle} className="relative flex gap-3 pb-4 last:pb-0" data-etape={e.etat}>
          {i < etapes.length - 1 && <span className="absolute left-[11px] top-6 h-[calc(100%-18px)] w-0.5 bg-line" />}
          <span className={`z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-bold ${PASTILLE[e.etat]}`}>{SYMBOLE[e.etat]}</span>
          <div className="min-w-0 pt-0.5">
            <div className={`text-[13px] font-semibold ${e.etat === 'saute' ? 'text-text-faint' : ''}`}>{e.titre}</div>
            <div className="break-words text-[12px] text-text-muted">{e.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Fiche d'un départ ou d'un acte (?acte=<id>) : circuit de visa en étapes
 * (cycles précédents repliés), bandeaux (renvoi, circuit obsolète, prise de
 * connaissance attendue) et actions tirées de `droits` uniquement.
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
  const [a, setA] = useState<Acte | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
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
  async function directe(question: string, action: () => Promise<unknown>, defaut: string, ferme = false) {
    const auNom = interim ? `\n\nSera enregistré par vous, au nom de ${interim.titulaireName} (par intérim).` : '';
    if (!window.confirm(question + auNom)) return;
    setEnCours(true);
    setErreur(null);
    try {
      await action();
      if (ferme) {
        onChange();
        onClose();
      } else apres();
    } catch (e) {
      setErreur(messageErreur(e, defaut));
    } finally {
      setEnCours(false);
    }
  }

  const d = a?.droits;
  const cyclesPasses = a ? [...new Set(a.visas.map((v) => v.cycle))].filter((c) => c < a.cycle).sort((x, y) => y - x) : [];

  return (
    <Tiroir onClose={onClose} titre={a ? `${a.registre.nature === 'ACTE' ? 'Acte' : 'Départ'} · ${a.registre.code}` : 'Départ ou acte'}>
      {erreurChargement ? (
        <div role="alert" className="rounded-md bg-clay-soft px-3.5 py-3 text-[13px] text-clay">
          {erreurChargement}
        </div>
      ) : !a || !d ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : (
        <>
          <h2 className={`mb-2 font-heading text-[20px] font-bold ${a.numero ? 'text-ink' : 'italic text-text-muted'}`}>{a.numero ?? 'Non numéroté'}</h2>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Badge tone={ACTE_STATUT_TONE[a.statut]}>{ACTE_STATUT_LABEL[a.statut].toUpperCase()}</Badge>
            <Badge tone={a.confidentialite === 'CONFIDENTIEL' ? 'clay' : 'muted'}>{a.confidentialite === 'CONFIDENTIEL' ? 'CONFIDENTIEL' : 'ORDINAIRE'}</Badge>
          </div>

          {a.statut === 'RENVOYE' && a.motifRenvoi && (
            <div className="mb-4 rounded-md border border-clay bg-clay-soft px-3.5 py-2.5 text-[12.5px] text-clay" data-testid="bandeau-renvoi">
              <strong>Renvoyé pour correction :</strong> {a.motifRenvoi}
            </div>
          )}
          {a.circuitObsolete && (
            <div className="mb-4 rounded-md border border-gold bg-gold-soft px-3.5 py-2.5 text-[12.5px] text-ink" data-testid="bandeau-obsolete">
              <strong>Circuit à recalculer.</strong> Le viseur attendu n’occupe plus ce poste : l’acte doit être resoumis.
            </div>
          )}
          {a.enAttentePriseConnaissance && (
            <div className="mb-4 rounded-md border border-accent bg-accent-soft px-3.5 py-2.5 text-[12.5px] text-ink" data-testid="bandeau-connaissance">
              En attente de la prise de connaissance de <strong>{nomPersonne(a.personnes, a.beneficiaireId)}</strong>.
            </div>
          )}
          {a.statut === 'ANNULE' && a.motifAnnulation && (
            <div className="mb-4 rounded-md bg-clay-soft px-3.5 py-2.5 text-[12.5px] text-clay">Annulé : {a.motifAnnulation}</div>
          )}

          <div className="mb-5 space-y-3">
            <Info label="Objet">{a.objet}</Info>
            <div className="grid grid-cols-2 gap-3">
              <Info label="Rédigé par">{nomPersonne(a.personnes, a.redacteurId)}</Info>
              <Info label="Destinataires">{a.destinataires ?? '—'}</Info>
              {a.beneficiaireId && (
                <Info label="Agent concerné">
                  {nomPersonne(a.personnes, a.beneficiaireId)}
                  {a.priseConnaissanceAt && <span className="block text-[12px] text-sage">A pris connaissance le {formatDate(a.priseConnaissanceAt)}</span>}
                </Info>
              )}
              {a.expedieAt && (
                <Info label="Expédié">
                  {formatDate(a.expedieAt)} — {a.modeExpedition}
                </Info>
              )}
            </div>
            {a.repondAId && (
              <Info label="En réponse à">
                {onOuvrirArrivee ? (
                  <button type="button" className="font-semibold text-accent hover:underline" onClick={() => onOuvrirArrivee(a.repondAId!)}>
                    Voir le courrier arrivée
                  </button>
                ) : (
                  'un courrier arrivée'
                )}
              </Info>
            )}
            {a.corps && (
              <Info label="Texte">
                <div className="max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-md bg-bg px-3 py-2 text-[13px]">{a.corps}</div>
              </Info>
            )}
          </div>

          <Erreur message={erreur} />
          <div className="mb-6 flex flex-wrap gap-2" data-testid="actions-acte">
            {d.viser && (
              <Button variant="gold" onClick={() => setFenetre('viser')}>
                Viser
              </Button>
            )}
            {d.signer && (
              <Button variant="gold" onClick={() => setFenetre('signer')}>
                Signer
              </Button>
            )}
            {d.renvoyer && <Button onClick={() => setFenetre('renvoyer')}>Renvoyer pour correction</Button>}
            {d.soumettre && (
              <Button
                variant="gold"
                disabled={enCours}
                onClick={() =>
                  directe(
                    a.circuitObsolete ? 'Resoumettre l’acte ? Le circuit de visa sera recalculé.' : 'Soumettre l’acte au circuit de visa ?',
                    () => soumettreActe(a.id),
                    'Soumission impossible',
                  )
                }
              >
                {a.circuitObsolete ? 'Resoumettre' : a.statut === 'RENVOYE' ? 'Resoumettre' : 'Soumettre au visa'}
              </Button>
            )}
            {d.modifier && <Button onClick={() => setFenetre('modifier')}>Modifier</Button>}
            {d.ajouterPiece && <Button onClick={() => setFenetre('annexes')}>Ajouter une annexe</Button>}
            {d.expedier && (
              <Button variant="gold" onClick={() => setFenetre('expedier')}>
                Expédier
              </Button>
            )}
            {d.prendreConnaissance && (
              <Button variant="gold" disabled={enCours} onClick={() => directe('Confirmer que vous avez pris connaissance de cet acte ?', () => prendreConnaissance(a.id), 'Confirmation impossible')}>
                J’ai pris connaissance
              </Button>
            )}
            {d.supprimer && (
              <Button disabled={enCours} className="!text-clay" onClick={() => directe('Supprimer ce brouillon ? Il n’a jamais été soumis.', () => supprimerActe(a.id), 'Suppression impossible', true)}>
                Supprimer
              </Button>
            )}
            {d.annuler && (
              <Button className="!text-clay" onClick={() => setFenetre('annuler')}>
                Annuler l’acte
              </Button>
            )}
          </div>

          {a.cycle > 0 && (
            <section className="mb-6" data-testid="circuit">
              <h3 className="mb-2.5 text-[13px] font-bold uppercase tracking-wide text-text-faint">Circuit de visa{a.cycle > 1 ? ` (soumission n° ${a.cycle})` : ''}</h3>
              <Circuit etapes={etapesDuCycle(a, a.cycle)} />
              {cyclesPasses.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[12.5px] font-semibold text-text-muted">Soumissions précédentes ({cyclesPasses.length})</summary>
                  <div className="mt-2.5 space-y-4">
                    {cyclesPasses.map((c) => (
                      <div key={c}>
                        <div className="mb-1.5 text-[12px] font-semibold text-text-faint">Soumission n° {c}</div>
                        <Circuit etapes={etapesDuCycle(a, c)} />
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

          <section className="mb-6">
            <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-text-faint">Pièces</h3>
            <Pieces pieces={a.pieces} personnes={a.personnes} telecharger={(pid, nom) => telechargerPieceActe(a.id, pid, nom)} />
          </section>

          {d.deleguer && <AccesDelegues type="acte" id={a.id} />}

          {fenetre === 'modifier' && <FenetreRediger registres={registres} acte={a} onClose={() => setFenetre(null)} onEnregistre={apres} />}
          {fenetre === 'viser' && <FenetreViser acte={a} onClose={() => setFenetre(null)} onFait={apres} />}
          {fenetre === 'signer' && <FenetreSigner acte={a} onClose={() => setFenetre(null)} onFait={apres} />}
          {fenetre === 'expedier' && <FenetreExpedier acte={a} onClose={() => setFenetre(null)} onFait={apres} />}
          {fenetre === 'renvoyer' && (
            <FenetreMotif
              titre="Renvoyer pour correction"
              explication="L’acte revient au rédacteur avec votre motif ; il le corrigera puis le resoumettra."
              valider="Renvoyer"
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
              onClose={() => setFenetre(null)}
              onValider={async (fichiers) => {
                await ajouterPiecesActe(a.id, fichiers);
                apres();
              }}
            />
          )}
        </>
      )}
    </Tiroir>
  );
}
