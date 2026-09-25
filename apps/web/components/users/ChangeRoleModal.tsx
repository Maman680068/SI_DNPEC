'use client';

import { useState, type FormEvent } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { apercuChangementRole, changerRole } from '../../lib/api/users';
import type { SystemRole } from '../../lib/auth/types';
import type { AdminUser, ChangementRoleApercu, ChangementRoleInput, OrgAttachment } from '../../lib/users/types';
import { ROLE_LABEL, SYSTEM_ROLES } from '../../lib/users/types';
import { Button } from '../ui/Button';
import { OrgAttachmentFields } from './OrgAttachmentFields';

const SELECT_CLASS = 'w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm';

function Liste({ titre, lignes, vide }: { titre: string; lignes: string[]; vide?: string }) {
  if (lignes.length === 0 && !vide) return null;
  return (
    <div className="mb-3">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-text-faint">{titre}</div>
      {lignes.length === 0 ? (
        <p className="text-[12.5px] text-text-faint">{vide}</p>
      ) : (
        <ul className="list-disc space-y-0.5 pl-5 text-[12.5px]">
          {lignes.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Changement de rôle d'un compte (administrateur système) en deux temps :
 * saisie (rôle, rattachement exigé par le rôle, intitulé, motif), puis aperçu
 * des effets CALCULÉ PAR L'API (mêmes contrôles et mêmes effets que l'action),
 * puis confirmation. L'écran n'applique aucune règle lui-même.
 */
export function ChangeRoleModal({ user, onClose, onChanged }: { user: AdminUser; onClose: () => void; onChanged: () => void }) {
  const { getCelluleName, getDivisionName, getSectionName, getUserLabel, refreshOrg } = useOrg();
  const [role, setRole] = useState<SystemRole>(user.role);
  const [attachment, setAttachment] = useState<OrgAttachment>({
    divisionId: user.divisionId,
    sectionId: user.sectionId,
    celluleId: user.celluleId,
    supervisorId: user.supervisorId,
  });
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? '');
  const [motif, setMotif] = useState('');
  const [apercu, setApercu] = useState<ChangementRoleApercu | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const input = (): ChangementRoleInput => ({
    role,
    roleAttendu: user.role,
    ...attachment,
    jobTitle: jobTitle.trim() && jobTitle.trim() !== (user.jobTitle ?? '') ? jobTitle.trim() : undefined,
    motif: motif.trim(),
  });

  async function voirEffets(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      setApercu(await apercuChangementRole(user.id, input()));
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Aperçu impossible');
    } finally {
      setEnCours(false);
    }
  }

  async function confirmer() {
    setEnCours(true);
    setErreur(null);
    try {
      await changerRole(user.id, input());
      await refreshOrg();
      onChanged();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Changement impossible');
      setApercu(null);
    } finally {
      setEnCours(false);
    }
  }

  const unite = (r: { divisionId: string | null; sectionId: string | null; celluleId: string | null; supervisorId: string | null }) => {
    if (r.supervisorId) return `assiste ${getUserLabel(r.supervisorId)}`;
    if (r.celluleId) return getCelluleName(r.celluleId) ?? '';
    if (r.divisionId) return [getDivisionName(r.divisionId), getSectionName(r.sectionId)].filter(Boolean).join(' · ');
    return 'sans rattachement';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,26,38,0.42)] sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={voirEffets}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Changer de rôle"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg bg-surface p-5 sm:max-w-[560px] sm:rounded-lg sm:p-6"
      >
        <h2 className="mb-1 text-[18px] font-semibold">Changer de rôle</h2>
        <p className="mb-4 text-[12.5px] text-text-muted">
          {user.firstName} {user.lastName} — actuellement {ROLE_LABEL[user.role]} ({unite(user)}).
        </p>

        {!apercu ? (
          <>
            <div className="mb-4">
              <label htmlFor="cr-role" className="mb-1.5 block text-[12.5px] font-semibold">
                Nouveau rôle
              </label>
              <select id="cr-role" className={SELECT_CLASS} value={role} onChange={(e) => setRole(e.target.value as SystemRole)}>
                {SYSTEM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <OrgAttachmentFields role={role} value={attachment} onChange={setAttachment} />
            <div className="mb-4">
              <label htmlFor="cr-poste" className="mb-1.5 block text-[12.5px] font-semibold">
                Intitulé du poste (facultatif)
              </label>
              <input id="cr-poste" className={SELECT_CLASS} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={200} />
            </div>
            <div className="mb-4">
              <label htmlFor="cr-motif" className="mb-1.5 block text-[12.5px] font-semibold">
                Motif (obligatoire)
              </label>
              <textarea
                id="cr-motif"
                className={`${SELECT_CLASS} min-h-[70px]`}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                required
                minLength={5}
                maxLength={1000}
              />
              <p className="mt-1 text-[11.5px] text-text-faint">Conservé dans le journal d’audit ; il n’apparaît pas dans les notifications.</p>
            </div>
          </>
        ) : (
          <div data-testid="apercu-role">
            <p className="mb-3 rounded-md bg-accent-soft px-3.5 py-2.5 text-[13px] text-ink">
              <strong>{ROLE_LABEL[apercu.avant.role]}</strong> ({unite(apercu.avant)}) → <strong>{ROLE_LABEL[apercu.apres.role]}</strong> ({unite(apercu.apres)})
            </p>
            <Liste
              titre="Suppléances révoquées (plus conformes au rang)"
              lignes={apercu.effets.suppleancesRevoquees.map((s) => `${s.suppleant} pour ${s.titulaire}`)}
            />
            <Liste titre="Suppléances conservées" lignes={apercu.effets.suppleancesConservees.map((s) => `${s.suppleant} pour ${s.titulaire}`)} />
            <Liste
              titre="Accès délégués au courrier révoqués"
              lignes={apercu.effets.accesDeleguesRevoques > 0 ? [`${apercu.effets.accesDeleguesRevoques} accès`] : []}
            />
            <Liste
              titre="Circuits de visa à recalculer (rédacteurs prévenus)"
              lignes={apercu.effets.circuitsDeVisaARecalculer.map((c) => c.objet)}
            />
            <Liste
              titre="Conservé — à vérifier"
              lignes={[
                ...apercu.effets.habilitationsConservees.map((h) => `Habilitation courrier ${h.registre} (${h.uniteKey})`),
                ...apercu.effets.imputationsEnCours.map((i) => `Imputation en cours : courrier ${i.numero}`),
                ...(apercu.effets.taches.assignees ? [`${apercu.effets.taches.assignees} tâche(s) assignée(s) en cours`] : []),
                ...(apercu.effets.taches.creees ? [`${apercu.effets.taches.creees} tâche(s) créée(s) en cours`] : []),
              ]}
            />
            <Liste
              titre="Chef de cellule"
              lignes={[
                ...(apercu.effets.celluleQuittee ? [`Quitte la direction de ${getCelluleName(apercu.effets.celluleQuittee)}`] : []),
                ...(apercu.effets.celluleNommee ? [`Devient chef de ${getCelluleName(apercu.effets.celluleNommee)}`] : []),
              ]}
            />
            <p className="mb-3 text-[12.5px] text-text-muted">
              Toutes ses sessions seront fermées ({apercu.effets.sessionsRevoquees} active{apercu.effets.sessionsRevoquees > 1 ? 's' : ''}) ; la personne
              et les DRH sont prévenus. Changement immédiat, tracé dans l’historique de carrière.
            </p>
          </div>
        )}

        {erreur && (
          <div role="alert" className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">
            {erreur}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={apercu ? () => setApercu(null) : onClose}>
            {apercu ? 'Modifier' : 'Annuler'}
          </Button>
          {apercu ? (
            <Button type="button" variant="gold" disabled={enCours} onClick={confirmer}>
              {enCours ? 'Enregistrement…' : 'Confirmer le changement'}
            </Button>
          ) : (
            <Button type="submit" variant="gold" disabled={enCours}>
              {enCours ? 'Vérification…' : 'Voir les effets'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
