'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import {
  confirmerFinAgent,
  creerAgent,
  departAgent,
  modifierAgent,
  prolongerAgent,
  reactiverAgent,
  suspendreAgent,
} from '../../lib/api/socle';
import type { ActionAgent, AgentDetail, StatutAgent, UniteOrganigramme } from '../../lib/socle/types';
import { LIBELLE_MOUVEMENT } from '../../lib/socle/types';
import { BTN_DANGER_CONTOUR, BTN_PRINCIPAL, BTN_SECONDAIRE, CleValeur, Pastille, SectionFenetre, type TonPastille } from '../ui/Charte';
import { Field } from '../ui/Input';
import { Choix, Fenetre, Texte } from '../ui/Fenetre';
import { FenetreDetail } from '../ui/FenetreDetail';

export const TON_STATUT: Record<StatutAgent, 'sage' | 'clay' | 'muted'> = {
  EN_ACTIVITE: 'sage',
  SUSPENDU: 'clay',
  PARTI: 'muted',
};

/** Statut de l'agent en pastille de la charte. */
export const TON_PASTILLE: Record<StatutAgent, TonPastille> = {
  EN_ACTIVITE: 'vert',
  SUSPENDU: 'rouge',
  PARTI: 'gris',
};

const date = (d: string) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
const aujourdhui = () => new Date().toISOString().slice(0, 10);

const LIBELLE_ACTION: Record<Exclude<ActionAgent, 'MODIFIER'>, string> = {
  PROLONGER: 'Prolonger',
  CONFIRMER_FIN: 'Confirmer la fin',
  SUSPENDRE: 'Suspendre',
  REACTIVER: 'Réactiver',
  DEPART: 'Enregistrer le départ',
};

/** Phrase d'explication sous les actions du cycle de vie (selon le statut et la fin prévue). */
function explication(agent: AgentDetail): string {
  if (agent.statut === 'PARTI') return 'Agent parti : son dossier et son historique sont conservés ; aucune action du cycle de vie ne s’applique plus.';
  if (agent.statut === 'SUSPENDU') return 'Agent suspendu : son compte ne peut plus se connecter jusqu’à la réactivation. Chaque action est datée, motivée et inscrite à l’historique.';
  if (agent.dateFinPrevue && !agent.finConfirmeeAt)
    return 'Prolongez ou confirmez la fin prévue ; sans décision, l’agent passe « Parti » à l’échéance. Chaque action est datée, motivée et inscrite à l’historique.';
  return 'Le cycle de vie de l’agent (suspension, réactivation, départ) est tenu par le DRH ; chaque action est datée, motivée et inscrite à l’historique.';
}

/** Fiche d'un agent (fenêtre centrée) : à gauche fin prévue et historique ; à droite les actions du DRH puis les informations. */
export function AgentPanneau({ agent, onClose, onChange }: { agent: AgentDetail; onClose: () => void; onChange: (a: AgentDetail) => void }) {
  const [action, setAction] = useState<ActionAgent | null>(null);
  const stage = agent.natureFinPrevue === 'STAGE';
  const libelle = (a: Exclude<ActionAgent, 'MODIFIER'>) =>
    a === 'PROLONGER' ? (stage ? 'Prolonger le stage' : 'Prolonger le contrat') : LIBELLE_ACTION[a];
  const fait = (a: AgentDetail) => {
    setAction(null);
    onChange(a);
  };
  const autres = (['PROLONGER', 'CONFIRMER_FIN', 'SUSPENDRE', 'REACTIVER', 'DEPART'] as const).filter((a) => agent.actions.includes(a));

  const cote = (
    <div>
      {agent.actions.length > 0 ? (
        <div className="grid gap-2">
          {autres.map((a) => (
            <button
              key={a}
              type="button"
              className={a === 'PROLONGER' || a === 'REACTIVER' ? BTN_PRINCIPAL : a === 'DEPART' || a === 'SUSPENDRE' ? BTN_DANGER_CONTOUR : BTN_SECONDAIRE}
              onClick={() => setAction(a)}
            >
              {libelle(a)}
            </button>
          ))}
          {agent.actions.includes('MODIFIER') && (
            <button type="button" className={BTN_SECONDAIRE} onClick={() => setAction('MODIFIER')}>
              <Pencil aria-hidden size={15} /> Modifier
            </button>
          )}
        </div>
      ) : (
        <p className="text-[12.5px] text-text-muted">Aucune action possible sur cet agent.</p>
      )}
      <p className="mt-2.5 text-[12.5px] text-text-muted" data-testid="explication-cycle">{explication(agent)}</p>
      <div className="mt-4 border-t border-line pt-4">
        <CleValeur
          largeur={84}
          lignes={[
            ['Statut', <Pastille key="s" ton={TON_PASTILLE[agent.statut]}>{agent.libelleStatut}</Pastille>],
            ['Matricule', (
              <span key="m" className="font-mono text-[12.5px]">
                {agent.matricule}
                {agent.matriculeProvisoire && <span className="ml-1 font-sans text-[11.5px] text-clay">(provisoire)</span>}
              </span>
            )],
            ['Unité', (
              <span key="u">
                {agent.unite ? `${agent.unite.code} — ${agent.unite.libelle}` : '—'}
                {agent.cheminUnite.length > 1 && <span className="block text-[11.5px] font-normal text-text-muted">{agent.cheminUnite.join(' › ')}</span>}
              </span>
            )],
            ['Fonction', agent.fonction ?? '—'],
            ['Genre', agent.genre === 'F' ? 'Femme' : agent.genre === 'M' ? 'Homme' : '—'],
            ['Compte', agent.compte ? `${agent.compte.email} (${agent.compte.status === 'SUPPRIME' ? 'désactivé' : agent.compte.status.toLowerCase().replace('_', ' ')})` : 'Aucun compte'],
          ]}
        />
      </div>
    </div>
  );

  return (
    <>
      <FenetreDetail
        titre={`${agent.prenoms} ${agent.nom}`}
        filAriane={['Agents', agent.unite?.code]}
        entete={
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-text-muted">
            <span className="font-mono">{agent.matricule}</span>
            {agent.matriculeProvisoire && <Pastille ton="rouge">Matricule provisoire</Pastille>}
            <Pastille ton={TON_PASTILLE[agent.statut]}>{agent.libelleStatut}</Pastille>
            {agent.fonction && <span>· {agent.fonction}</span>}
          </div>
        }
        cote={cote}
        onClose={onClose}
        largeur={900}
        testid="fiche-agent"
      >
        {agent.dateFinPrevue && agent.statut !== 'PARTI' && (
          <div data-testid="fin-prevue" className={`mb-4 rounded-[10px] border px-3.5 py-3 text-[13px] ${agent.finProche ? 'border-[#E7B3BB] bg-clay-50 text-clay' : 'border-line bg-[#FAFBFD] text-text'}`}>
            <strong>{stage ? 'Fin de stage' : 'Fin de contrat'} le {date(agent.dateFinPrevue)}</strong>
            {agent.joursAvantFin !== null && agent.joursAvantFin >= 0 && <> (dans {agent.joursAvantFin} jour{agent.joursAvantFin > 1 ? 's' : ''})</>}
            <div className="mt-1 text-[12.5px]">
              {agent.finConfirmeeAt
                ? 'Fin confirmée : l’agent passera « Parti » et son compte sera désactivé à l’échéance.'
                : 'Sans décision, l’agent passera automatiquement « Parti » et son compte sera désactivé à l’échéance.'}
            </div>
          </div>
        )}
        {agent.statut === 'PARTI' && agent.dateDepart && (
          <div className="mb-4 rounded-[10px] border border-line bg-[#FAFBFD] px-3.5 py-3 text-[13px]">
            Parti le {date(agent.dateDepart)}
            {agent.motifDepart && <> — {agent.motifDepart}</>}. Le dossier est conservé.
          </div>
        )}

        <SectionFenetre titre="Historique" n={agent.mouvements.length}>
          {agent.mouvements.length === 0 ? (
            <p className="text-[13px] text-text-muted">Aucun mouvement enregistré.</p>
          ) : (
            <ul className="divide-y divide-[#F0F1F6] rounded-[10px] border border-line">
              {agent.mouvements.map((m) => (
                <li key={m.id} className="px-3.5 py-2.5 text-[13px]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink-900">{LIBELLE_MOUVEMENT[m.type] ?? m.type}</span>
                    <span className="text-[12px] text-text-muted">{date(m.dateEffet)}</span>
                  </div>
                  <div className="text-[12.5px] text-text-muted">{m.auteur ? `${m.auteur.firstName} ${m.auteur.lastName}` : 'Système'}</div>
                  {m.motif && <div className="mt-0.5 text-[12.5px] text-text">{m.motif}</div>}
                </li>
              ))}
            </ul>
          )}
        </SectionFenetre>
      </FenetreDetail>

      {action === 'MODIFIER' && <FenetreModifierAgent agent={agent} onClose={() => setAction(null)} onFait={fait} />}
      {action && action !== 'MODIFIER' && <FenetreActionAgent agent={agent} action={action} titre={libelle(action)} onClose={() => setAction(null)} onFait={fait} />}
    </>
  );
}

function FenetreActionAgent({
  agent,
  action,
  titre,
  onClose,
  onFait,
}: {
  agent: AgentDetail;
  action: Exclude<ActionAgent, 'MODIFIER'>;
  titre: string;
  onClose: () => void;
  onFait: (a: AgentDetail) => void;
}) {
  const [motif, setMotif] = useState('');
  const [dateSaisie, setDateSaisie] = useState(action === 'DEPART' ? aujourdhui() : '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const finPassee = !!agent.dateFinPrevue && agent.dateFinPrevue.slice(0, 10) < aujourdhui();
  const nom = `${agent.prenoms} ${agent.nom}`;

  const envoyer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const r =
        action === 'SUSPENDRE' ? await suspendreAgent(agent.id, motif.trim())
        : action === 'REACTIVER' ? await reactiverAgent(agent.id, motif.trim(), dateSaisie || undefined)
        : action === 'DEPART' ? await departAgent(agent.id, dateSaisie, motif.trim())
        : action === 'PROLONGER' ? await prolongerAgent(agent.id, dateSaisie, motif.trim())
        : await confirmerFinAgent(agent.id);
      onFait(r);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue');
      setEnCours(false);
    }
  };

  return (
    <Fenetre titre={`${titre} — ${nom}`} onClose={onClose} onSubmit={envoyer} enCours={enCours} erreur={erreur} libelleValider={titre} danger={action === 'DEPART' || action === 'SUSPENDRE'}>
      {action === 'CONFIRMER_FIN' && (
        <p className="mb-4 text-[13px] text-text-muted">
          {nom} passera « Parti » et son compte sera désactivé le lendemain du {agent.dateFinPrevue && date(agent.dateFinPrevue)}. Vous ne recevrez plus de rappel. Le dossier, l’évaluation et l’attestation sont conservés.
        </p>
      )}
      {action === 'SUSPENDRE' && <p className="mb-4 text-[13px] text-text-muted">Le compte est suspendu aussitôt : {nom} ne peut plus se connecter.</p>}
      {action === 'DEPART' && (
        <p className="mb-4 text-[13px] text-text-muted">
          Le compte est désactivé, les tâches en cours sont transférées au responsable de l’unité, les suppléances et rôles en cours sont retirés. Le dossier est conservé.
        </p>
      )}
      {(action === 'PROLONGER' || action === 'DEPART' || (action === 'REACTIVER' && (finPassee || !!agent.dateFinPrevue))) && (
        <Field
          label={action === 'DEPART' ? 'Date de départ' : action === 'PROLONGER' ? 'Nouvelle date de fin' : `Nouvelle date de fin${finPassee ? '' : ' (facultative)'}`}
          type="date"
          value={dateSaisie}
          onChange={(e) => setDateSaisie(e.target.value)}
          required={action !== 'REACTIVER' || finPassee}
        />
      )}
      {action !== 'CONFIRMER_FIN' && <Texte label="Motif" value={motif} onChange={setMotif} required />}
    </Fenetre>
  );
}

function FenetreModifierAgent({ agent, onClose, onFait }: { agent: AgentDetail; onClose: () => void; onFait: (a: AgentDetail) => void }) {
  const [matricule, setMatricule] = useState(agent.matriculeProvisoire ? '' : agent.matricule);
  const [nom, setNom] = useState(agent.nom);
  const [prenoms, setPrenoms] = useState(agent.prenoms);
  const [genre, setGenre] = useState(agent.genre ?? '');
  const [fonction, setFonction] = useState(agent.fonction ?? '');
  const [finContrat, setFinContrat] = useState(agent.natureFinPrevue === 'CONTRAT' && agent.dateFinPrevue ? agent.dateFinPrevue.slice(0, 10) : '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const envoyer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      onFait(
        await modifierAgent(agent.id, {
          ...(matricule.trim() && matricule.trim() !== agent.matricule ? { matricule: matricule.trim() } : {}),
          nom: nom.trim(),
          prenoms: prenoms.trim(),
          ...(genre ? { genre } : {}),
          fonction: fonction.trim(),
          ...(agent.natureFinPrevue !== 'STAGE' && finContrat ? { dateFinPrevue: finContrat, natureFinPrevue: 'CONTRAT' } : {}),
        }),
      );
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue');
      setEnCours(false);
    }
  };
  return (
    <Fenetre titre={`Modifier ${agent.prenoms} ${agent.nom}`} onClose={onClose} onSubmit={envoyer} enCours={enCours} erreur={erreur}>
      <Field label={agent.matriculeProvisoire ? `Matricule (provisoire : ${agent.matricule})` : 'Matricule'} value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="Matricule de la Fonction publique" />
      <Field label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
      <Field label="Prénoms" value={prenoms} onChange={(e) => setPrenoms(e.target.value)} required />
      <Choix label="Genre" value={genre} onChange={setGenre} vide="Non renseigné" options={[{ value: 'F', label: 'Femme' }, { value: 'M', label: 'Homme' }]} />
      <Field label="Fonction" value={fonction} onChange={(e) => setFonction(e.target.value)} />
      {agent.natureFinPrevue !== 'STAGE' && <Field label="Fin de contrat (facultative)" type="date" value={finContrat} onChange={(e) => setFinContrat(e.target.value)} />}
    </Fenetre>
  );
}

export function FenetreNouvelAgent({ unites, onClose, onFait }: { unites: UniteOrganigramme[]; onClose: () => void; onFait: () => void }) {
  const [matricule, setMatricule] = useState('');
  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [genre, setGenre] = useState('');
  const [uniteId, setUniteId] = useState('');
  const [fonction, setFonction] = useState('');
  const [nature, setNature] = useState('');
  const [fin, setFin] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const envoyer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await creerAgent({
        ...(matricule.trim() ? { matricule: matricule.trim() } : {}),
        nom: nom.trim(),
        prenoms: prenoms.trim(),
        ...(genre ? { genre } : {}),
        uniteId,
        ...(fonction.trim() ? { fonction: fonction.trim() } : {}),
        ...(nature && fin ? { natureFinPrevue: nature, dateFinPrevue: fin } : {}),
      });
      onFait();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue');
      setEnCours(false);
    }
  };
  return (
    <Fenetre titre="Nouvel agent" onClose={onClose} onSubmit={envoyer} enCours={enCours} erreur={erreur} libelleValider="Créer l’agent">
      <Field label="Matricule (facultatif)" value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="Sinon un matricule provisoire est attribué" />
      <Field label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
      <Field label="Prénoms" value={prenoms} onChange={(e) => setPrenoms(e.target.value)} required />
      <Choix label="Genre" value={genre} onChange={setGenre} vide="Non renseigné" options={[{ value: 'F', label: 'Femme' }, { value: 'M', label: 'Homme' }]} />
      <Choix label="Unité" value={uniteId} onChange={setUniteId} required vide="Choisir une unité…" options={unites.map((u) => ({ value: u.id, label: `${u.code} — ${u.libelle}` }))} />
      <Field label="Fonction" value={fonction} onChange={(e) => setFonction(e.target.value)} />
      <Choix label="Fin prévue" value={nature} onChange={setNature} vide="Aucune" options={[{ value: 'CONTRAT', label: 'Fin de contrat' }, { value: 'STAGE', label: 'Fin de stage' }]} />
      {nature && <Field label="Date de fin" type="date" value={fin} onChange={(e) => setFin(e.target.value)} required />}
      <p className="mb-2 text-[12px] text-text-faint">Le compte de connexion se crée ensuite, par l’administrateur, à partir de cet agent.</p>
    </Fenetre>
  );
}
