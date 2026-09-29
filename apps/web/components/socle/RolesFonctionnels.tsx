'use client';

import { useCallback, useEffect, useState } from 'react';
import { attribuerRole, candidatsRoles, listerAttributions, retirerRole } from '../../lib/api/socle';
import type { Attribution, ListeAttributions } from '../../lib/socle/types';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field } from '../ui/Input';
import { Choix, Fenetre, Texte } from '../ui/Fenetre';

const date = (d: string) => new Date(d).toLocaleDateString('fr-FR');

/**
 * Rôles fonctionnels (socle NIMBA, §5.2) : ce que chacun peut faire, en plus
 * du périmètre que lui donne sa position. Attribués et retirés par
 * l'administrateur, datés, cumulables, jamais supprimés. Agent du courrier et
 * gestionnaire logistique se gèrent depuis leur module (granularité propre).
 */
export function RolesFonctionnels() {
  const [liste, setListe] = useState<ListeAttributions | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [actives, setActives] = useState(true);
  const [attribuer, setAttribuer] = useState(false);
  const [retrait, setRetrait] = useState<Attribution | null>(null);

  const charger = useCallback(() => {
    listerAttributions(actives ? { actives: 'true' } : {})
      .then((l) => {
        setListe(l);
        setErreur(null);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, [actives]);
  useEffect(charger, [charger]);

  if (!liste) return <Chargement erreur={erreur} />;
  return (
    <div>
      <ErreurChargement message={erreur} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[640px] text-[13px] text-text-muted">
          Un rôle fonctionnel donne une capacité (DRH, Chef SAF, Validateur…) sans jamais élargir ce que la personne voit. Agent du courrier et gestionnaire logistique s’attribuent depuis Courrier et Logistique.
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12.5px] text-text-muted">
            <input type="checkbox" checked={actives} onChange={(e) => setActives(e.target.checked)} />
            Rôles en cours seulement
          </label>
          {liste.droits.peutAttribuer && (
            <Button variant="gold" onClick={() => setAttribuer(true)}>
              + Attribuer un rôle
            </Button>
          )}
        </div>
      </div>
      <div className="relative overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full min-w-[680px] text-left text-[13px]">
          <thead className="border-b border-line bg-bg text-[11.5px] uppercase tracking-wide text-text-faint">
            <tr>
              <th scope="col" className="px-3 py-2">Personne</th>
              <th scope="col" className="px-3 py-2">Rôle</th>
              <th scope="col" className="px-3 py-2">Période</th>
              <th scope="col" className="px-3 py-2">Attribué par</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {liste.attributions.map((a) => (
              <tr key={a.id} data-testid="attribution" className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-semibold">{a.user.firstName} {a.user.lastName}</td>
                <td className="px-3 py-2">
                  {a.libelle}
                  {a.uniteKey && <span className="text-[11.5px] text-text-muted"> · {a.uniteKey}</span>}
                  {!a.active && <Badge tone="muted" className="ml-2">{a.retireLe ? 'RETIRÉ' : 'HORS PÉRIODE'}</Badge>}
                </td>
                <td className="px-3 py-2 text-text-muted">
                  depuis le {date(a.dateDebut)}
                  {a.dateFin && <> jusqu’au {date(a.dateFin)}</>}
                  {a.retireLe && <> · retiré le {date(a.retireLe)}{a.motifRetrait ? ` (${a.motifRetrait})` : ''}</>}
                </td>
                <td className="px-3 py-2 text-text-muted">{a.attribuePar ? `${a.attribuePar.firstName} ${a.attribuePar.lastName}` : 'Reprise'}</td>
                <td className="px-3 py-2 text-right">
                  {a.peutRetirer && (
                    <Button className="!px-2.5 !py-1 !text-[12px]" onClick={() => setRetrait(a)}>
                      Retirer
                    </Button>
                  )}
                  {a.gereeParModule && a.active && <span className="text-[11.5px] text-text-faint">géré dans son module</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {attribuer && <FenetreAttribuer roles={liste.rolesAttribuables} onClose={() => setAttribuer(false)} onFait={() => { setAttribuer(false); charger(); }} />}
      {retrait && <FenetreRetrait attribution={retrait} onClose={() => setRetrait(null)} onFait={() => { setRetrait(null); charger(); }} />}
    </div>
  );
}

function FenetreAttribuer({ roles, onClose, onFait }: { roles: { role: string; libelle: string }[]; onClose: () => void; onFait: () => void }) {
  const [candidats, setCandidats] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState(roles[0]?.role ?? '');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    candidatsRoles().then(setCandidats).catch((e) => setErreur(messageChargement(e)));
  }, []);
  const envoyer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await attribuerRole({ userId, role, ...(debut ? { dateDebut: debut } : {}), ...(fin ? { dateFin: fin } : {}), ...(motif.trim() ? { motif: motif.trim() } : {}) });
      onFait();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue');
      setEnCours(false);
    }
  };
  return (
    <Fenetre titre="Attribuer un rôle fonctionnel" onClose={onClose} onSubmit={envoyer} enCours={enCours} erreur={erreur} libelleValider="Attribuer">
      <Choix label="Personne" value={userId} onChange={setUserId} required vide="Choisir…" options={candidats.map((c) => ({ value: c.id, label: `${c.lastName} ${c.firstName}` }))} />
      <Choix label="Rôle" value={role} onChange={setRole} required options={roles.map((r) => ({ value: r.role, label: r.libelle }))} />
      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <Field label="Début (facultatif)" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
        <Field label="Fin (facultative)" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
      </div>
      <Texte label="Motif (facultatif)" value={motif} onChange={setMotif} placeholder="Ex. note de service n°…" />
    </Fenetre>
  );
}

function FenetreRetrait({ attribution, onClose, onFait }: { attribution: Attribution; onClose: () => void; onFait: () => void }) {
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const envoyer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await retirerRole(attribution.id, motif.trim());
      onFait();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue');
      setEnCours(false);
    }
  };
  return (
    <Fenetre titre={`Retirer « ${attribution.libelle} » à ${attribution.user.firstName} ${attribution.user.lastName}`} onClose={onClose} onSubmit={envoyer} enCours={enCours} erreur={erreur} libelleValider="Retirer le rôle" danger>
      <p className="mb-4 text-[13px] text-text-muted">Le retrait prend effet immédiatement ; l’attribution reste dans l’historique.</p>
      <Texte label="Motif du retrait" value={motif} onChange={setMotif} required />
    </Fenetre>
  );
}
