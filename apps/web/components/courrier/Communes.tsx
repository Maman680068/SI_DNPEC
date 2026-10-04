'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { getAccesDelegues, getDelegatairesPossibles, ouvrirAcces, revoquerAcces, type CibleCourrier } from '../../lib/api/courrier';
import type { AccesDelegue, Delegataire } from '../../lib/courrier/types';
import { formatDate } from '../../lib/courrier/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { BTN_SECONDAIRE } from '../ui/Charte';
import { FenetreFormulaire, SelecteurPersonnes, ZoneDepot, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';
import { SqueletteChamps, nomDe, useEnvoi, versPersonne } from './formulaire';
import { MentionInterim } from './ui';

/** Motif obligatoire (annulation, renvoi) — même règle que MotifDto (≥ 5 caractères). */
export function FenetreMotif({
  titre,
  explication,
  valider,
  succes,
  onClose,
  onValider,
}: {
  titre: string;
  explication: string;
  valider: string;
  /** Message de confirmation après l'action (« Acte renvoyé au rédacteur »…). */
  succes: { titre: string; detail?: string };
  onClose: () => void;
  onValider: (motif: string) => Promise<unknown>;
}) {
  const toast = useToast();
  const [motif, setMotif] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre={titre}
      sousTitre={explication}
      libelleValider={valider}
      danger
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Le motif est conservé et tracé."
      valider={() => (motif.trim() && motif.trim().length < 5 ? { motif: 'Le motif doit compter au moins 5 caractères.' } : {})}
      onSubmit={async () => {
        const r = await envoyer(() => onValider(motif.trim()));
        if (!r.ok) return;
        toast.succes(succes.titre, { detail: succes.detail });
        onClose();
      }}
    >
      <ZoneTexte id="motif" label="Motif" value={motif} onChange={setMotif} required maxLength={1000} lignes={3} messageObligatoire="Indiquez le motif." />
      <MentionInterim />
    </FenetreFormulaire>
  );
}

/** Ajout de fichiers (scans d'une arrivée, annexes d'un acte). */
export function FenetreFichiers({
  titre,
  explication,
  succes,
  onClose,
  onValider,
}: {
  titre: string;
  explication: string;
  succes: string;
  onClose: () => void;
  onValider: (fichiers: File[]) => Promise<unknown>;
}) {
  const toast = useToast();
  const [fichiers, setFichiers] = useState<File[]>([]);
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre={titre}
      sousTitre={explication}
      libelleValider="Ajouter"
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Le dépôt est daté et tracé dans l’historique."
      valider={() => (fichiers.length === 0 ? { fichiers: 'Choisissez au moins un fichier.' } : fichiers.length > 10 ? { fichiers: 'Dix fichiers au plus par envoi.' } : {})}
      onSubmit={async () => {
        const r = await envoyer(() => onValider(fichiers));
        if (!r.ok) return;
        toast.succes(succes, { detail: fichiers.length > 1 ? `${fichiers.length} fichiers ajoutés.` : fichiers[0]?.name });
        onClose();
      }}
    >
      <ZoneDepot id="fichiers" label="Fichiers" multiple fichiers={fichiers} onChange={setFichiers} aide="10 fichiers au plus · 25 Mo au plus par fichier" />
      <MentionInterim />
    </FenetreFormulaire>
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
  const toast = useToast();
  const [acces, setAcces] = useState<AccesDelegue[] | null>(null);
  const [ouvrir, setOuvrir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const cible: CibleCourrier = type === 'arrivee' ? { arriveeId: id } : { acteId: id };

  const charger = useCallback(() => {
    getAccesDelegues(type === 'arrivee' ? { arriveeId: id } : { acteId: id })
      .then(setAcces)
      .catch((e) => setErreur(messageErreur(e, 'Les accès délégués n’ont pas pu être lus.')));
  }, [type, id]);
  useEffect(() => charger(), [charger]);

  async function revoquer(a: AccesDelegue) {
    const nom = `${a.beneficiaire.firstName} ${a.beneficiaire.lastName}`;
    if (!window.confirm(`Révoquer l’accès de ${nom} ?`)) return;
    try {
      await revoquerAcces(a.id);
      toast.succes('Accès révoqué', { detail: `${nom} ne voit plus ce courrier.` });
      charger();
    } catch (e) {
      toast.erreur('Révocation impossible', messageErreur(e));
    }
  }

  const actifs = acces?.filter((a) => !a.revoqueAt) ?? [];
  return (
    <section className="mb-6" data-testid="acces-delegues">
      <h3 className="mb-1 text-[13px] font-bold text-ink-900">Accès délégués</h3>
      <p className="mb-2.5 text-[12px] text-text-muted">
        Ce courrier est confidentiel : ni votre assistant(e) ni votre suppléant(e) ne le voient sans un accès que vous ouvrez ici.
      </p>
      {erreur && <p className="mb-2 text-[12.5px] font-semibold text-clay">{erreur}</p>}
      {actifs.length > 0 && (
        <ul className="mb-2.5 space-y-1.5">
          {actifs.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-[9px] border border-line px-3 py-2 text-[12.5px]">
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
      <button type="button" className={`${BTN_SECONDAIRE} !h-9 !text-[13px]`} onClick={() => setOuvrir(true)}>
        <KeyRound aria-hidden size={15} />
        Ouvrir un accès
      </button>
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
  const toast = useToast();
  const [possibles, setPossibles] = useState<Delegataire[] | null>(null);
  const [choix, setChoix] = useState('');
  const { enCours, erreur, setErreur, envoyer } = useEnvoi();
  // Chargé une fois à l'ouverture de la fenêtre (la cible ne change pas pendant).
  const [cibleInitiale] = useState(cible);
  useEffect(() => {
    getDelegatairesPossibles(cibleInitiale)
      .then(setPossibles)
      .catch((e) => {
        setPossibles([]);
        setErreur(messageErreur(e, 'Les bénéficiaires possibles n’ont pas pu être lus.'));
      });
  }, [cibleInitiale, setErreur]);
  const personnes = (possibles ?? []).map((p) => versPersonne(p, `${TYPE_LABEL[p.type]} (${ROLE_LABEL[p.role]})`));
  return (
    <FenetreFormulaire
      titre="Ouvrir un accès"
      sousTitre="Seuls votre assistant(e) et votre suppléant(e) en cours peuvent recevoir un accès. Il cesse de lui-même à la fin de la suppléance."
      libelleValider="Ouvrir l’accès"
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Vous pouvez révoquer l’accès à tout moment."
      onSubmit={async () => {
        const r = await envoyer(() => ouvrirAcces(cible, choix));
        if (!r.ok) return;
        toast.succes('Accès ouvert', { detail: `${nomDe(personnes, choix)} peut consulter ce courrier.` });
        onOuvert();
      }}
    >
      {possibles === null ? (
        <SqueletteChamps champs={1} />
      ) : (
        <SelecteurPersonnes
          id="beneficiaire"
          label="Bénéficiaire"
          options={personnes}
          valeurs={choix ? [choix] : []}
          onChange={(ids) => setChoix(ids[0] ?? '')}
          multiple={false}
          required
          messageObligatoire="Choisissez la personne."
          placeholder={personnes.length === 0 ? 'Personne à qui ouvrir un accès' : 'Rechercher une personne…'}
        />
      )}
    </FenetreFormulaire>
  );
}
