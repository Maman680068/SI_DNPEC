'use client';

import { useEffect, useState } from 'react';
import { listerAgentsSansCompte } from '../../lib/api/socle';
import type { AgentSansCompte } from '../../lib/socle/types';
import { Saisie, SelecteurPersonnes } from '../ui/Formulaire';

export type SelectionAgent = { agentId?: string; matricule?: string };

/**
 * « Aucun compte sans agent » (socle NIMBA, §4) : à la création d'un compte ou à
 * l'approbation d'une inscription, l'administrateur rattache le compte à un
 * agent existant sans compte (dossier tenu par les RH), ou crée l'agent (matricule
 * saisi, sinon provisoire, remplacé ensuite par le DRH).
 */
export function ChoixAgent({ onChange, onAgentChoisi, agentInitial }: { onChange: (s: SelectionAgent) => void; onAgentChoisi?: (a: AgentSansCompte) => void; agentInitial?: string }) {
  const [agents, setAgents] = useState<AgentSansCompte[]>([]);
  const [agentId, setAgentId] = useState(agentInitial ?? '');
  const [matricule, setMatricule] = useState('');
  useEffect(() => {
    listerAgentsSansCompte()
      .then((l) => {
        setAgents(l);
        // « Ouvrir un compte » depuis un agent sans compte : nom et prénom repris de son dossier.
        const a = agentInitial ? l.find((x) => x.id === agentInitial) : undefined;
        if (a) onAgentChoisi?.(a);
        else if (agentInitial) setAgentId('');
      })
      .catch(() => setAgents([]));
  }, []);
  useEffect(() => {
    onChange(agentId ? { agentId } : matricule.trim() ? { matricule: matricule.trim() } : {});
  }, [agentId, matricule, onChange]);
  return (
    <div className="mb-3.5 rounded-[10px] border border-line bg-bg px-3.5 pt-3">
      <SelecteurPersonnes
        id="agent-dossier"
        label="Agent (dossier RH)"
        facultatif
        multiple={false}
        placeholder="Rechercher un agent sans compte…"
        aide={agentId ? undefined : 'Aucun agent choisi : un nouvel agent est créé avec ce compte.'}
        options={agents.map((a) => ({ id: a.id, nom: `${a.prenoms} ${a.nom}`, detail: `${a.matricule}${a.unite ? ` · ${a.unite.code}` : ''}` }))}
        valeurs={agentId ? [agentId] : []}
        onChange={(ids) => {
          const v = ids[0] ?? '';
          setAgentId(v);
          const a = agents.find((x) => x.id === v);
          if (a) onAgentChoisi?.(a);
        }}
      />
      {!agentId && (
        <Saisie id="agent-matricule" label="Matricule du nouvel agent" facultatif value={matricule} onChange={setMatricule} placeholder="Sinon un matricule provisoire est attribué" />
      )}
    </div>
  );
}
