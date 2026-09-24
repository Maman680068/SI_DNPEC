'use client';

import { useEffect, useState } from 'react';
import { ajouterPiecesActe, creerActe, expedierActe, modifierActe, signerActe, viserActe, type ActeInput } from '../../lib/api/courrier';
import { getDirectory } from '../../lib/api/org';
import type { DirectoryUser } from '../../lib/org/types';
import type { Acte, Registre } from '../../lib/courrier/types';
import { Field } from '../ui/Input';
import { Erreur, Fenetre, Libelle, SELECT_CLASS, TEXTAREA_CLASS, messageErreur } from './ui';

function useEnvoi() {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function envoyer(action: () => Promise<unknown>, defaut: string): Promise<boolean> {
    setEnCours(true);
    setErreur(null);
    try {
      await action();
      return true;
    } catch (e) {
      setErreur(messageErreur(e, defaut));
      return false;
    } finally {
      setEnCours(false);
    }
  }
  return { enCours, erreur, setErreur, envoyer };
}

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
  const choix = registres.filter((r) => r.nature !== 'ARRIVEE' && r.isActive);
  const [annuaire, setAnnuaire] = useState<DirectoryUser[]>([]);
  const [v, setV] = useState({
    registreId: acte?.registreId ?? choix.find((r) => r.nature === 'DEPART')?.id ?? choix[0]?.id ?? '',
    objet: acte?.objet ?? '',
    destinataires: acte?.destinataires ?? '',
    corps: acte?.corps ?? '',
    confidentialite: (acte?.confidentialite === 'CONFIDENTIEL' ? 'CONFIDENTIEL' : 'ORDINAIRE') as 'ORDINAIRE' | 'CONFIDENTIEL',
    beneficiaireId: acte?.beneficiaireId ?? '',
    priseConnaissanceRequise: acte?.priseConnaissanceRequise ?? false,
  });
  const [annexes, setAnnexes] = useState<File[]>([]);
  const { enCours, erreur, setErreur, envoyer } = useEnvoi();
  useEffect(() => {
    getDirectory()
      .then(setAnnuaire)
      .catch(() => setAnnuaire([]));
  }, []);
  const repondAId = acte?.repondAId ?? repondA?.id;

  return (
    <Fenetre
      titre={acte ? 'Modifier l’acte' : repondA ? 'Rédiger une réponse' : 'Rédiger un départ ou un acte'}
      sousTitre={
        <>
          {repondA && (
            <span className="mb-1 block font-semibold text-ink">En réponse au courrier {repondA.numero}.</span>
          )}
          Le numéro est attribué à la signature. Après rédaction, soumettez l’acte au circuit de visa.
        </>
      }
      valider={acte ? 'Enregistrer' : 'Enregistrer le brouillon'}
      large
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        if (v.priseConnaissanceRequise && !v.beneficiaireId) return setErreur('La prise de connaissance exige un bénéficiaire.');
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
        let resultat: Acte | null = null;
        const ok = await envoyer(async () => {
          resultat = acte ? await modifierActe(acte.id, input) : await creerActe(input);
          if (annexes.length > 0) resultat = await ajouterPiecesActe(resultat.id, annexes);
        }, 'Enregistrement impossible');
        if (ok && resultat) onEnregistre(resultat);
      }}
    >
      <Erreur message={erreur} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <div className="mb-4">
          <Libelle htmlFor="a-registre">Registre</Libelle>
          <select id="a-registre" className={SELECT_CLASS} value={v.registreId} onChange={(e) => setV({ ...v, registreId: e.target.value })} required>
            {choix.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.libelle}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <Libelle htmlFor="a-confidentialite">Confidentialité</Libelle>
          <select id="a-confidentialite" className={SELECT_CLASS} value={v.confidentialite} onChange={(e) => setV({ ...v, confidentialite: e.target.value as 'ORDINAIRE' | 'CONFIDENTIEL' })}>
            <option value="ORDINAIRE">Ordinaire</option>
            <option value="CONFIDENTIEL">Confidentiel</option>
          </select>
        </div>
      </div>
      <div className="mb-4">
        <Libelle htmlFor="a-objet">Objet</Libelle>
        <textarea id="a-objet" className={`${TEXTAREA_CLASS} !min-h-[60px]`} value={v.objet} onChange={(e) => setV({ ...v, objet: e.target.value })} required minLength={2} maxLength={500} />
      </div>
      <Field label="Destinataires (facultatif)" id="a-destinataires" value={v.destinataires} onChange={(e) => setV({ ...v, destinataires: e.target.value })} maxLength={1000} />
      <div className="mb-4">
        <Libelle htmlFor="a-corps">Texte (facultatif)</Libelle>
        <textarea id="a-corps" className={`${TEXTAREA_CLASS} !min-h-[140px]`} value={v.corps} onChange={(e) => setV({ ...v, corps: e.target.value })} maxLength={20000} />
      </div>
      <div className="mb-3">
        <Libelle htmlFor="a-beneficiaire">Agent concerné (facultatif — attestation, ordre de mission…)</Libelle>
        <select id="a-beneficiaire" className={SELECT_CLASS} value={v.beneficiaireId} onChange={(e) => setV({ ...v, beneficiaireId: e.target.value })}>
          <option value="">Aucun</option>
          {annuaire.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
              {u.jobTitle ? ` — ${u.jobTitle}` : ''}
            </option>
          ))}
        </select>
      </div>
      <label className="mb-4 flex items-start gap-2 text-[12.5px]">
        <input type="checkbox" checked={v.priseConnaissanceRequise} onChange={(e) => setV({ ...v, priseConnaissanceRequise: e.target.checked })} className="mt-0.5" />
        L’agent concerné doit confirmer sa prise de connaissance une fois l’acte signé.
      </label>
      <div className="mb-4">
        <Libelle htmlFor="a-annexes">Annexes (facultatif)</Libelle>
        <input id="a-annexes" type="file" multiple className="w-full text-[13px]" onChange={(e) => setAnnexes(Array.from(e.target.files ?? []))} />
      </div>
    </Fenetre>
  );
}

export function FenetreViser({ acte, onClose, onFait }: { acte: Acte; onClose: () => void; onFait: () => void }) {
  const [commentaire, setCommentaire] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <Fenetre
      titre="Viser l’acte"
      sousTitre={`« ${acte.objet} » passe à l’étape suivante du circuit.`}
      valider="Viser"
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        if (await envoyer(() => viserActe(acte.id, commentaire.trim()), 'Visa impossible')) onFait();
      }}
    >
      <Erreur message={erreur} />
      <Libelle htmlFor="v-commentaire">Commentaire (facultatif)</Libelle>
      <textarea id="v-commentaire" className={`${TEXTAREA_CLASS} mb-4`} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} maxLength={2000} />
    </Fenetre>
  );
}

export function FenetreSigner({ acte, onClose, onFait }: { acte: Acte; onClose: () => void; onFait: () => void }) {
  const [scan, setScan] = useState<File | null>(null);
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <Fenetre
      titre="Signer l’acte"
      sousTitre={`La signature attribue le numéro définitif du registre ${acte.registre.code} ; il ne pourra plus changer.`}
      valider="Signer"
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        if (await envoyer(() => signerActe(acte.id, scan), 'Signature impossible')) onFait();
      }}
    >
      <Erreur message={erreur} />
      <Libelle htmlFor="s-scan">Acte signé scanné (facultatif)</Libelle>
      <input id="s-scan" type="file" className="mb-4 w-full text-[13px]" onChange={(e) => setScan(e.target.files?.[0] ?? null)} />
    </Fenetre>
  );
}

const MODES = ['Courrier physique', 'Porteur', 'Courriel', 'Valise', 'Remise en main propre'];

export function FenetreExpedier({ acte, onClose, onFait }: { acte: Acte; onClose: () => void; onFait: () => void }) {
  const [mode, setMode] = useState(MODES[0]!);
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <Fenetre
      titre="Expédier"
      sousTitre={`Acte ${acte.numero ?? ''} — l’expédition est datée et tracée.`}
      valider="Marquer expédié"
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        if (await envoyer(() => expedierActe(acte.id, mode.trim()), 'Expédition impossible')) onFait();
      }}
    >
      <Erreur message={erreur} />
      <Field label="Mode d’expédition" id="e-mode" list="modes-expedition" value={mode} onChange={(e) => setMode(e.target.value)} required minLength={2} maxLength={200} />
      <datalist id="modes-expedition">
        {MODES.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </Fenetre>
  );
}
