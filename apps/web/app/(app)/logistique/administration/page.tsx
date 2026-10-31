'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { accorderHabilitation, creerCategorie, getAdministrationLogistique, getCandidatsGestionnaire, modifierCategorie, revoquerHabilitation, type AdministrationLogistique } from '../../../../lib/api/logistique';
import type { Categorie, NatureCategorie, Nom } from '../../../../lib/logistique/types';
import { ROLE_LABEL } from '../../../../lib/users/types';
import { AlertTriangle, ArrowRight, ChevronLeft, Plus } from 'lucide-react';
import { ErreurChargement, messageChargement } from '../../../../components/ui/ErreurChargement';
import { Bandeau, BTN_LIGNE, BTN_PRINCIPAL, EnTetePage, EtatVide, Interrupteur, LigneTableau, Panneau, Pastille, usePreference } from '../../../../components/ui/Charte';
import { MenuActions } from '../../../../components/ui/MenuActions';
import { Case, ChoixSegment, FenetreFormulaire, Grille2, Saisie, SelecteurPersonnes } from '../../../../components/ui/Formulaire';
import { SqueletteListe } from '../../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../../components/ui/Toast';
import { nomDe, useEnvoi, versPersonne } from '../../../../components/courrier/formulaire';

const NATURE: Record<NatureCategorie, string> = { BIEN: 'Biens inventoriés', FOURNITURE: 'Fournitures' };
const GRILLE = 'lg:grid-cols-[80px_minmax(0,1.3fr)_130px_minmax(0,1.4fr)_170px_44px]';
const libelleRole = (role: string) => ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role;

/**
 * Administration de la logistique (administrateur système, S9d) : alerte si aucun gestionnaire n'est actif,
 * gestionnaires (actifs / inactifs, conseil « au moins deux »), circuit d'une demande, catégories avec leur
 * contenu calculé par l'API (`GET logistique/administration`), « Validation du chef » en interrupteur.
 */
export default function AdministrationLogistiquePage() {
  const toast = useToast();
  const [vue, setVue] = useState<AdministrationLogistique | null>(null);
  const [candidats, setCandidats] = useState<(Nom & { role: string })[]>([]);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<{ type: 'habiliter' } | { type: 'categorie' } | { type: 'renommer'; categorie: Categorie } | null>(null);
  const [voirDesactivees, setVoirDesactivees] = usePreference('logistique.voirDesactivees', false);

  const charger = useCallback(() => {
    getAdministrationLogistique().then(setVue).catch((e) => setErreurChargement(messageChargement(e)));
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

  const apres = (titre: string, detail?: string) => {
    setFenetre(null);
    toast.succes(titre, { detail });
    charger();
  };
  const g = vue?.gestionnaires;
  const categories = (vue?.categories ?? []).filter((c) => voirDesactivees || c.actif);
  return (
    <div className="max-w-[1100px]">
      <ErreurChargement message={erreurChargement} />
      <Link href="/logistique" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink hover:underline">
        <ChevronLeft aria-hidden size={15} />
        Logistique
      </Link>
      <EnTetePage titre="Administration de la logistique" sousTitre="Gestionnaires, circuit d’une demande et catégories" />

      {vue?.alerteAucun && (
        <Bandeau
          ton="rouge"
          icone={<AlertTriangle aria-hidden size={18} />}
          testid="alerte-aucun-gestionnaire"
          action={
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setFenetre({ type: 'habiliter' })}>
              Habiliter un gestionnaire
            </button>
          }
        >
          <b>Aucun gestionnaire actif</b> : plus personne ne peut traiter les demandes logistiques. L’administrateur a été prévenu.
        </Bandeau>
      )}

      <Panneau
        titre="Gestionnaires logistiques"
        compteur={
          g && (
            <span className="text-[13px] font-semibold text-text-muted" data-testid="compteur-gestionnaires">
              {g.actifs} actif(s){g.inactifs ? ` · ${g.inactifs} inactif(s)` : ''}
            </span>
          )
        }
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
        {g?.conseilDeux && (
          <p className="border-b border-line bg-gold-50 px-[18px] py-2 text-[12.5px]" data-testid="conseil-deux">
            Conseil : habilitez au moins deux personnes, pour qu’une absence ne bloque pas les demandes.
          </p>
        )}
        {!g ? (
          !erreurChargement && (
            <div className="p-3">
              <SqueletteListe lignes={2} colonnes={2} />
            </div>
          )
        ) : g.liste.length === 0 ? (
          <EtatVide texte="Aucun gestionnaire : personne ne peut traiter les demandes." />
        ) : (
          <ul>
            {g.liste.map((h) => (
              <li key={h.habilitationId} className="flex flex-wrap items-center justify-between gap-2 border-b border-line-doux px-[18px] py-2.5 text-[13.5px] last:border-b-0" data-testid="gestionnaire">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="font-semibold">{h.nom}</strong>
                  <span className="text-[12.5px] text-text-muted">{libelleRole(h.role)}</span>
                  {h.actif ? <Pastille ton="vert">Actif</Pastille> : <Pastille ton="rouge">Compte inactif</Pastille>}
                </span>
                <button type="button" className={BTN_LIGNE} onClick={() => agir(() => revoquerHabilitation(h.habilitationId), { titre: 'Habilitation retirée', detail: `${h.nom} ne traite plus les demandes.` })}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      {vue && (
        <Panneau titre="Circuit d’une demande" testid="circuit" className="mb-4 overflow-hidden">
          <ol className="flex flex-wrap items-stretch gap-2 px-[18px] py-3.5 text-[13px]" aria-label="Circuit d’une demande logistique">
            <EtapeCircuit titre="Demandeur" detail="Toute personne (sauf stagiaire)" />
            <Fleche />
            <EtapeCircuit titre="Chef direct" detail={`Si la catégorie le demande (${vue.circuit.avecValidation} catégorie(s) sur ${vue.circuit.avecValidation + vue.circuit.sansValidation})`} />
            <Fleche />
            <EtapeCircuit
              titre="Gestionnaire"
              detail={vue.circuit.gestionnaireDisponible ? `${g?.actifs} personne(s) habilitée(s)` : 'Personne'}
              alerte={!vue.circuit.gestionnaireDisponible}
            />
          </ol>
        </Panneau>
      )}

      <Panneau
        titre="Catégories"
        compteur={<span className="text-[13px] font-semibold text-text-muted">{categories.length}</span>}
        action={
          <button type="button" className={BTN_PRINCIPAL} onClick={() => setFenetre({ type: 'categorie' })}>
            <Plus aria-hidden size={16} />
            Nouvelle catégorie
          </button>
        }
        testid="categories"
        className="overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-[18px] py-2.5">
          <p className="max-w-[680px] text-[12.5px] text-text-muted">
            « Validation du chef » : la demande passe d’abord par le chef direct du demandeur, puis par un gestionnaire. Le code sert de préfixe au numéro d’inventaire.
          </p>
          <Interrupteur label="Afficher les désactivées" actif={voirDesactivees} onChange={setVoirDesactivees} testid="voir-desactivees" />
        </div>
        {!vue && !erreurChargement && (
          <div className="p-3">
            <SqueletteListe lignes={4} colonnes={4} />
          </div>
        )}
        {vue && (
          <div role="table" aria-label="Catégories de la logistique">
            <div role="rowgroup">
              <div role="row" className={`hidden h-[38px] items-center gap-3 border-b border-line bg-fond-doux px-4 text-[12px] font-semibold text-text-muted lg:grid ${GRILLE}`}>
                {['Code', 'Libellé', 'Nature', 'Contenu', 'Validation du chef', ''].map((c, i) => (
                  <span key={i} role="columnheader">
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
                  </span>
                  <Pastille ton={c.nature === 'BIEN' ? 'bleu' : 'ambre'}>{NATURE[c.nature]}</Pastille>
                  <span className="text-[12.5px]" data-testid="contenu-categorie">
                    {contenu(c.nature, c.contenu)}
                  </span>
                  <Interrupteur
                    label="Validation du chef"
                    actif={c.validationChefRequise}
                    onChange={(v) => reglage(c, { validationChefRequise: v }, v ? 'Validation du chef requise' : 'Sans validation du chef', { validationChefRequise: !v })}
                  />
                  <span className="flex justify-end">
                    <MenuActions
                      actions={[
                        { label: 'Renommer', onSelect: () => setFenetre({ type: 'renommer', categorie: c }) },
                        { label: c.actif ? 'Désactiver' : 'Réactiver', onSelect: () => reglage(c, { actif: !c.actif }, c.actif ? 'Catégorie désactivée' : 'Catégorie réactivée', { actif: c.actif }), danger: c.actif },
                      ]}
                    />
                  </span>
                </LigneTableau>
              ))}
            </div>
            <p className="border-t border-line px-[18px] py-2.5 text-[12.5px] text-text-muted" data-testid="parc-vehicules">
              Véhicules (hors catégories) : {vue.vehicules.total} en service, dont {vue.vehicules.enMission} en mission aujourd’hui.
            </p>
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

/** Contenu d'une catégorie en une phrase (chiffres calculés par l'API). */
function contenu(nature: NatureCategorie, c: { biens: number; demandesEnCours: number; articlesSousSeuil: number }) {
  const parts = [
    nature === 'BIEN' ? `${c.biens} bien(s)` : null,
    `${c.demandesEnCours} demande(s) en cours`,
    nature === 'FOURNITURE' && c.articlesSousSeuil ? `${c.articlesSousSeuil} article(s) sous le seuil` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function EtapeCircuit({ titre, detail, alerte = false }: { titre: string; detail: string; alerte?: boolean }) {
  return (
    <li className={`min-w-[150px] flex-1 rounded-[10px] border px-3 py-2 ${alerte ? 'border-clay-bord bg-clay-50' : 'border-line bg-bg'}`} data-testid="etape-circuit">
      <b className="block text-[13px] text-ink-900">{titre}</b>
      <span className={`block text-[12px] ${alerte ? 'font-semibold text-clay' : 'text-text-muted'}`}>{detail}</span>
    </li>
  );
}

function Fleche() {
  return (
    <li aria-hidden className="hidden items-center text-text-muted sm:flex">
      <ArrowRight size={16} />
    </li>
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
