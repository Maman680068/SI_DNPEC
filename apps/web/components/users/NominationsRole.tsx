'use client';

import { useCallback, useEffect, useState } from 'react';
import { confirmerChangementRole, getChangementsRole, refuserChangementRole } from '../../lib/api/users';
import type { ChangementRoleNomination, ListeChangementsRole } from '../../lib/users/types';
import type { SystemRole } from '../../lib/auth/types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { FenetreFormulaire, Grille2, Liste, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

const date = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '');
const STATUT: Record<ChangementRoleNomination['statut'], { libelle: string; ton: 'gold' | 'sage' | 'clay' }> = {
  EN_ATTENTE: { libelle: 'En attente', ton: 'gold' },
  APPLIQUE: { libelle: 'Droits appliqués', ton: 'sage' },
  REFUSE: { libelle: 'Refusé', ton: 'clay' },
};

/**
 * Nominations (option A) : l'acte de nomination signé à un poste de responsabilité arrive ici en
 * changement de rôle pré-rempli ; l'administrateur le confirme (l'actuel titulaire change aussi de
 * rôle) ou le refuse avec un motif. Écarts entre fonction du dossier et rôle du compte en dessous.
 */
export function NominationsRole() {
  const [l, setL] = useState<ListeChangementsRole | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState<ChangementRoleNomination | null>(null);
  const [refuser, setRefuser] = useState<ChangementRoleNomination | null>(null);
  const toast = useToast();
  const charger = useCallback(() => {
    getChangementsRole().then(setL).catch((x) => setErreur(messageChargement(x)));
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);
  if (!l) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  const enAttente = l.changements.filter((c) => c.statut === 'EN_ATTENTE');
  const traites = l.changements.filter((c) => c.statut !== 'EN_ATTENTE');
  const fait = (titre: string, detail: string) => () => {
    setConfirmer(null);
    setRefuser(null);
    charger();
    toast.succes(titre, { detail });
  };

  return (
    <div>
      <ErreurChargement message={erreur} />
      <p className="mb-4 max-w-3xl text-[12.5px] text-text-muted">
        Un acte de nomination signé à un poste de responsabilité met à jour la fonction du dossier ; le rôle et l’unité du compte ne changent qu’après votre confirmation, le jour même.
        Motif enregistré : le numéro de l’acte.
      </p>

      <h2 className="mb-2 text-[15px] font-bold">Nominations à appliquer</h2>
      {enAttente.length === 0 ? (
        <p className="mb-6 rounded-xl border border-line bg-surface p-5 text-[13px] text-text-muted">Aucune nomination en attente.</p>
      ) : (
        <ul className="mb-6 divide-y divide-line rounded-xl border border-line bg-surface" data-testid="nominations-attente">
          {enAttente.map((c) => (
            <li key={c.id} data-testid="nomination" className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 text-[13px]">
                  <div className="text-[13.5px] font-semibold">
                    {c.agent?.nom ?? 'Compte inconnu'} → {c.poste.libelleRole}{c.poste.unite ? ` — ${c.poste.unite}` : ''}
                  </div>
                  <div className="text-[12px] text-text-muted">
                    Acte n° {c.acteNumero} · effet le {date(c.dateEffet)}{c.fonction ? ` · fonction « ${c.fonction} »` : ''}
                    {c.agent ? ` · rôle actuel : ${c.agent.libelleRole}${c.agent.unite ? ` (${c.agent.unite})` : ''}` : ''}
                  </div>
                  <div className="mt-1">
                    {c.ancienTitulaire ? (
                      <>
                        Actuel titulaire : <strong>{c.ancienTitulaire.nom}</strong> ({c.ancienTitulaire.libelleRole}) →{' '}
                        {c.ancienTitulaire.propose ? (
                          <strong>{c.ancienTitulaire.propose.libelleRole}{c.ancienTitulaire.propose.unite ? ` — ${c.ancienTitulaire.propose.unite}` : ''}</strong>
                        ) : (
                          <strong className="text-clay">rôle à choisir</strong>
                        )}
                      </>
                    ) : (
                      'Poste vacant : aucun titulaire à déplacer.'
                    )}
                  </div>
                  {c.erreur && <p className="mt-1 text-[12px] text-clay" data-testid="nomination-erreur">Dernière tentative : {c.erreur}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.droits.confirmer && <Button variant="solid" className="!px-3 !py-1 !text-[12px]" onClick={() => setConfirmer(c)}>Confirmer…</Button>}
                  {c.droits.refuser && <Button variant="outline" className="!px-3 !py-1 !text-[12px]" onClick={() => setRefuser(c)}>Rejeter avec un motif</Button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-1 text-[15px] font-bold">Écarts entre fonction du dossier et rôle du compte</h2>
      <p className="mb-2 text-[12.5px] text-text-muted">Relevés à chaque ouverture, signalés chaque matin aux administrateurs et dans la supervision.</p>
      {l.ecarts.length === 0 ? (
        <p className="mb-6 rounded-xl border border-line bg-surface p-5 text-[13px] text-text-muted">Aucun écart : fonctions et rôles concordent.</p>
      ) : (
        <ul className="mb-6 divide-y divide-line rounded-xl border border-line bg-surface" data-testid="ecarts">
          {l.ecarts.map((e) => (
            <li key={e.userId} data-testid="ecart" className="px-4 py-2.5 text-[13px]">
              <strong>{e.nom}</strong> <span className="text-text-muted">· rôle : {l.choix.roles.find((r) => r.role === e.role)?.libelle ?? e.role} · fonction : {e.fonction ?? '—'}</span>
              <div className="text-[12.5px]">{e.motif}. <span className="text-text-muted">{e.suite}.</span></div>
            </li>
          ))}
        </ul>
      )}

      {traites.length > 0 && (
        <>
          <h2 className="mb-2 text-[15px] font-bold">Nominations traitées</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface" data-testid="nominations-traitees">
            {traites.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                <span>
                  {c.agent?.nom ?? 'Compte inconnu'} → {c.poste.libelleRole}{c.poste.unite ? ` — ${c.poste.unite}` : ''}
                  <span className="text-text-muted"> · acte n° {c.acteNumero}{c.decidePar ? ` · ${c.decidePar}` : ''}{c.decideLe ? `, le ${date(c.decideLe)}` : ''}{c.motifRefus ? ` · motif : ${c.motifRefus}` : ''}</span>
                </span>
                <Badge tone={STATUT[c.statut].ton}>{STATUT[c.statut].libelle}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}

      {confirmer && <FenetreConfirmer c={confirmer} choix={l.choix} onClose={() => setConfirmer(null)} onFait={fait('Nomination appliquée', `${confirmer.agent?.nom ?? 'La personne'} est ${confirmer.poste.libelleRole} ; ses sessions sont fermées.`)} />}
      {refuser && <FenetreRefuser c={refuser} onClose={() => setRefuser(null)} onFait={fait('Nomination rejetée', 'Le DRH voit le motif sur le mouvement.')} />}
    </div>
  );
}

function FenetreConfirmer({ c, choix, onClose, onFait }: { c: ChangementRoleNomination; choix: ListeChangementsRole['choix']; onClose: () => void; onFait: () => void }) {
  const p = c.ancienTitulaire?.propose;
  const [v, setV] = useState({ role: (p?.role ?? '') as SystemRole | '', divisionId: p?.divisionId ?? '', sectionId: p?.sectionId ?? '', celluleId: p?.celluleId ?? '', note: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const division = choix.divisions.find((d) => d.id === v.divisionId);
  return (
    <FenetreFormulaire
      titre="Confirmer la nomination"
      sousTitre={`Acte n° ${c.acteNumero}`}
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Appliquer les droits"
      pied="Les sessions sont fermées ; chacun se reconnecte avec ses nouveaux droits."
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await confirmerChangementRole(c.id, {
            note: v.note.trim() || undefined,
            ...(c.ancienTitulaire && v.role ? { ancienTitulaire: { role: v.role, divisionId: v.divisionId || null, sectionId: v.sectionId || null, celluleId: v.celluleId || null } } : {}),
          });
          onFait();
        } catch (x) {
          setErreur(messageErreur(x));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <p className="mb-3.5 text-[13px]">
        <strong>{c.agent?.nom}</strong> devient <strong>{c.poste.libelleRole}{c.poste.unite ? ` — ${c.poste.unite}` : ''}</strong>.
      </p>
      {c.ancienTitulaire && (
        <fieldset className="mb-3.5 rounded-[10px] border border-line px-3.5 pt-2">
          <legend className="px-1 text-[13px] font-semibold">Nouveau rôle de {c.ancienTitulaire.nom} ({c.ancienTitulaire.libelleRole})</legend>
          <Grille2>
            <Liste id="no-role" label="Rôle" required messageObligatoire="Choisissez le nouveau rôle de l’actuel titulaire." vide="— Choisir —" value={v.role} onChange={(x) => setV((o) => ({ ...o, role: x as SystemRole }))} options={choix.roles.map((r) => ({ value: r.role, label: r.libelle }))} />
            <Liste id="no-division" label="Division" vide="—" value={v.divisionId} onChange={(x) => setV((o) => ({ ...o, divisionId: x, sectionId: '', celluleId: x ? '' : o.celluleId }))} options={choix.divisions.map((d) => ({ value: d.id, label: d.name }))} />
            <Liste id="no-section" label="Section" vide={division ? '—' : 'Choisissez d’abord la division'} value={v.sectionId} onChange={(x) => setV((o) => ({ ...o, sectionId: x }))} options={(division?.sections ?? []).map((s) => ({ value: s.id, label: s.name }))} />
            <Liste id="no-cellule" label="Cellule" vide="—" value={v.celluleId} onChange={(x) => setV((o) => ({ ...o, celluleId: x, divisionId: x ? '' : o.divisionId, sectionId: '' }))} options={choix.cellules.map((x) => ({ value: x.id, label: x.name }))} />
          </Grille2>
          <p className="mb-3 text-[12px] text-text-muted">Son rôle change d’abord (le poste est libéré), avec le même motif.</p>
        </fieldset>
      )}
      <ZoneTexte id="no-note" label={`Précision (ajoutée au motif « Acte de nomination n° ${c.acteNumero} »)`} facultatif lignes={2} value={v.note} onChange={(x) => setV((o) => ({ ...o, note: x }))} />
    </FenetreFormulaire>
  );
}

function FenetreRefuser({ c, onClose, onFait }: { c: ChangementRoleNomination; onClose: () => void; onFait: () => void }) {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  return (
    <FenetreFormulaire
      titre="Rejeter la nomination"
      sousTitre={`Acte n° ${c.acteNumero}`}
      onClose={onClose}
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      danger
      libelleValider="Rejeter"
      pied="Le DRH voit le refus et son motif sur le mouvement."
      valider={() => (motif.trim() && motif.trim().length < 5 ? { 'nr-motif': 'Le motif doit compter au moins 5 caractères.' } : {})}
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await refuserChangementRole(c.id, motif);
          onFait();
        } catch (x) {
          setErreur(messageErreur(x));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <p className="mb-3.5 text-[13px]">Le rôle de {c.agent?.nom} ne change pas.</p>
      <ZoneTexte id="nr-motif" label="Motif" required messageObligatoire="Indiquez le motif du rejet." value={motif} onChange={setMotif} />
    </FenetreFormulaire>
  );
}
