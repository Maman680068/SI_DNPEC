'use client';

import { useEffect, useState } from 'react';
import { ajouterPiecesActe, creerActe, expedierActe, modifierActe, signerActe, viserActe, type ActeInput } from '../../lib/api/courrier';
import { getDirectory } from '../../lib/api/org';
import type { DirectoryUser } from '../../lib/org/types';
import type { Acte, Registre } from '../../lib/courrier/types';
import { Case, ChoixSegment, FenetreFormulaire, Grille2, Liste, Saisie, SelecteurPersonnes, ZoneDepot, ZoneTexte } from '../ui/Formulaire';
import { useToast } from '../ui/Toast';
import { useEnvoi, versPersonne } from './formulaire';
import { MentionInterim } from './ui';

type Confidentialite = 'ORDINAIRE' | 'CONFIDENTIEL';

/**
 * Rédaction (ou modification) d'un départ / d'un acte. Pas de numéro : il est
 * attribué à la signature. « En réponse à » est prérempli depuis la fiche du
 * courrier arrivée. Les annexes sont jointes au brouillon.
 */
export function FenetreRediger({
  registres,
  acte,
  repondA,
  onClose,
  onEnregistre,
}: {
  registres: Registre[];
  /** Modification d'un brouillon (ou d'un acte renvoyé). */
  acte?: Acte;
  /** Réponse à un courrier arrivée. */
  repondA?: { id: string; numero: string };
  onClose: () => void;
  onEnregistre: (a: Acte) => void;
}) {
  const toast = useToast();
  const choix = registres.filter((r) => r.nature !== 'ARRIVEE' && r.isActive);
  const [annuaire, setAnnuaire] = useState<DirectoryUser[]>([]);
  const [v, setV] = useState({
    registreId: acte?.registreId ?? choix.find((r) => r.nature === 'DEPART')?.id ?? choix[0]?.id ?? '',
    objet: acte?.objet ?? '',
    destinataires: acte?.destinataires ?? '',
    corps: acte?.corps ?? '',
    confidentialite: (acte?.confidentialite === 'CONFIDENTIEL' ? 'CONFIDENTIEL' : 'ORDINAIRE') as Confidentialite,
    beneficiaireId: acte?.beneficiaireId ?? '',
    priseConnaissanceRequise: acte?.priseConnaissanceRequise ?? false,
  });
  const [annexes, setAnnexes] = useState<File[]>([]);
  const { enCours, erreur, envoyer } = useEnvoi();
  useEffect(() => {
    getDirectory()
      .then(setAnnuaire)
      .catch(() => setAnnuaire([]));
  }, []);
  const repondAId = acte?.repondAId ?? repondA?.id;

  return (
    <FenetreFormulaire
      titre={acte ? 'Modifier l’acte' : repondA ? 'Rédiger une réponse' : 'Rédiger un départ ou un acte'}
      sousTitre={
        <>
          {repondA && <span className="mb-0.5 block font-semibold text-ink">En réponse au courrier {repondA.numero}.</span>}
          Le numéro est attribué à la signature.
        </>
      }
      libelleValider={acte ? 'Enregistrer' : 'Enregistrer le brouillon'}
      testid="fenetre-rediger"
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Le brouillon reste visible de vous seul jusqu’à sa soumission au circuit de visa."
      valider={() => ({
        ...(v.objet.trim().length === 1 ? { 'a-objet': 'Indiquez au moins 2 caractères.' } : {}),
        ...(v.priseConnaissanceRequise && !v.beneficiaireId ? { 'a-beneficiaire': 'Choisissez l’agent concerné : la prise de connaissance l’exige.' } : {}),
      })}
      onSubmit={async () => {
        const input: ActeInput = {
          registreId: v.registreId,
          objet: v.objet.trim(),
          destinataires: v.destinataires.trim() || undefined,
          corps: v.corps.trim() || undefined,
          confidentialite: v.confidentialite,
          beneficiaireId: v.beneficiaireId || undefined,
          priseConnaissanceRequise: v.priseConnaissanceRequise,
          repondAId: acte ? undefined : repondAId,
        };
        const r = await envoyer(async () => {
          let resultat = acte ? await modifierActe(acte.id, input) : await creerActe(input);
          if (annexes.length > 0) resultat = await ajouterPiecesActe(resultat.id, annexes);
          return resultat;
        });
        if (!r.ok) return;
        toast.succes(acte ? 'Acte enregistré' : 'Brouillon enregistré', { detail: acte ? undefined : 'Soumettez-le au circuit de visa quand il est prêt.' });
        onEnregistre(r.valeur);
      }}
    >
      <Grille2>
        <Liste
          id="a-registre"
          label="Registre"
          value={v.registreId}
          onChange={(registreId) => setV({ ...v, registreId })}
          options={choix.map((r) => ({ value: r.id, label: `${r.code} — ${r.libelle}` }))}
          vide={choix.length === 0 ? 'Aucun registre de départ ou d’actes actif' : undefined}
          required
          messageObligatoire="Choisissez le registre."
        />
        <ChoixSegment<Confidentialite>
          id="a-confidentialite"
          label="Confidentialité"
          value={v.confidentialite}
          onChange={(confidentialite) => setV({ ...v, confidentialite })}
          options={[
            { value: 'ORDINAIRE', label: 'Ordinaire' },
            { value: 'CONFIDENTIEL', label: 'Confidentiel' },
          ]}
        />
      </Grille2>
      <ZoneTexte id="a-objet" label="Objet" value={v.objet} onChange={(objet) => setV({ ...v, objet })} required maxLength={500} lignes={2} messageObligatoire="Indiquez l’objet de l’acte." />
      <Saisie id="a-destinataires" label="Destinataires" facultatif value={v.destinataires} onChange={(destinataires) => setV({ ...v, destinataires })} maxLength={1000} />
      <ZoneTexte id="a-corps" label="Texte" facultatif value={v.corps} onChange={(corps) => setV({ ...v, corps })} maxLength={20000} lignes={6} />
      <SelecteurPersonnes
        id="a-beneficiaire"
        label="Agent concerné"
        facultatif
        aide="Attestation, ordre de mission… : l’acte apparaît aussi pour cet agent."
        options={annuaire.map((u) => versPersonne(u))}
        valeurs={v.beneficiaireId ? [v.beneficiaireId] : []}
        onChange={(ids) => setV({ ...v, beneficiaireId: ids[0] ?? '' })}
        multiple={false}
      />
      <Case
        id="a-prise-connaissance"
        label="L’agent concerné doit confirmer sa prise de connaissance une fois l’acte signé."
        checked={v.priseConnaissanceRequise}
        onChange={(priseConnaissanceRequise) => setV({ ...v, priseConnaissanceRequise })}
      />
      <ZoneDepot id="a-annexes" label="Annexes" facultatif multiple fichiers={annexes} onChange={setAnnexes} />
      <MentionInterim />
    </FenetreFormulaire>
  );
}

export function FenetreViser({ acte, onClose, onFait }: { acte: Acte; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [commentaire, setCommentaire] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre="Viser l’acte"
      sousTitre={`« ${acte.objet} » passe à l’étape suivante du circuit.`}
      libelleValider="Viser"
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Le prochain intervenant du circuit est prévenu."
      onSubmit={async () => {
        const r = await envoyer(() => viserActe(acte.id, commentaire.trim()));
        if (!r.ok) return;
        toast.succes('Acte visé', { detail: 'Il passe à l’étape suivante du circuit.' });
        onFait();
      }}
    >
      <ZoneTexte id="v-commentaire" label="Commentaire" facultatif value={commentaire} onChange={setCommentaire} maxLength={2000} />
      <MentionInterim />
    </FenetreFormulaire>
  );
}

export function FenetreSigner({ acte, onClose, onFait }: { acte: Acte; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [scan, setScan] = useState<File[]>([]);
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre="Signer l’acte"
      sousTitre={`La signature attribue le numéro définitif du registre ${acte.registre.code} ; il ne pourra plus changer.`}
      libelleValider="Signer"
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Le secrétariat du registre est prévenu pour l’expédition."
      onSubmit={async () => {
        const r = await envoyer(() => signerActe(acte.id, scan[0] ?? null));
        if (!r.ok) return;
        toast.succes('Acte signé', { detail: r.valeur.numero ? `Numéro ${r.valeur.numero} attribué.` : undefined });
        onFait();
      }}
    >
      <ZoneDepot id="s-scan" label="Acte signé scanné" facultatif fichiers={scan} onChange={setScan} aide="PDF ou image · 25 Mo au plus" />
      <MentionInterim />
    </FenetreFormulaire>
  );
}

const MODES = ['Courrier physique', 'Porteur', 'Courriel', 'Valise', 'Remise en main propre'];
const AUTRE = '__autre__';

export function FenetreExpedier({ acte, onClose, onFait }: { acte: Acte; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [choix, setChoix] = useState(MODES[0]!);
  const [autre, setAutre] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  const mode = choix === AUTRE ? autre.trim() : choix;
  return (
    <FenetreFormulaire
      titre="Expédier"
      sousTitre={`Acte ${acte.numero ?? ''} — l’expédition est datée et tracée.`}
      libelleValider="Marquer expédié"
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      valider={() => (choix === AUTRE && autre.trim().length === 1 ? { 'e-autre': 'Indiquez au moins 2 caractères.' } : {})}
      onSubmit={async () => {
        const r = await envoyer(() => expedierActe(acte.id, mode));
        if (!r.ok) return;
        toast.succes('Acte expédié', { detail: `${acte.numero ? `${acte.numero} · ` : ''}${mode}.` });
        onFait();
      }}
    >
      <Liste id="e-mode" label="Mode d’expédition" value={choix} onChange={setChoix} options={[...MODES.map((m) => ({ value: m, label: m })), { value: AUTRE, label: 'Autre mode…' }]} required />
      {choix === AUTRE && <Saisie id="e-autre" label="Préciser le mode" value={autre} onChange={setAutre} required maxLength={200} messageObligatoire="Précisez le mode d’expédition." />}
      <MentionInterim />
    </FenetreFormulaire>
  );
}
