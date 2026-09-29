'use client';

import { useEffect, useState } from 'react';
import { listerAgentsSansCompte } from '../../lib/api/socle';
import type { AgentSansCompte } from '../../lib/socle/types';
import { Field } from '../ui/Input';
import { Choix } from '../ui/Fenetre';

export type SelectionAgent = { agentId?: string; matricule?: string };

/**
 * « Aucun compte sans agent » (socle NIMBA, §4) : à la création d'un compte ou à
 * l'approbation d'une inscription, l'administrateur rattache le compte à un
 * agent existant sans compte (dossier tenu par les RH), ou crée l'agent (matricule
 * saisi, sinon provisoire, remplacé ensuite par le DRH).
 */
export function ChoixAgent({ onChange, onAgentChoisi }: { onChange: (s: SelectionAgent) => void; onAgentChoisi?: (a: AgentSansCompte) => void }) {
  const [agents, setAgents] = useState<AgentSansCompte[]>([]);
  const [agentId, setAgentId] = useState('');
  const [matricule, setMatricule] = useState('');
  useEffect(() => {
    listerAgentsSansCompte().then(setAgents).catch(() => setAgents([]));
  }, []);
  useEffect(() => {
    onChange(agentId ? { agentId } : matricule.trim() ? { matricule: matricule.trim() } : {});
  }, [agentId, matricule, onChange]);
  return (
    <div className="mb-2 rounded-md border border-line bg-bg px-3.5 pt-3">
      <Choix
        label="Agent (dossier RH)"
        value={agentId}
        onChange={(v) => {
          setAgentId(v);
          const a = agents.find((x) => x.id === v);
          if (a) onAgentChoisi?.(a);
        }}
        vide="Nouvel agent, créé avec ce compte"
        options={agents.map((a) => ({ value: a.id, label: `${a.prenoms} ${a.nom} — ${a.matricule}${a.unite ? ` (${a.unite.code})` : ''}` }))}
      />
      {!agentId && (
        <>
          <Field label="Matricule du nouvel agent (facultatif)" value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="Sinon un matricule provisoire est attribué" />
        </>
      )}
    </div>
  );
}
