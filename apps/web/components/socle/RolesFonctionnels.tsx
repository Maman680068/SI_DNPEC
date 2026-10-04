'use client';

import { useCallback, useEffect, useState } from 'react';
import { attribuerRole, candidatsRoles, listerAttributions, retirerRole } from '../../lib/api/socle';
import type { Attribution, ListeAttributions } from '../../lib/socle/types';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { BTN_PRINCIPAL, Filtres } from '../ui/Charte';
import { Plus } from 'lucide-react';
import { ChampDate, FenetreFormulaire, Grille2, Liste, SelecteurPersonnes, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';

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
  const toast = useToast();

  const charger = useCallback(() => {
    listerAttributions(actives ? { actives: 'true' } : {})
      .then((l) => {
        setListe(l);
        setErreur(null);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, [actives]);
  useEffect(charger, [charger]);

  if (!liste) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  return (
    <div>
      <ErreurChargement message={erreur} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[640px] text-[13px] text-text-muted">
          Un rôle fonctionnel donne une capacité (DRH, Chef SAF, Validateur…) sans jamais élargir ce que la personne voit. Agent du courrier et gestionnaire logistique s’attribuent depuis Courrier et Logistique.
        </p>
        <div className="flex items-center gap-3">
          <Filtres actifs={actives ? 0 : 1} onEffacer={() => setActives(true)}>
            <label className="flex items-center gap-1.5 text-[13px] text-text-muted md:text-[12.5px]">
              <input type="checkbox" checked={actives} onChange={(e) => setActives(e.target.checked)} className="h-4 w-4 accent-ink" />
              Rôles en cours seulement
            </label>
          </Filtres>
          {liste.droits.peutAttribuer && (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setAttribuer(true)}>
              <Plus aria-hidden size={16} /> Attribuer un rôle
            </button>
          )}
        </div>
      </div>
      <div className="relative overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[680px] text-left text-[13px]">
          <thead className="border-b border-line bg-[#F7F8FB] text-[12px] font-semibold text-text-muted">
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
      {attribuer && (
        <FenetreAttribuer
          roles={liste.rolesAttribuables}
          onClose={() => setAttribuer(false)}
          onFait={(libelle, nom) => {
            setAttribuer(false);
            charger();
            toast.succes('Rôle attribué', { detail: `${libelle} — ${nom}.` });
          }}
        />
      )}
      {retrait && (
        <FenetreRetrait
          attribution={retrait}
          onClose={() => setRetrait(null)}
          onFait={() => {
            const a = retrait;
            setRetrait(null);
            charger();
            toast.succes('Rôle retiré', { detail: `${a.libelle} — ${a.user.firstName} ${a.user.lastName}. L’attribution reste dans l’historique.` });
          }}
        />
      )}
    </div>
  );
}

function FenetreAttribuer({ roles, onClose, onFait }: { roles: { role: string; libelle: string }[]; onClose: () => void; onFait: (libelle: string, nom: string) => void }) {
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
      const c = candidats.find((x) => x.id === userId);
      onFait(roles.find((r) => r.role === role)?.libelle ?? role, c ? `${c.firstName} ${c.lastName}` : '');
    } catch (e) {
      setErreur(messageErreur(e));
      setEnCours(false);
    }
  };
  return (
    <FenetreFormulaire
      titre="Attribuer un rôle fonctionnel"
      onClose={onClose}
      onSubmit={envoyer}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Attribuer le rôle"
      pied="Le rôle donne une capacité sans élargir ce que la personne voit ; l’attribution est datée et tracée."
      valider={() => (debut && fin && fin < debut ? { 'rf-fin': 'La fin ne peut pas précéder le début.' } : {})}
    >
      <SelecteurPersonnes
        id="rf-personne"
        label="Personne"
        multiple={false}
        required
        messageObligatoire="Choisissez la personne."
        options={candidats.map((c) => ({ id: c.id, nom: `${c.firstName} ${c.lastName}` }))}
        valeurs={userId ? [userId] : []}
        onChange={(ids) => setUserId(ids[0] ?? '')}
      />
      <Liste id="rf-role" label="Rôle" value={role} onChange={setRole} required options={roles.map((r) => ({ value: r.role, label: r.libelle }))} />
      <Grille2>
        <ChampDate id="rf-debut" label="Début" facultatif value={debut} onChange={setDebut} aide="Sinon, à partir d’aujourd’hui." />
        <ChampDate id="rf-fin" label="Fin" facultatif value={fin} onChange={setFin} />
      </Grille2>
      <ZoneTexte id="rf-motif" label="Motif" facultatif value={motif} onChange={setMotif} placeholder="Ex. note de service n°…" lignes={2} />
    </FenetreFormulaire>
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
      setErreur(messageErreur(e));
      setEnCours(false);
    }
  };
  return (
    <FenetreFormulaire
      titre={`Retirer « ${attribution.libelle} »`}
      sousTitre={`${attribution.user.firstName} ${attribution.user.lastName}`}
      onClose={onClose}
      onSubmit={envoyer}
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Retirer le rôle"
      danger
      pied="Le retrait prend effet immédiatement ; l’attribution reste dans l’historique."
    >
      <ZoneTexte id="rf-motif-retrait" label="Motif du retrait" value={motif} onChange={setMotif} required messageObligatoire="Indiquez le motif du retrait." />
    </FenetreFormulaire>
  );
}
