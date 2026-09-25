'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccesDelegues, getDelegatairesPossibles, ouvrirAcces, revoquerAcces, type CibleCourrier } from '../../lib/api/courrier';
import type { AccesDelegue, Delegataire } from '../../lib/courrier/types';
import { formatDate } from '../../lib/courrier/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { Button } from '../ui/Button';
import { Erreur, Fenetre, Libelle, SELECT_CLASS, TEXTAREA_CLASS, messageErreur } from './ui';

/** Motif obligatoire (annulation, renvoi) — même règle que MotifDto (≥ 5 caractères). */
export function FenetreMotif({
  titre,
  explication,
  valider,
  onClose,
  onValider,
}: {
  titre: string;
  explication: string;
  valider: string;
  onClose: () => void;
  onValider: (motif: string) => Promise<unknown>;
}) {
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <Fenetre
      titre={titre}
      sousTitre={explication}
      valider={valider}
      danger
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await onValider(motif.trim());
          onClose();
        } catch (e) {
          setErreur(messageErreur(e, 'Action impossible'));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <Erreur message={erreur} />
      <Libelle htmlFor="motif">Motif (obligatoire)</Libelle>
      <textarea id="motif" className={`${TEXTAREA_CLASS} mb-4`} value={motif} onChange={(e) => setMotif(e.target.value)} required minLength={5} maxLength={1000} />
    </Fenetre>
  );
}

/** Ajout de fichiers (scans d'une arrivée, annexes d'un acte). */
export function FenetreFichiers({
  titre,
  explication,
  onClose,
  onValider,
}: {
  titre: string;
  explication: string;
  onClose: () => void;
  onValider: (fichiers: File[]) => Promise<unknown>;
}) {
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <Fenetre
      titre={titre}
      sousTitre={explication}
      valider="Ajouter"
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        if (fichiers.length === 0) return setErreur('Choisissez au moins un fichier.');
        setEnCours(true);
        setErreur(null);
        try {
          await onValider(fichiers);
          onClose();
        } catch (e) {
          setErreur(messageErreur(e, 'Envoi impossible'));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <Erreur message={erreur} />
      <Libelle htmlFor="fichiers">Fichiers (10 au plus, 25 Mo chacun)</Libelle>
      <input id="fichiers" type="file" multiple className="mb-4 w-full text-[13px]" onChange={(e) => setFichiers(Array.from(e.target.files ?? []))} />
    </Fenetre>
  );
}

const TYPE_LABEL = { ASSISTANT: 'votre assistant(e)', SUPPLEANT: 'votre suppléant(e)' } as const;

/**
 * Accès délégués à un courrier confidentiel : ceux que la personne a ouverts
 * (révocables), et l'ouverture d'un nouvel accès. Les bénéficiaires proposés
 * viennent de GET /courrier/delegataires-possibles — exactement ceux que le
 * serveur accepterait.
 */
export function AccesDelegues({ type, id }: { type: 'arrivee' | 'acte'; id: string }) {
  const [acces, setAcces] = useState<AccesDelegue[] | null>(null);
  const [ouvrir, setOuvrir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const cible: CibleCourrier = type === 'arrivee' ? { arriveeId: id } : { acteId: id };

  const charger = useCallback(() => {
    getAccesDelegues(type === 'arrivee' ? { arriveeId: id } : { acteId: id })
      .then(setAcces)
      .catch((e) => setErreur(messageErreur(e, 'Impossible de charger les accès délégués')));
  }, [type, id]);
  useEffect(() => charger(), [charger]);

  async function revoquer(a: AccesDelegue) {
    if (!window.confirm(`Révoquer l’accès de ${a.beneficiaire.firstName} ${a.beneficiaire.lastName} ?`)) return;
    try {
      await revoquerAcces(a.id);
      charger();
    } catch (e) {
      setErreur(messageErreur(e, 'Révocation impossible'));
    }
  }

  const actifs = acces?.filter((a) => !a.revoqueAt) ?? [];
  return (
    <section className="mb-6" data-testid="acces-delegues">
      <h3 className="mb-1 text-[13px] font-bold uppercase tracking-wide text-text-faint">Accès délégués</h3>
      <p className="mb-2.5 text-[12px] text-text-muted">
        Ce courrier est confidentiel : ni votre assistant(e) ni votre suppléant(e) ne le voient sans un accès que vous ouvrez ici.
      </p>
      <Erreur message={erreur} />
      {actifs.length > 0 && (
        <ul className="mb-2.5 space-y-1.5">
          {actifs.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-md bg-bg px-3 py-2 text-[12.5px]">
              <span className="font-semibold">
                {a.beneficiaire.firstName} {a.beneficiaire.lastName}
              </span>
              <span className="text-text-muted">
                {a.type === 'ASSISTANT' ? 'assistant(e)' : 'suppléant(e)'} · depuis le {formatDate(a.createdAt)}
              </span>
              <button type="button" onClick={() => revoquer(a)} className="ml-auto text-[12px] font-semibold text-clay hover:underline">
                Révoquer
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" onClick={() => setOuvrir(true)}>
        Ouvrir un accès
      </Button>
      {ouvrir && (
        <FenetreOuvrirAcces
          cible={cible}
          onClose={() => setOuvrir(false)}
          onOuvert={() => {
            setOuvrir(false);
            charger();
          }}
        />
      )}
    </section>
  );
}

function FenetreOuvrirAcces({ cible, onClose, onOuvert }: { cible: CibleCourrier; onClose: () => void; onOuvert: () => void }) {
  const [possibles, setPossibles] = useState<Delegataire[] | null>(null);
  const [choix, setChoix] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Chargé une fois à l'ouverture de la fenêtre (la cible ne change pas pendant).
  const [cibleInitiale] = useState(cible);
  useEffect(() => {
    getDelegatairesPossibles(cibleInitiale)
      .then(setPossibles)
      .catch((e) => setErreur(messageErreur(e, 'Impossible de charger les bénéficiaires possibles')));
  }, [cibleInitiale]);
  return (
    <Fenetre
      titre="Ouvrir un accès"
      sousTitre="Seuls votre assistant(e) et votre suppléant(e) en cours peuvent recevoir un accès. Il cesse de lui-même à la fin de la suppléance."
      valider="Ouvrir l’accès"
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        if (!choix) return setErreur('Choisissez la personne.');
        setEnCours(true);
        setErreur(null);
        try {
          await ouvrirAcces(cible, choix);
          onOuvert();
        } catch (e) {
          setErreur(messageErreur(e, 'Ouverture impossible'));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <Erreur message={erreur} />
      <Libelle htmlFor="beneficiaire">Bénéficiaire</Libelle>
      <select id="beneficiaire" className={`${SELECT_CLASS} mb-4`} value={choix} onChange={(e) => setChoix(e.target.value)} disabled={!possibles}>
        <option value="">{possibles === null ? 'Chargement…' : possibles.length === 0 ? 'Personne à qui ouvrir un accès' : 'Choisir…'}</option>
        {possibles?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.firstName} {p.lastName} — {TYPE_LABEL[p.type]} ({ROLE_LABEL[p.role]})
          </option>
        ))}
      </select>
    </Fenetre>
  );
}
