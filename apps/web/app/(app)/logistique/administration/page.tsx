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
import { ErreurChargement, messageChargement } from '../../../../components/ui/ErreurChargement';
import { BTN_LIGNE, BTN_PRINCIPAL, EnTetePage, EtatVide, LigneTableau, Panneau, Pastille } from '../../../../components/ui/Charte';
import { Case, ChoixSegment, FenetreFormulaire, Grille2, Saisie, SelecteurPersonnes } from '../../../../components/ui/Formulaire';
import { SqueletteListe } from '../../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../../components/ui/Toast';
import { nomDe, useEnvoi, versPersonne } from '../../../../components/courrier/formulaire';

const NATURE: Record<NatureCategorie, string> = { BIEN: 'Biens inventoriés', FOURNITURE: 'Fournitures' };
const GRILLE = 'lg:grid-cols-[90px_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.3fr)]';
const libelleRole = (role: string) => ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role;

/** Administration de la logistique (administrateur système) : catégories et
 * réglage « validation du chef requise », habilitations de gestionnaire. */
export default function AdministrationLogistiquePage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Categorie[] | null>(null);
  const [habilitations, setHabilitations] = useState<Habilitation[] | null>(null);
  const [candidats, setCandidats] = useState<(Nom & { role: string })[]>([]);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<{ type: 'habiliter' } | { type: 'categorie' } | { type: 'renommer'; categorie: Categorie } | null>(null);

  const charger = useCallback(() => {
    getToutesCategories().then(setCategories).catch((e) => setErreurChargement(messageChargement(e)));
    getHabilitations().then(setHabilitations).catch((e) => setErreurChargement(messageChargement(e)));
    getCandidatsGestionnaire().then(setCandidats).catch((e) => setErreurChargement(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);

  /** Action directe ; `annuler` : remise en l'état par la même route (réglage d'une catégorie). */
  async function agir(fn: () => Promise<unknown>, succes: { titre: string; detail?: string; annuler?: () => Promise<void> }) {
    try {
      await fn();
      toast.succes(succes.titre, { detail: succes.detail, annuler: succes.annuler });
      charger();
    } catch (e) {
      toast.erreur('Action impossible', messageErreur(e));
    }
  }
  const reglage = (c: Categorie, input: { validationChefRequise?: boolean; actif?: boolean }, titre: string, inverse: { validationChefRequise?: boolean; actif?: boolean }) =>
    agir(() => modifierCategorie(c.id, input), {
      titre,
      detail: c.libelle,
      annuler: () => agir(() => modifierCategorie(c.id, inverse), { titre: 'Réglage rétabli', detail: c.libelle }),
    });

  const actives = habilitations?.filter((h) => !h.revoqueeAt) ?? [];
  const apres = (titre: string, detail?: string) => {
    setFenetre(null);
    toast.succes(titre, { detail });
    charger();
  };
  return (
    <div className="max-w-[1100px]">
      <ErreurChargement message={erreurChargement} />
      <Link href="/logistique" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink hover:underline">
        <ChevronLeft aria-hidden size={15} />
        Logistique
      </Link>
      <EnTetePage titre="Administration de la logistique" sousTitre="Gestionnaires et catégories" />

      <Panneau
        titre="Gestionnaires logistiques"
        compteur={<span className="text-[13px] font-semibold text-text-muted">{actives.length}</span>}
        action={
          <button type="button" className={BTN_PRINCIPAL} onClick={() => setFenetre({ type: 'habiliter' })}>
            <Plus aria-hidden size={16} />
            Habiliter
          </button>
        }
        testid="habilitations"
        className="mb-4 overflow-hidden"
      >
        <p className="border-b border-line px-[18px] py-2.5 text-[12.5px] text-text-muted">Habilitation personnelle, attribuable à tout compte actif (sauf stagiaire) ; elle ne se transmet pas en intérim.</p>
        {habilitations === null ? (
          !erreurChargement && (
            <div className="p-3">
              <SqueletteListe lignes={2} colonnes={2} />
            </div>
          )
        ) : actives.length === 0 ? (
          <EtatVide texte="Aucun gestionnaire : personne ne peut traiter les demandes." />
        ) : (
          <ul>
            {actives.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0F1F6] px-[18px] py-2.5 text-[13.5px] last:border-b-0">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="font-semibold">
                    {h.user.firstName} {h.user.lastName}
                  </strong>
                  <span className="text-[12.5px] text-text-muted">{libelleRole(h.user.role)}</span>
                  {h.user.status !== 'ACTIF' && <Pastille ton="rouge">Compte inactif</Pastille>}
                </span>
                <button
                  type="button"
                  className={BTN_LIGNE}
                  onClick={() => agir(() => revoquerHabilitation(h.id), { titre: 'Habilitation retirée', detail: `${h.user.firstName} ${h.user.lastName} ne traite plus les demandes.` })}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      <Panneau
        titre="Catégories"
        compteur={<span className="text-[13px] font-semibold text-text-muted">{categories?.length ?? ''}</span>}
        action={
          <button type="button" className={BTN_PRINCIPAL} onClick={() => setFenetre({ type: 'categorie' })}>
            <Plus aria-hidden size={16} />
            Nouvelle catégorie
          </button>
        }
        testid="categories"
        className="overflow-hidden"
      >
        <p className="border-b border-line px-[18px] py-2.5 text-[12.5px] text-text-muted">
          « Validation du chef » : une demande passe d’abord par le chef direct du demandeur, puis par un gestionnaire ; sinon, elle va directement aux gestionnaires. Le code sert de préfixe au numéro d’inventaire.
        </p>
        {categories === null && !erreurChargement && (
          <div className="p-3">
            <SqueletteListe lignes={4} colonnes={4} />
          </div>
        )}
        {categories && (
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
              {categories.map((c) => (
                <LigneTableau key={c.id} grille={GRILLE} testid="categorie">
                  <span className="font-mono text-[12.5px] text-ink">{c.code}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.libelle}</span>
                    {!c.actif && <Pastille ton="gris">Désactivée</Pastille>}
                    <button type="button" className={BTN_LIGNE} onClick={() => setFenetre({ type: 'renommer', categorie: c })}>
                      Renommer
                    </button>
                  </span>
                  <span className="text-[12.5px] text-text-muted">{NATURE[c.nature]}</span>
                  <span className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[12.5px]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-ink"
                        checked={c.validationChefRequise}
                        onChange={(e) =>
                          reglage(c, { validationChefRequise: e.target.checked }, e.target.checked ? 'Validation du chef requise' : 'Sans validation du chef', { validationChefRequise: !e.target.checked })
                        }
                      />
                      Validation du chef
                    </label>
                    <button type="button" className={BTN_LIGNE} onClick={() => reglage(c, { actif: !c.actif }, c.actif ? 'Catégorie désactivée' : 'Catégorie réactivée', { actif: c.actif })}>
                      {c.actif ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </span>
                </LigneTableau>
              ))}
            </div>
          </div>
        )}
      </Panneau>

      {fenetre?.type === 'habiliter' && (
        <FenetreHabiliter candidats={candidats} onClose={() => setFenetre(null)} onFait={(nom) => apres('Habilitation accordée', `${nom} peut traiter les demandes logistiques.`)} />
      )}
      {fenetre?.type === 'categorie' && <FenetreCategorie onClose={() => setFenetre(null)} onFait={(c) => apres('Catégorie créée', `${c.code} — ${c.libelle}`)} />}
      {fenetre?.type === 'renommer' && <FenetreRenommer categorie={fenetre.categorie} onClose={() => setFenetre(null)} onFait={(c) => apres('Catégorie renommée', c.libelle)} />}
    </div>
  );
}

function FenetreHabiliter({ candidats, onClose, onFait }: { candidats: (Nom & { role: string })[]; onClose: () => void; onFait: (nom: string) => void }) {
  const [userId, setUserId] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  const personnes = candidats.map((c) => versPersonne(c, libelleRole(c.role)));
  return (
    <FenetreFormulaire
      titre="Habiliter un gestionnaire logistique"
      libelleValider="Habiliter"
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Habilitation personnelle : elle ne se transmet pas en intérim."
      onSubmit={async () => {
        const r = await envoyer(() => accorderHabilitation(userId));
        if (r.ok) onFait(nomDe(personnes, userId));
      }}
    >
      <SelecteurPersonnes id="hab-personne" label="Personne à habiliter" options={personnes} valeurs={userId ? [userId] : []} onChange={(ids) => setUserId(ids[0] ?? '')} multiple={false} required messageObligatoire="Choisissez la personne à habiliter." />
    </FenetreFormulaire>
  );
}

function FenetreCategorie({ onClose, onFait }: { onClose: () => void; onFait: (c: Categorie) => void }) {
  const [cat, setCat] = useState({ code: '', libelle: '', nature: 'BIEN' as NatureCategorie, validationChefRequise: true });
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre="Nouvelle catégorie"
      libelleValider="Créer la catégorie"
      largeur={620}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Le code sert de préfixe au numéro d’inventaire ; il ne change plus ensuite."
      valider={() => ({
        ...(cat.code.trim() && !/^[A-Z0-9]{2,10}$/.test(cat.code.trim()) ? { 'cat-code': 'De 2 à 10 lettres majuscules ou chiffres, sans espace.' } : {}),
        ...(cat.libelle.trim().length === 1 ? { 'cat-libelle': 'Indiquez au moins 2 caractères.' } : {}),
      })}
      onSubmit={async () => {
        const r = await envoyer(() => creerCategorie({ ...cat, code: cat.code.trim().toUpperCase(), libelle: cat.libelle.trim() }));
        if (r.ok) onFait(r.valeur);
      }}
    >
      <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3">
        <Saisie id="cat-code" label="Code" value={cat.code} onChange={(code) => setCat({ ...cat, code: code.toUpperCase() })} required maxLength={10} messageObligatoire="Indiquez le code." placeholder="INF" />
        <Saisie id="cat-libelle" label="Libellé" value={cat.libelle} onChange={(libelle) => setCat({ ...cat, libelle })} required maxLength={200} messageObligatoire="Indiquez le libellé." />
      </div>
      <Grille2>
        <ChoixSegment<NatureCategorie>
          id="cat-nature"
          label="Nature"
          value={cat.nature}
          onChange={(nature) => setCat({ ...cat, nature })}
          options={[
            { value: 'BIEN', label: NATURE.BIEN },
            { value: 'FOURNITURE', label: NATURE.FOURNITURE },
          ]}
        />
      </Grille2>
      <Case id="cat-validation" label="Validation du chef requise avant le gestionnaire" checked={cat.validationChefRequise} onChange={(validationChefRequise) => setCat({ ...cat, validationChefRequise })} />
    </FenetreFormulaire>
  );
}

function FenetreRenommer({ categorie, onClose, onFait }: { categorie: Categorie; onClose: () => void; onFait: (c: Categorie) => void }) {
  const [libelle, setLibelle] = useState(categorie.libelle);
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre={`Renommer la catégorie ${categorie.code}`}
      libelleValider="Enregistrer"
      largeur={520}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Le code et les numéros d’inventaire ne changent pas."
      valider={() => (libelle.trim().length === 1 ? { 'cat-renommer': 'Indiquez au moins 2 caractères.' } : {})}
      onSubmit={async () => {
        const r = await envoyer(() => modifierCategorie(categorie.id, { libelle: libelle.trim() }));
        if (r.ok) onFait({ ...categorie, libelle: libelle.trim() });
      }}
    >
      <Saisie id="cat-renommer" label="Nouveau libellé" value={libelle} onChange={setLibelle} required maxLength={200} messageObligatoire="Indiquez le libellé." />
    </FenetreFormulaire>
  );
}
