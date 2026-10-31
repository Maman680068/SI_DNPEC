'use client';

import { useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { apercuChangementRole, changerRole } from '../../lib/api/users';
import type { SystemRole } from '../../lib/auth/types';
import type { AdminUser, ChangementRoleApercu, ChangementRoleInput, OrgAttachment } from '../../lib/users/types';
import { ROLE_LABEL, SYSTEM_ROLES } from '../../lib/users/types';
import { FenetreFormulaire, Grille2, Liste as ListeChoix, Saisie, ZoneTexte } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';
import { OrgAttachmentFields } from './OrgAttachmentFields';

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
export function ChangeRoleModal({
  user,
  onClose,
  onChanged,
  cible,
}: {
  user: AdminUser;
  onClose: () => void;
  onChanged: (role: SystemRole) => void;
  /** « Désigner un chef » (Organisation, S8) : rôle et rattachement proposés ; l'aperçu de l'API reste exigé. */
  cible?: { role: SystemRole; rattachement: OrgAttachment };
}) {
  const { getCelluleName, getDivisionName, getSectionName, getUserLabel, refreshOrg } = useOrg();
  const [role, setRole] = useState<SystemRole>(cible?.role ?? user.role);
  const [attachment, setAttachment] = useState<OrgAttachment>(
    cible?.rattachement ?? {
      divisionId: user.divisionId,
      sectionId: user.sectionId,
      celluleId: user.celluleId,
      supervisorId: user.supervisorId,
    },
  );
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

  async function voirEffets() {
    setEnCours(true);
    setErreur(null);
    try {
      setApercu(await apercuChangementRole(user.id, input()));
    } catch (err) {
      setErreur(messageErreur(err, 'Aperçu impossible'));
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
      onChanged(role);
    } catch (err) {
      setErreur(messageErreur(err, 'Changement impossible'));
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
    <FenetreFormulaire
      titre="Changer de rôle"
      sousTitre={`${user.firstName} ${user.lastName} — actuellement ${ROLE_LABEL[user.role]} (${unite(user)}).`}
      onClose={onClose}
      onSubmit={apercu ? confirmer : voirEffets}
      valider={() => (!apercu && motif.trim() && motif.trim().length < 5 ? { 'cr-motif': 'Le motif doit compter au moins 5 caractères.' } : {})}
      enCours={enCours}
      erreur={erreur}
      libelleValider={apercu ? 'Confirmer le changement' : 'Voir les effets'}
      pied={apercu ? 'Changement immédiat : la personne et les DRH sont prévenus.' : 'Les effets sont calculés par le serveur avant toute confirmation.'}
      testid="fenetre-changement-role"
    >
      {!apercu ? (
        <>
          <ListeChoix id="cr-role" label="Nouveau rôle" value={role} onChange={(v) => setRole(v as SystemRole)} options={SYSTEM_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
          <OrgAttachmentFields role={role} value={attachment} onChange={setAttachment} />
          <Grille2>
            <Saisie id="cr-poste" label="Intitulé du poste" facultatif value={jobTitle} onChange={setJobTitle} maxLength={200} />
          </Grille2>
          <ZoneTexte id="cr-motif" label="Motif" value={motif} onChange={setMotif} required messageObligatoire="Indiquez le motif du changement." maxLength={1000} />
          <p className="-mt-2 mb-3.5 text-[12px] text-text-muted">Conservé dans le journal d’audit ; il n’apparaît pas dans les notifications.</p>
        </>
      ) : (
        <div data-testid="apercu-role">
          <p className="mb-3 rounded-[10px] bg-ink-50 px-3.5 py-2.5 text-[13px] text-ink">
            <strong>{ROLE_LABEL[apercu.avant.role]}</strong> ({unite(apercu.avant)}) → <strong>{ROLE_LABEL[apercu.apres.role]}</strong> ({unite(apercu.apres)})
          </p>
          <Liste titre="Suppléances révoquées (plus conformes au rang)" lignes={apercu.effets.suppleancesRevoquees.map((s) => `${s.suppleant} pour ${s.titulaire}`)} />
          <Liste titre="Suppléances conservées" lignes={apercu.effets.suppleancesConservees.map((s) => `${s.suppleant} pour ${s.titulaire}`)} />
          <Liste titre="Accès délégués au courrier révoqués" lignes={apercu.effets.accesDeleguesRevoques > 0 ? [`${apercu.effets.accesDeleguesRevoques} accès`] : []} />
          <Liste titre="Circuits de visa à recalculer (rédacteurs prévenus)" lignes={apercu.effets.circuitsDeVisaARecalculer.map((c) => c.objet)} />
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
          <p className="mb-1 text-[12.5px] text-text-muted">
            Toutes ses sessions seront fermées ({apercu.effets.sessionsRevoquees} active{apercu.effets.sessionsRevoquees > 1 ? 's' : ''}) ; la personne et les DRH sont prévenus.
            Changement immédiat, tracé dans l’historique de carrière.
          </p>
          <button type="button" className="text-[12.5px] font-semibold text-ink underline" onClick={() => setApercu(null)}>
            Modifier la saisie
          </button>
        </div>
      )}
    </FenetreFormulaire>
  );
}
