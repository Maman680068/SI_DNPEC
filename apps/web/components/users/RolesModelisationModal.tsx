'use client';

import { useCallback, useEffect, useState } from 'react';
import { attribuerRole, clorePersonneRole, getAffectations } from '../../lib/api/modelisation';
import type { AffectationsPersonne, RoleModelisation } from '../../lib/modelisation/types';
import { BTN_LIGNE, EtatVide, Pastille } from '../ui/Charte';
import { ChoixSegment, FenetreFormulaire, Liste, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';
import { FenetreMotif } from '../modelisation/FenetresModele';

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Rôles de modélisation d'une personne (Administration → Utilisateurs, menu « ⋯ ») : analyste (attribué
 * par l'administrateur), responsable ou suppléant d'un modèle. Motif obligatoire ; la personne est
 * prévenue ; l'historique reste visible (une fin de rôle est datée et motivée). Droits et listes : API.
 */
export function RolesModelisationModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<AffectationsPersonne | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [role, setRole] = useState<RoleModelisation>('ANALYSTE');
  const [modeleId, setModeleId] = useState('');
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [aClore, setAClore] = useState<{ id: string; libelle: string } | null>(null);

  const charger = useCallback(() => {
    getAffectations(userId)
      .then((r) => {
        setD(r);
        if (!r.droits.peutAttribuerAnalyste) setRole('RESPONSABLE');
      })
      .catch((e) => setErreur(messageErreur(e)));
  }, [userId]);
  useEffect(charger, [charger]);

  const ouvertes = d?.affectations.filter((a) => !a.fin) ?? [];
  const terminees = d?.affectations.filter((a) => a.fin) ?? [];
  const peutAjouter = !!d && !d.compte.ineligible && (d.droits.peutAttribuerAnalyste || d.droits.peutDesigner);
  const roles = [
    ...(d?.droits.peutAttribuerAnalyste ? [{ value: 'ANALYSTE' as const, label: 'Analyste' }] : []),
    { value: 'RESPONSABLE' as const, label: 'Responsable d’un modèle' },
    { value: 'SUPPLEANT' as const, label: 'Suppléant d’un modèle' },
  ];

  return (
    <>
      <FenetreFormulaire
        titre="Rôles de modélisation"
        sousTitre={d ? d.compte.nom : undefined}
        largeur={640}
        onClose={onClose}
        testid="fenetre-roles-modelisation"
        libelleValider="Attribuer le rôle"
        enCours={enCours}
        erreur={erreur}
        pied="Le rang ne donne aucun droit de modélisation. La personne est prévenue ; l’historique est conservé."
        valider={() => ({
          modele: role !== 'ANALYSTE' && !modeleId ? 'Choisissez le modèle.' : null,
          motif: motif.trim().length < 5 ? 'Écrivez le motif (5 caractères au moins).' : null,
        })}
        onSubmit={
          peutAjouter
            ? async () => {
                setEnCours(true);
                setErreur(null);
                try {
                  await attribuerRole({ userId, role, motif: motif.trim(), ...(role !== 'ANALYSTE' ? { modeleId } : {}) });
                  toast.succes('Rôle de modélisation attribué', { detail: `${d?.compte.nom} est prévenu(e).` });
                  setMotif('');
                  setModeleId('');
                  charger();
                } catch (e) {
                  setErreur(messageErreur(e));
                } finally {
                  setEnCours(false);
                }
              }
            : undefined
        }
      >
        {!d ? null : (
          <>
            <h3 className="mb-2 text-[13px] font-bold text-ink-900">Rôles en cours</h3>
            {ouvertes.length === 0 ? (
              <EtatVide texte="Aucun rôle de modélisation." />
            ) : (
              <ul className="mb-4 divide-y divide-line-doux rounded-[10px] border border-line" data-testid="roles-en-cours">
                {ouvertes.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[13.5px]">
                    <Pastille ton="encre">{a.libelle}</Pastille>
                    {a.modele && <span className="font-semibold text-ink-900">{a.modele.nom}</span>}
                    <span className="min-w-0 flex-1 text-[12.5px] text-text-muted">
                      depuis le {dateFr(a.debut)} · {a.attribuePar} · {a.motif}
                    </span>
                    {a.peutClore && (
                      <button type="button" className={BTN_LIGNE} onClick={() => setAClore({ id: a.id, libelle: `${a.libelle}${a.modele ? ` — ${a.modele.nom}` : ''}` })}>
                        Mettre fin…
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {d.compte.ineligible ? (
              <p className="rounded-[10px] border border-line bg-fond-doux px-3 py-2.5 text-[13px] text-text-muted" data-testid="non-eligible">
                {d.compte.ineligible}
              </p>
            ) : (
              peutAjouter && (
                <>
                  <h3 className="mb-2 mt-2 text-[13px] font-bold text-ink-900">Attribuer un rôle</h3>
                  <ChoixSegment id="role" label="Rôle" value={role} onChange={(v) => setRole(v)} options={roles} />
                  {role !== 'ANALYSTE' && (
                    <Liste
                      id="modele"
                      label="Modèle"
                      value={modeleId}
                      onChange={setModeleId}
                      required
                      vide="Choisir un modèle…"
                      options={d.modeles.map((m) => ({ value: m.id, label: `${m.nom}${role === 'RESPONSABLE' && m.responsable ? ` (responsable : ${m.responsable})` : role === 'SUPPLEANT' && m.suppleant ? ` (suppléant : ${m.suppleant})` : ''}` }))}
                    />
                  )}
                  <ZoneTexte id="motif" label="Motif (décision, note de service…)" value={motif} onChange={setMotif} required lignes={2} maxLength={2000} />
                </>
              )
            )}
            {terminees.length > 0 && (
              <>
                <h3 className="mb-2 mt-4 text-[13px] font-bold text-ink-900">Historique</h3>
                <ul className="space-y-1 text-[12.5px] text-text-muted" data-testid="roles-termines">
                  {terminees.map((a) => (
                    <li key={a.id}>
                      {a.libelle}
                      {a.modele ? ` — ${a.modele.nom}` : ''} : du {dateFr(a.debut)} au {dateFr(a.fin!)} ({a.motifFin})
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </FenetreFormulaire>
      {aClore && (
        <FenetreMotif
          titre="Mettre fin au rôle"
          sousTitre={aClore.libelle}
          libelle="Motif"
          libelleValider="Mettre fin au rôle"
          danger
          testid="fenetre-fin-role"
          onClose={() => setAClore(null)}
          onValider={async (m) => {
            await clorePersonneRole(aClore.id, m);
            setAClore(null);
            toast.succes('Rôle de modélisation terminé');
            charger();
          }}
        />
      )}
    </>
  );
}
