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
import { Erreur, SELECT_CLASS, messageErreur } from '../../../../components/courrier/ui';
import { ErreurChargement, messageChargement } from '../../../../components/ui/ErreurChargement';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Info } from '../../../../components/logistique/commun';

const NATURE: Record<NatureCategorie, string> = { BIEN: 'Biens inventoriés', FOURNITURE: 'Fournitures' };

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

  return (
    <div className="max-w-[960px]">
      <ErreurChargement message={erreurChargement} />
      <Link href="/logistique" className="mb-4 inline-block text-[13px] text-accent">
        ← Logistique
      </Link>
      <h1 className="mb-5 text-[22px] font-extrabold">Administration de la logistique</h1>
      <Erreur message={erreur} />
      <Info message={info} />

      <section className="mb-6 rounded-lg border border-line bg-surface p-4" data-testid="habilitations">
        <h2 className="mb-1 text-[15px] font-bold">Gestionnaires logistiques</h2>
        <p className="mb-3 text-[12.5px] text-text-muted">Habilitation personnelle, attribuable à tout compte actif (sauf stagiaire) ; elle ne se transmet pas en intérim.</p>
        <ul className="mb-3 text-[13px]">
          {habilitations?.filter((h) => !h.revoqueeAt).map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-1.5 last:border-b-0">
              <span>
                <strong>
                  {h.user.firstName} {h.user.lastName}
                </strong>{' '}
                <span className="text-text-muted">({ROLE_LABEL[h.user.role as keyof typeof ROLE_LABEL] ?? h.user.role})</span>
                {h.user.status !== 'ACTIF' && <Badge tone="clay" className="ml-2">Compte inactif</Badge>}
              </span>
              <button className="text-[12.5px] text-clay underline" onClick={() => agir(() => revoquerHabilitation(h.id), 'Habilitation retirée.')}>
                Retirer
              </button>
            </li>
          ))}
          {habilitations && habilitations.every((h) => h.revoqueeAt) && <li className="text-text-faint">Aucun gestionnaire : personne ne peut traiter les demandes.</li>}
        </ul>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void agir(() => accorderHabilitation(candidat), 'Habilitation accordée.').then(() => setCandidat(''));
          }}
        >
          <select aria-label="Personne à habiliter" className={`${SELECT_CLASS} !w-72`} value={candidat} onChange={(e) => setCandidat(e.target.value)} required>
            <option value="">Choisir une personne…</option>
            {candidats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.lastName} {c.firstName} — {ROLE_LABEL[c.role as keyof typeof ROLE_LABEL] ?? c.role}
              </option>
            ))}
          </select>
          <Button type="submit" variant="gold" disabled={!candidat}>
            Habiliter
          </Button>
        </form>
      </section>

      <section className="mb-6 rounded-lg border border-line bg-surface p-4" data-testid="categories">
        <h2 className="mb-1 text-[15px] font-bold">Catégories</h2>
        <p className="mb-3 text-[12.5px] text-text-muted">
          « Validation du chef » : une demande passe d’abord par le chef direct du demandeur, puis par un gestionnaire ; sinon, elle va directement aux gestionnaires. Le code sert de préfixe au numéro d’inventaire.
        </p>
        <ul className="mb-4 text-[13px]">
          {categories?.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-1.5 last:border-b-0" data-testid="categorie">
              {renommage?.id === c.id ? (
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void agir(() => modifierCategorie(c.id, { libelle: renommage.libelle.trim() }), 'Catégorie renommée.').then(() => setRenommage(null));
                  }}
                >
                  <span className="font-mono">{c.code}</span>
                  <input aria-label={`Nouveau libellé de ${c.code}`} className={`${SELECT_CLASS} !w-56 !py-1.5`} value={renommage.libelle} onChange={(e) => setRenommage({ id: c.id, libelle: e.target.value })} minLength={2} required />
                  <Button type="submit" className="px-3 py-1.5 text-[12.5px]">Enregistrer</Button>
                  <button type="button" className="text-[12.5px] text-text-muted underline" onClick={() => setRenommage(null)}>
                    Annuler
                  </button>
                </form>
              ) : (
                <span>
                  <span className="font-mono">{c.code}</span> — {c.libelle} <span className="text-text-muted">({NATURE[c.nature]})</span> {!c.actif && <Badge tone="muted">Désactivée</Badge>}{' '}
                  <button className="text-[12.5px] text-accent underline" onClick={() => setRenommage({ id: c.id, libelle: c.libelle })}>
                    Renommer
                  </button>
                </span>
              )}
              <span className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-[12.5px]">
                  <input
                    type="checkbox"
                    checked={c.validationChefRequise}
                    onChange={(e) => agir(() => modifierCategorie(c.id, { validationChefRequise: e.target.checked }), `« ${c.libelle} » : ${e.target.checked ? 'validation du chef requise' : 'sans validation du chef'}.`)}
                  />
                  Validation du chef
                </label>
                <button className="text-[12.5px] text-accent underline" onClick={() => agir(() => modifierCategorie(c.id, { actif: !c.actif }), c.actif ? 'Catégorie désactivée.' : 'Catégorie réactivée.')}>
                  {c.actif ? 'Désactiver' : 'Réactiver'}
                </button>
              </span>
            </li>
          ))}
        </ul>
        <form
          className="grid gap-2 sm:grid-cols-[110px_1fr_170px_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void agir(() => creerCategorie({ ...cat, code: cat.code.trim().toUpperCase(), libelle: cat.libelle.trim() }), 'Catégorie créée.').then(() =>
              setCat({ code: '', libelle: '', nature: cat.nature, validationChefRequise: true }),
            );
          }}
        >
          <input aria-label="Code" placeholder="Code" className={SELECT_CLASS} value={cat.code} onChange={(e) => setCat({ ...cat, code: e.target.value })} required />
          <input aria-label="Libellé" placeholder="Libellé" className={SELECT_CLASS} value={cat.libelle} onChange={(e) => setCat({ ...cat, libelle: e.target.value })} required />
          <select aria-label="Nature" className={SELECT_CLASS} value={cat.nature} onChange={(e) => setCat({ ...cat, nature: e.target.value as NatureCategorie })}>
            <option value="BIEN">{NATURE.BIEN}</option>
            <option value="FOURNITURE">{NATURE.FOURNITURE}</option>
          </select>
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input type="checkbox" checked={cat.validationChefRequise} onChange={(e) => setCat({ ...cat, validationChefRequise: e.target.checked })} /> Validation du chef
          </label>
          <Button type="submit" variant="gold">
            Créer
          </Button>
        </form>
      </section>
    </div>
  );
}
