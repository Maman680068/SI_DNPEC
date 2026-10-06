'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { attribuerRole, getPersonnesDesignables } from '../../lib/api/modelisation';
import type { Controle, DerogationVue, FicheModele, PersonneDesignable } from '../../lib/modelisation/types';
import { CleValeur } from '../ui/Charte';
import { FenetreFormulaire, SelecteurPersonnes, ZoneTexte } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';

const MOTIF_MIN = 5;
const validerMotif = (motif: string) => ({ motif: motif.trim().length < MOTIF_MIN ? `Écrivez le motif (${MOTIF_MIN} caractères au moins).` : null });

/** Fenêtre à motif écrit obligatoire : refus d'une version, abandon d'un dépôt, demande de dérogation. */
export function FenetreMotif({
  titre,
  sousTitre,
  libelle,
  libelleValider,
  pied,
  danger,
  avant,
  onClose,
  onValider,
  testid,
}: {
  titre: string;
  sousTitre?: ReactNode;
  libelle: string;
  libelleValider: string;
  pied?: ReactNode;
  danger?: boolean;
  avant?: ReactNode;
  onClose: () => void;
  onValider: (motif: string) => Promise<void>;
  testid?: string;
}) {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  return (
    <FenetreFormulaire
      titre={titre}
      sousTitre={sousTitre}
      largeur={560}
      onClose={onClose}
      testid={testid}
      libelleValider={libelleValider}
      danger={danger}
      enCours={enCours}
      erreur={erreur}
      pied={pied}
      valider={() => validerMotif(motif)}
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await onValider(motif.trim());
        } catch (e) {
          setErreur(messageErreur(e));
          setEnCours(false);
        }
      }}
    >
      {avant}
      <ZoneTexte id="motif" label={libelle} value={motif} onChange={setMotif} required lignes={4} maxLength={2000} messageObligatoire={`Écrivez le motif (${MOTIF_MIN} caractères au moins).`} />
    </FenetreFormulaire>
  );
}

/** Confirmation d'une dérogation par l'administrateur : il voit le contrôle et l'écart, jamais de résultat. */
export function FenetreConfirmationDerogation({ controle, derogation, onClose, onConfirmer }: { controle: Controle | undefined; derogation: DerogationVue; onClose: () => void; onConfirmer: () => Promise<void> }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  return (
    <FenetreFormulaire
      titre="Confirmer la dérogation"
      sousTitre="Dérogation à deux : demandée par le responsable du modèle, confirmée par l’administrateur"
      largeur={560}
      onClose={onClose}
      testid="fenetre-confirmation-derogation"
      libelleValider="Confirmer la dérogation"
      enCours={enCours}
      erreur={erreur}
      pied="La version gardera pour toujours la mention « activée avec dérogation »."
      onSubmit={async () => {
        setEnCours(true);
        try {
          await onConfirmer();
        } catch (e) {
          setErreur(messageErreur(e));
          setEnCours(false);
        }
      }}
    >
      <CleValeur
        largeur={150}
        lignes={[
          ['Contrôle', derogation.controle],
          ['Résultat', <span key="v" className="text-clay">{controle?.valeur ?? '—'}{controle?.seuil ? ` (seuil ${controle.seuil})` : ''}</span>],
          ['Demandée par', `${derogation.demandeePar ?? '—'}, le ${new Date(derogation.demandeeLe).toLocaleDateString('fr-FR')}`],
          ['Motif', derogation.motif],
        ]}
      />
    </FenetreFormulaire>
  );
}

/** Désignation du responsable ou du suppléant d'un modèle (administrateur, DN, DNA), motif obligatoire. */
export function FenetreDesignation({ modeleId, nomModele, role, actuel, onClose, onFait }: { modeleId: string; nomModele: string; role: 'RESPONSABLE' | 'SUPPLEANT'; actuel: string | null; onClose: () => void; onFait: () => void }) {
  const [personnes, setPersonnes] = useState<PersonneDesignable[]>([]);
  const [choix, setChoix] = useState<string[]>([]);
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    getPersonnesDesignables()
      .then(setPersonnes)
      .catch((e) => setErreur(messageErreur(e)));
  }, []);
  const libelle = role === 'RESPONSABLE' ? 'responsable' : 'suppléant';
  return (
    <FenetreFormulaire
      titre={`Désigner le ${libelle} du modèle`}
      sousTitre={nomModele}
      largeur={600}
      onClose={onClose}
      testid="fenetre-designation"
      libelleValider="Désigner"
      enCours={enCours}
      erreur={erreur}
      pied={actuel ? `${actuel} est aujourd’hui ${libelle} : sa désignation prendra fin (historique conservé).` : 'La personne désignée est prévenue ; l’historique des désignations est conservé.'}
      valider={() => ({ personne: choix.length ? null : 'Choisissez une personne.', ...validerMotif(motif) })}
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await attribuerRole({ userId: choix[0]!, role, modeleId, motif: motif.trim() });
          onFait();
        } catch (e) {
          setErreur(messageErreur(e));
          setEnCours(false);
        }
      }}
    >
      <SelecteurPersonnes id="personne" label={role === 'RESPONSABLE' ? 'Responsable du modèle' : 'Suppléant du responsable'} options={personnes.map((p) => ({ id: p.id, nom: p.nom, detail: p.fonction }))} valeurs={choix} onChange={setChoix} multiple={false} required />
      <ZoneTexte id="motif" label="Motif (décision, note de service…)" value={motif} onChange={setMotif} required lignes={3} maxLength={2000} />
    </FenetreFormulaire>
  );
}

/** Fiche du modèle (lecture) : description, fichiers, référence et points à confirmer lus dans modele.json. */
export function FenetreFicheModele({ fiche, onClose }: { fiche: FicheModele; onClose: () => void }) {
  const v = fiche.version;
  return (
    <FenetreFormulaire titre="Fiche du modèle" sousTitre={`${fiche.modele.nom} · ${fiche.modele.code}`} largeur={680} onClose={onClose} testid="fenetre-fiche-modele">
      {v?.lu.description && <p className="mb-4 text-[14px] leading-relaxed text-text">{v.lu.description}</p>}
      <CleValeur
        largeur={150}
        lignes={[
          ['Famille', fiche.modele.famille],
          ['Moteur', v?.lu.moteur ?? '—'],
          ['Base', fiche.donnees.base ?? '—'],
          ['Horizon', v?.lu.horizon ?? '—'],
          ['Référence', fiche.donnees.reference ? [fiche.donnees.reference.logiciel, fiche.donnees.reference.date].filter(Boolean).join(' · ') : '—'],
        ]}
      />
      {fiche.donnees.fichiers.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-[13px] font-bold text-ink-900">Fichiers du paquet</h3>
          <ul className="space-y-1 text-[13px]">
            {fiche.donnees.fichiers.map((f) => (
              <li key={f.chemin} className="flex flex-wrap gap-x-2">
                <span className="font-semibold text-ink-900">{f.chemin}</span>
                {f.role && <span className="text-text-muted">— {f.role}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {v && v.lu.aConfirmer.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-[13px] font-bold text-ink-900">Points à confirmer (indiqués par l’auteur du paquet)</h3>
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-text">
            {v.lu.aConfirmer.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      )}
    </FenetreFormulaire>
  );
}
