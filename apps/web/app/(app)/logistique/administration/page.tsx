'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  accorderHabilitation,
  creerCategorie,
  getCandidatsGestionnaire,
  getHabilitations,
  getToutesCategories,
  modifierCategorie,
  revoquerHabilitation,
} from '../../../../lib/api/logistique';
import type { Categorie, Habilitation, NatureCategorie, Nom } from '../../../../lib/logistique/types';
import { ROLE_LABEL } from '../../../../lib/users/types';
import { ChevronLeft, Plus } from 'lucide-react';
import { Erreur, messageErreur } from '../../../../components/courrier/ui';
import { ErreurChargement, messageChargement } from '../../../../components/ui/ErreurChargement';
import { BTN_LIGNE, BTN_LIGNE_PRINCIPAL, BTN_PRINCIPAL, EnTetePage, EtatVide, LigneTableau, Panneau, Pastille } from '../../../../components/ui/Charte';
import { Info } from '../../../../components/logistique/commun';

const NATURE: Record<NatureCategorie, string> = { BIEN: 'Biens inventoriés', FOURNITURE: 'Fournitures' };
const GRILLE = 'lg:grid-cols-[90px_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.3fr)]';
const CHAMP = 'h-9 w-full rounded-[9px] border border-line bg-surface px-2.5 text-[13px]';

/** Administration de la logistique (administrateur système) : catégories et
 * réglage « validation du chef requise », habilitations de gestionnaire. */
export default function AdministrationLogistiquePage() {
  const [categories, setCategories] = useState<Categorie[] | null>(null);
  const [habilitations, setHabilitations] = useState<Habilitation[] | null>(null);
  const [candidats, setCandidats] = useState<(Nom & { role: string })[]>([]);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cat, setCat] = useState({ code: '', libelle: '', nature: 'BIEN' as NatureCategorie, validationChefRequise: true });
  const [candidat, setCandidat] = useState('');
  const [renommage, setRenommage] = useState<{ id: string; libelle: string } | null>(null);

  const charger = useCallback(() => {
    getToutesCategories().then(setCategories).catch((e) => setErreurChargement(messageChargement(e)));
    getHabilitations().then(setHabilitations).catch((e) => setErreurChargement(messageChargement(e)));
    getCandidatsGestionnaire().then(setCandidats).catch((e) => setErreurChargement(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);

  async function agir(fn: () => Promise<unknown>, ok: string) {
    setErreur(null);
    setInfo(null);
    try {
      await fn();
      setInfo(ok);
      charger();
    } catch (e) {
      setErreur(messageErreur(e, 'Action impossible'));
    }
  }

  const actives = habilitations?.filter((h) => !h.revoqueeAt) ?? [];
  return (
    <div className="max-w-[1100px]">
      <ErreurChargement message={erreurChargement} />
      <Link href="/logistique" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink hover:underline">
        <ChevronLeft aria-hidden size={15} />
        Logistique
      </Link>
      <EnTetePage titre="Administration de la logistique" sousTitre="Gestionnaires et catégories" />
      <Erreur message={erreur} />
      <Info message={info} />

      <Panneau titre="Gestionnaires logistiques" compteur={<span className="text-[13px] font-semibold text-text-muted">{actives.length}</span>} testid="habilitations" className="mb-4 overflow-hidden">
        <p className="border-b border-line px-[18px] py-2.5 text-[12.5px] text-text-muted">Habilitation personnelle, attribuable à tout compte actif (sauf stagiaire) ; elle ne se transmet pas en intérim.</p>
        {habilitations && actives.length === 0 ? (
          <EtatVide texte="Aucun gestionnaire : personne ne peut traiter les demandes." />
        ) : (
          <ul>
            {actives.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0F1F6] px-[18px] py-2.5 text-[13.5px]">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="font-semibold">
                    {h.user.firstName} {h.user.lastName}
                  </strong>
                  <span className="text-[12.5px] text-text-muted">{ROLE_LABEL[h.user.role as keyof typeof ROLE_LABEL] ?? h.user.role}</span>
                  {h.user.status !== 'ACTIF' && <Pastille ton="rouge">Compte inactif</Pastille>}
                </span>
                <button type="button" className={BTN_LIGNE} onClick={() => agir(() => revoquerHabilitation(h.id), 'Habilitation retirée.')}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-wrap items-center gap-2 px-[18px] py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void agir(() => accorderHabilitation(candidat), 'Habilitation accordée.').then(() => setCandidat(''));
          }}
        >
          <select aria-label="Personne à habiliter" className="h-9 w-full max-w-[320px] rounded-[9px] border border-line bg-surface px-2.5 text-[13px]" value={candidat} onChange={(e) => setCandidat(e.target.value)} required>
            <option value="">Choisir une personne…</option>
            {candidats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.lastName} {c.firstName} — {ROLE_LABEL[c.role as keyof typeof ROLE_LABEL] ?? c.role}
              </option>
            ))}
          </select>
          <button type="submit" className={BTN_PRINCIPAL} disabled={!candidat}>
            Habiliter
          </button>
        </form>
      </Panneau>

      <Panneau titre="Catégories" compteur={<span className="text-[13px] font-semibold text-text-muted">{categories?.length ?? ''}</span>} testid="categories" className="overflow-hidden">
        <p className="border-b border-line px-[18px] py-2.5 text-[12.5px] text-text-muted">
          « Validation du chef » : une demande passe d’abord par le chef direct du demandeur, puis par un gestionnaire ; sinon, elle va directement aux gestionnaires. Le code sert de préfixe au numéro d’inventaire.
        </p>
        <div role="table" aria-label="Catégories de la logistique">
          <div role="rowgroup">
            <div role="row" className={`hidden h-[38px] items-center gap-3 border-b border-line bg-[#F7F8FB] px-4 text-[12px] font-semibold text-text-muted lg:grid ${GRILLE}`}>
              {['Code', 'Libellé', 'Nature', 'Réglages'].map((c) => (
                <span key={c} role="columnheader">
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div role="rowgroup">
            {categories?.map((c) => (
              <LigneTableau key={c.id} grille={GRILLE} testid="categorie">
                <span className="font-mono text-[12.5px] text-ink">{c.code}</span>
                {renommage?.id === c.id ? (
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void agir(() => modifierCategorie(c.id, { libelle: renommage.libelle.trim() }), 'Catégorie renommée.').then(() => setRenommage(null));
                    }}
                  >
                    <input aria-label={`Nouveau libellé de ${c.code}`} className="h-[30px] min-w-0 flex-1 rounded-[7px] border border-line bg-surface px-2 text-[13px]" value={renommage.libelle} onChange={(e) => setRenommage({ id: c.id, libelle: e.target.value })} minLength={2} required />
                    <button type="submit" className={BTN_LIGNE_PRINCIPAL}>
                      Enregistrer
                    </button>
                    <button type="button" className={BTN_LIGNE} onClick={() => setRenommage(null)}>
                      Annuler
                    </button>
                  </form>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.libelle}</span>
                    {!c.actif && <Pastille ton="gris">Désactivée</Pastille>}
                    <button type="button" className={BTN_LIGNE} onClick={() => setRenommage({ id: c.id, libelle: c.libelle })}>
                      Renommer
                    </button>
                  </span>
                )}
                <span className="text-[12.5px] text-text-muted">{NATURE[c.nature]}</span>
                <span className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[12.5px]">
                    <input
                      type="checkbox"
                      checked={c.validationChefRequise}
                      onChange={(e) => agir(() => modifierCategorie(c.id, { validationChefRequise: e.target.checked }), `« ${c.libelle} » : ${e.target.checked ? 'validation du chef requise' : 'sans validation du chef'}.`)}
                    />
                    Validation du chef
                  </label>
                  <button type="button" className={BTN_LIGNE} onClick={() => agir(() => modifierCategorie(c.id, { actif: !c.actif }), c.actif ? 'Catégorie désactivée.' : 'Catégorie réactivée.')}>
                    {c.actif ? 'Désactiver' : 'Réactiver'}
                  </button>
                </span>
              </LigneTableau>
            ))}
          </div>
        </div>
        <form
          className="grid gap-2 border-t border-line px-[18px] py-3 sm:grid-cols-[110px_1fr_170px_auto_auto] sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            void agir(() => creerCategorie({ ...cat, code: cat.code.trim().toUpperCase(), libelle: cat.libelle.trim() }), 'Catégorie créée.').then(() =>
              setCat({ code: '', libelle: '', nature: cat.nature, validationChefRequise: true }),
            );
          }}
        >
          <input aria-label="Code" placeholder="Code" className={CHAMP} value={cat.code} onChange={(e) => setCat({ ...cat, code: e.target.value })} required />
          <input aria-label="Libellé" placeholder="Libellé" className={CHAMP} value={cat.libelle} onChange={(e) => setCat({ ...cat, libelle: e.target.value })} required />
          <select aria-label="Nature" className={CHAMP} value={cat.nature} onChange={(e) => setCat({ ...cat, nature: e.target.value as NatureCategorie })}>
            <option value="BIEN">{NATURE.BIEN}</option>
            <option value="FOURNITURE">{NATURE.FOURNITURE}</option>
          </select>
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input type="checkbox" checked={cat.validationChefRequise} onChange={(e) => setCat({ ...cat, validationChefRequise: e.target.checked })} /> Validation du chef
          </label>
          <button type="submit" className={BTN_PRINCIPAL}>
            <Plus aria-hidden size={16} />
            Créer
          </button>
        </form>
      </Panneau>
    </div>
  );
}
