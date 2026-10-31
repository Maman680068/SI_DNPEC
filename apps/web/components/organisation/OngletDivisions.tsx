'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  affecterSection,
  createDivision,
  createSection,
  deleteSection,
  reactivateSection,
  suspendSection,
  updateSection,
  type DivisionVue,
  type SectionVue,
  type VueOrganisation,
} from '../../lib/api/org';
import { useOrg } from '../../lib/org/OrgProvider';
import { BandeCompteurs, BTN_LIGNE, BTN_LIGNE_PRINCIPAL, BTN_PRINCIPAL, BTN_SECONDAIRE, EtatVide, LigneTableau, Pastille, Tableau, type TonPastille } from '../ui/Charte';
import { FenetreFormulaire, Liste } from '../ui/Formulaire';
import { MenuActions } from '../ui/MenuActions';
import { messageErreur, useToast } from '../ui/Toast';
import { OrgEntityFormModal } from './OrgEntityFormModal';
import { DesignerChef } from './DesignerChef';

type Filtre = 'toutes' | 'aCompleter' | 'suspendues';
const ETAT_SECTION: Record<SectionVue['etat'], { libelle: string; ton: TonPastille }> = {
  COMPLETE: { libelle: 'Complète', ton: 'vert' },
  CHEF_A_DESIGNER: { libelle: 'Chef à désigner', ton: 'ambre' },
  SANS_AGENT: { libelle: 'Sans agent', ton: 'gris' },
};
const GRILLE = 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_80px_140px_minmax(0,1.2fr)]';
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Divisions & Sections (S8b) : liste des divisions à gauche (chef, sections, agents, jauge des chefs désignés),
 * fiche à droite (chef et suppléance, quatre chiffres, tableau des sections, agents sans section). Lecture par
 * tous ; actions de l'administrateur (droits de l'API) par les routes existantes.
 */
export function OngletDivisions({ v, onChange }: { v: VueOrganisation; onChange: () => void }) {
  const toast = useToast();
  const { refreshOrg } = useOrg();
  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const [choisie, setChoisie] = useState<string | null>(v.divisions[0]?.id ?? null);
  const [nouvelleDivision, setNouvelleDivision] = useState(false);
  const [nouvelleSection, setNouvelleSection] = useState(false);
  const [edition, setEdition] = useState<SectionVue | null>(null);
  const [designer, setDesigner] = useState<{ d: DivisionVue; s?: SectionVue } | null>(null);
  const [affecter, setAffecter] = useState(false);
  const admin = v.droits.structure;
  const recharger = async () => {
    await refreshOrg();
    onChange();
  };
  const agir = (p: Promise<unknown>, titre: string, detail?: string) =>
    p
      .then(async () => {
        await recharger();
        toast.succes(titre, { detail });
      })
      .catch((e) => toast.erreur('Action impossible', messageErreur(e)));
  const liste = v.divisions.filter((d) => (filtre === 'suspendues' ? !d.actif : filtre === 'aCompleter' ? d.actif && d.chefsDesignes < d.postesChef : true));
  const d = v.divisions.find((x) => x.id === choisie) ?? null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]" data-testid="onglet-divisions">
      <div className="rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line p-2.5">
          {(
            [
              ['toutes', 'Toutes'],
              ['aCompleter', 'À compléter'],
              ['suspendues', 'Suspendues'],
            ] as const
          ).map(([cle, libelle]) => (
            <button key={cle} type="button" aria-pressed={filtre === cle} onClick={() => setFiltre(cle)} className={`h-7 rounded-[6px] px-2.5 text-[12.5px] font-semibold ${filtre === cle ? 'bg-ink text-white' : 'text-text-muted hover:bg-bg'}`}>
              {libelle}
            </button>
          ))}
        </div>
        <ul data-testid="liste-divisions">
          {liste.map((x) => (
            <li key={x.id}>
              <button type="button" aria-current={x.id === choisie ? 'true' : undefined} onClick={() => setChoisie(x.id)} className={`block w-full border-b border-line-doux px-3.5 py-2.5 text-left last:border-0 ${x.id === choisie ? 'bg-ink-50' : 'hover:bg-bg'}`}>
                <span className="flex items-baseline gap-2">
                  <b className="font-heading text-[14px] font-extrabold text-ink-900">{x.code}</b>
                  <span className="truncate text-[12.5px] text-text-muted">{x.nom}</span>
                  {!x.actif && <Pastille ton="gris">Suspendue</Pastille>}
                </span>
                <span className={`block text-[12.5px] ${x.chef ? 'text-text' : 'font-semibold text-clay'}`}>{x.chef ? x.chef.nom : 'Pas de chef'}</span>
                <span className="block text-[12px] text-text-muted">
                  {pluriel(x.sectionsActives, 'section')} · {pluriel(x.agents, 'agent')} · chefs {x.chefsDesignes}/{x.postesChef}
                </span>
                <span aria-hidden className="mt-1 block h-1.5 overflow-hidden rounded-full bg-fond-gris">
                  <span className="block h-full rounded-full bg-sage" style={{ width: `${Math.round((x.chefsDesignes / Math.max(1, x.postesChef)) * 100)}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
        {admin && (
          <div className="p-2.5">
            <button type="button" className={`${BTN_SECONDAIRE} w-full justify-center`} onClick={() => setNouvelleDivision(true)}>
              <Plus aria-hidden size={15} /> Nouvelle division
            </button>
          </div>
        )}
      </div>

      {!d ? (
        <div className="rounded-xl border border-line bg-surface">
          <EtatVide texte="Choisissez une division." />
        </div>
      ) : (
        <section aria-label={`${d.code} — ${d.nom}`} data-testid="fiche-division" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-[17px] font-extrabold text-ink-900">
                {d.code} — {d.nom}
              </h2>
              <p className={`text-[13px] ${d.chef ? 'text-text' : 'font-semibold text-clay'}`}>
                {d.chef ? `Chef de division : ${d.chef.nom}` : 'Pas de chef de division'}
                {d.chef?.suppleant && <span className="text-text-muted"> · suppléance en cours : {d.chef.suppleant}</span>}
              </p>
            </div>
            <Link href={`/annuaire?q=${encodeURIComponent(d.code)}`} className={BTN_SECONDAIRE}>
              Voir les agents
            </Link>
            {v.droits.designerChef && (
              <button type="button" className={BTN_PRINCIPAL} onClick={() => setDesigner({ d })}>
                {d.chef ? 'Changer le chef' : 'Désigner un chef'}
              </button>
            )}
          </div>
          <BandeCompteurs
            label={`Division ${d.code}`}
            items={[
              { valeur: d.sectionsActives, label: 'Sections actives' },
              { valeur: d.agents, label: 'Agents', sous: `dont ${d.enConge} en congé aujourd’hui` },
              { valeur: d.sectionsSansChef, label: 'Sections sans chef', ton: d.sectionsSansChef ? 'ambre' : 'vert' },
              { valeur: d.agentsSansSection.length, label: 'Agents sans section', ton: d.agentsSansSection.length ? 'ambre' : 'gris' },
            ]}
          />
          {d.agentsSansSection.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-gold-soft px-3.5 py-2.5 text-[12.5px]" role="status" data-testid="alerte-sans-section">
              <span>
                {pluriel(d.agentsSansSection.length, 'agent')} de la division sans section : {d.agentsSansSection.map((a) => a.nom).join(', ')}.
              </span>
              {admin && d.sections.some((s) => s.actif) && (
                <button type="button" className={BTN_LIGNE} onClick={() => setAffecter(true)}>
                  Les affecter
                </button>
              )}
            </div>
          )}
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-ink-900">Sections</h3>
            {admin && (
              <button type="button" className={BTN_SECONDAIRE} onClick={() => setNouvelleSection(true)}>
                <Plus aria-hidden size={15} /> Nouvelle section
              </button>
            )}
          </div>
          <Tableau label="Sections" testid="tableau-sections" grille={GRILLE} colonnes={['Section', 'Chef', 'Agents', 'État', '']} vide={<EtatVide texte="Aucune section dans cette division." />}>
            {d.sections.map((s) => (
              <LigneTableau key={s.id} grille={GRILLE} testid="ligne-section">
                <span className="block">
                  <b className="block font-semibold text-ink-900">
                    {s.code} {!s.actif && <Pastille ton="gris">Suspendue</Pastille>}
                  </b>
                  <small className="block truncate text-[12px] text-text-muted">{s.nom}</small>
                </span>
                <span className={`block truncate ${s.chef ? '' : 'font-semibold text-clay'}`}>{s.chef ? s.chef.nom : 'Pas de chef'}</span>
                <span>{s.agents}</span>
                <Pastille ton={ETAT_SECTION[s.etat].ton} testid="etat-section">
                  {ETAT_SECTION[s.etat].libelle}
                </Pastille>
                <span className="flex flex-wrap justify-end gap-1.5">
                  {v.droits.designerChef && !s.chef && s.actif && (
                    <button type="button" className={BTN_LIGNE_PRINCIPAL} onClick={() => setDesigner({ d, s })}>
                      Désigner un chef
                    </button>
                  )}
                  {admin && (
                    <>
                      <button type="button" className={BTN_LIGNE} onClick={() => setEdition(s)}>
                        Modifier
                      </button>
                      <MenuActions
                        libelle={`Plus d’actions pour ${s.code}`}
                        actions={[
                          { label: s.actif ? 'Suspendre' : 'Réactiver', onSelect: () => agir(s.actif ? suspendSection(s.id) : reactivateSection(s.id), s.actif ? 'Section suspendue' : 'Section réactivée', s.nom) },
                          { label: 'Supprimer', danger: true, onSelect: () => window.confirm(`Supprimer la section « ${s.nom} » ?`) && agir(deleteSection(s.id), 'Section supprimée', s.nom) },
                        ]}
                      />
                    </>
                  )}
                </span>
              </LigneTableau>
            ))}
          </Tableau>
        </section>
      )}

      {nouvelleDivision && (
        <OrgEntityFormModal
          title="Nouvelle division"
          codeHint="2 à 10 lettres majuscules, ex. DPE"
          libelleValider="Créer la division"
          onClose={() => setNouvelleDivision(false)}
          onSubmit={async (code, name) => {
            await createDivision({ code, name });
            setNouvelleDivision(false);
            await recharger();
            toast.succes('Division créée', { detail: `${code} — ${name}` });
          }}
        />
      )}
      {nouvelleSection && d && (
        <OrgEntityFormModal
          title={`Nouvelle section (${d.code})`}
          codeHint="2 à 10 lettres majuscules, ex. SSR"
          libelleValider="Créer la section"
          onClose={() => setNouvelleSection(false)}
          onSubmit={async (code, name) => {
            await createSection(d.id, { code, name });
            setNouvelleSection(false);
            await recharger();
            toast.succes('Section créée', { detail: `${code} — ${name}` });
          }}
        />
      )}
      {edition && (
        <OrgEntityFormModal
          title="Modifier la section"
          codeHint="2 à 10 lettres majuscules"
          initialCode={edition.code}
          initialName={edition.nom}
          onClose={() => setEdition(null)}
          onSubmit={async (code, name) => {
            await updateSection(edition.id, { code, name });
            setEdition(null);
            await recharger();
            toast.succes('Section modifiée', { detail: `${code} — ${name}` });
          }}
        />
      )}
      {designer && (
        <DesignerChef
          unite={designer.s ? `${designer.s.code} (${designer.d.code})` : designer.d.code}
          role={designer.s ? 'CHEF_SECTION' : 'CHEF_DIVISION'}
          rattachement={{ divisionId: designer.d.id, sectionId: designer.s?.id ?? null, celluleId: null, supervisorId: null }}
          onClose={() => setDesigner(null)}
          onFait={() => {
            setDesigner(null);
            void recharger();
          }}
        />
      )}
      {affecter && d && <FenetreAffecter d={d} onClose={() => setAffecter(false)} onFait={() => (setAffecter(false), void recharger())} />}
    </div>
  );
}

/** « Les affecter » : une section pour chaque agent de la division sans section (route d'affectation existante). */
function FenetreAffecter({ d, onClose, onFait }: { d: DivisionVue; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <FenetreFormulaire
      titre={`Affecter les agents sans section (${d.code})`}
      onClose={onClose}
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Affecter"
      testid="fenetre-affecter"
      onSubmit={async () => {
        const lignes = Object.entries(choix).filter(([, s]) => s);
        if (!lignes.length) return setErreur('Choisissez la section d’au moins un agent.');
        setEnCours(true);
        setErreur(null);
        try {
          for (const [userId, sectionId] of lignes) await affecterSection(userId, d.id, sectionId);
          toast.succes('Agents affectés', { detail: pluriel(lignes.length, 'agent') });
          onFait();
        } catch (e) {
          setErreur(messageErreur(e));
        } finally {
          setEnCours(false);
        }
      }}
    >
      {d.agentsSansSection.map((a) => (
        <Liste
          key={a.id}
          id={`affecter-${a.id}`}
          label={a.nom}
          facultatif
          value={choix[a.id] ?? ''}
          onChange={(x) => setChoix((o) => ({ ...o, [a.id]: x }))}
          vide="— Laisser sans section —"
          options={d.sections.filter((s) => s.actif).map((s) => ({ value: s.id, label: `${s.code} — ${s.nom}` }))}
        />
      ))}
    </FenetreFormulaire>
  );
}
