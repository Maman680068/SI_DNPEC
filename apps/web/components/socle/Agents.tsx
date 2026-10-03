'use client';

import { useEffect, useId, useState } from 'react';
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
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field } from '../ui/Input';
import { Choix, Fenetre, Texte } from '../ui/Fenetre';
import { FenetreDetail } from '../ui/FenetreDetail';

export const TON_STATUT: Record<StatutAgent, 'sage' | 'clay' | 'muted'> = {
  EN_ACTIVITE: 'sage',
  SUSPENDU: 'clay',
  PARTI: 'muted',
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

/** Panneau latéral d'un agent : identité, unité, compte, fin prévue, actions du DRH, historique. */
export function AgentPanneau({ agent, onClose, onChange }: { agent: AgentDetail; onClose: () => void; onChange: (a: AgentDetail) => void }) {
  const idTitre = useId();
  const [action, setAction] = useState<ActionAgent | null>(null);
  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && !action && onClose();
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [onClose, action]);
  const stage = agent.natureFinPrevue === 'STAGE';
  const libelle = (a: Exclude<ActionAgent, 'MODIFIER'>) =>
    a === 'PROLONGER' ? (stage ? 'Prolonger le stage' : 'Prolonger le contrat') : LIBELLE_ACTION[a];
  const fait = (a: AgentDetail) => {
    setAction(null);
    onChange(a);
  };

  return (
    <>
      <FenetreDetail titre={`Agent — ${agent.prenoms} ${agent.nom}`} onClose={onClose} sansEntete largeur={720}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-sage">Agent</div>
            <h2 id={idTitre} className="text-[19px] font-extrabold">
              {agent.prenoms} {agent.nom}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-text-muted">
              <span className="font-mono">{agent.matricule}</span>
              {agent.matriculeProvisoire && <Badge tone="clay">MATRICULE PROVISOIRE</Badge>}
              <Badge tone={TON_STATUT[agent.statut]}>{agent.libelleStatut.toUpperCase()}</Badge>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-md px-2 py-1 text-text-muted hover:bg-bg">
            ✕
          </button>
        </div>

        {agent.dateFinPrevue && agent.statut !== 'PARTI' && (
          <div data-testid="fin-prevue" className={`mb-4 rounded-md px-3.5 py-3 text-[13px] ${agent.finProche ? 'bg-clay-soft text-clay' : 'bg-bg text-text'}`}>
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
          <div className="mb-4 rounded-md bg-bg px-3.5 py-3 text-[13px]">
            Parti le {date(agent.dateDepart)}
            {agent.motifDepart && <> — {agent.motifDepart}</>}. Le dossier est conservé.
          </div>
        )}

        {agent.actions.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {agent.actions.includes('MODIFIER') && <Button onClick={() => setAction('MODIFIER')}>Modifier</Button>}
            {(['PROLONGER', 'CONFIRMER_FIN', 'SUSPENDRE', 'REACTIVER', 'DEPART'] as const)
              .filter((a) => agent.actions.includes(a))
              .map((a) => (
                <Button key={a} variant={a === 'PROLONGER' ? 'solid' : 'outline'} className={a === 'DEPART' ? '!border-clay !text-clay' : ''} onClick={() => setAction(a)}>
                  {libelle(a)}
                </Button>
              ))}
          </div>
        )}

        <dl className="mb-5 grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          <dt className="text-text-muted">Unité</dt>
          <dd>{agent.unite ? `${agent.unite.code} — ${agent.unite.libelle}` : '—'}{agent.cheminUnite.length > 1 && <div className="text-[11.5px] text-text-faint">{agent.cheminUnite.join(' › ')}</div>}</dd>
          <dt className="text-text-muted">Fonction</dt>
          <dd>{agent.fonction ?? '—'}</dd>
          <dt className="text-text-muted">Genre</dt>
          <dd>{agent.genre === 'F' ? 'Femme' : agent.genre === 'M' ? 'Homme' : '—'}</dd>
          <dt className="text-text-muted">Compte</dt>
          <dd>{agent.compte ? `${agent.compte.email} (${agent.compte.status === 'SUPPRIME' ? 'désactivé' : agent.compte.status.toLowerCase().replace('_', ' ')})` : 'Aucun compte'}</dd>
        </dl>

        <h3 className="mb-2 text-[14px] font-bold">Historique</h3>
        <ul className="space-y-1.5">
          {agent.mouvements.map((m) => (
            <li key={m.id} className="rounded-md border border-line px-3 py-2 text-[12.5px]">
              <span className="font-semibold">{LIBELLE_MOUVEMENT[m.type] ?? m.type}</span> — {date(m.dateEffet)}
              <span className="text-text-muted"> · {m.auteur ? `${m.auteur.firstName} ${m.auteur.lastName}` : 'Système'}</span>
              {m.motif && <div className="text-text-muted">{m.motif}</div>}
            </li>
          ))}
        </ul>
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
