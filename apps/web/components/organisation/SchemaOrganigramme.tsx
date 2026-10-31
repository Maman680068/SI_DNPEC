'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Minus, Plus, Printer } from 'lucide-react';
import type { CelluleVue, ChefVue, DivisionVue, MembreVue, SectionVue, VueOrganisation } from '../../lib/api/org';
import { BTN_LIGNE, BTN_LIGNE_PRINCIPAL, BTN_SECONDAIRE, CleValeur, Pastille } from '../ui/Charte';
import { FenetreDetail } from '../ui/FenetreDetail';
import { DesignerChef } from './DesignerChef';

type Filtre = 'toutes' | 'sansResponsable' | 'sansAgent';
type Fiche =
  | { type: 'division'; d: DivisionVue }
  | { type: 'section'; d: DivisionVue; s: SectionVue }
  | { type: 'cellule'; c: CelluleVue }
  | { type: 'direction'; titre: string; chef: ChefVue | null; equipe: MembreVue[] };

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Case du schéma : bord rouge sans responsable, pastille du nombre d'agents, atténuée hors filtre. */
function Case({
  sigle,
  titre,
  chef,
  agents,
  variante,
  attenuee,
  onClick,
  sousTitre,
  testid,
}: {
  sigle: string;
  titre: string;
  chef: ChefVue | null | undefined;
  agents: number | null;
  variante: 'direction' | 'division' | 'section' | 'cellule' | 'calculee';
  attenuee?: boolean;
  onClick?: () => void;
  sousTitre?: ReactNode;
  testid?: string;
}) {
  const sansChef = variante !== 'calculee' && !chef;
  const style = {
    // Texte de la couleur du fond de page : lisible sur ink-900 dans les deux thèmes (ink-900 s'éclaircit en sombre).
    direction: 'min-w-[200px] border-2 border-ink-900 bg-ink-900 text-surface shadow-md',
    division: 'min-w-[150px] border-2 border-ink-900 bg-surface shadow-md',
    section: 'min-w-[140px] border border-line-fort bg-surface',
    cellule: 'min-w-[130px] max-w-[170px] border border-dashed border-line-fort bg-fond-doux text-[11.5px] opacity-90',
    calculee: 'min-w-[150px] max-w-[190px] border border-dashed border-line-fort bg-fond-doux text-[11.5px]',
  }[variante];
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid ?? `case-${variante}`}
      data-sans-chef={sansChef ? 'oui' : undefined}
      className={`relative rounded-[10px] px-3 py-2 text-left transition-opacity ${style} ${sansChef ? '!border-clay !border-2' : ''} ${attenuee ? 'opacity-25' : ''}`}
    >
      {agents !== null && (
        <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-sur-or" aria-label={pluriel(agents, 'agent')}>
          {agents}
        </span>
      )}
      <b className={`block font-heading ${variante === 'cellule' || variante === 'calculee' ? 'text-[12.5px]' : 'text-[14px]'} font-extrabold`}>{sigle}</b>
      <span className={`block truncate ${variante === 'direction' ? 'text-surface/80' : 'text-text-muted'} text-[11.5px]`} title={titre}>
        {titre}
      </span>
      <span className={`mt-0.5 block truncate text-[11.5px] ${variante === 'direction' ? 'text-surface' : sansChef ? 'font-semibold text-clay' : 'text-text'}`}>{sousTitre ?? (chef ? chef.nom : 'Sans responsable')}</span>
    </button>
  );
}

/** Cellules rattachées sur le côté de l'axe DN–DNA, reliées par un trait pointillé. */
function Cote({ cellules, cote, filtre, onFiche }: { cellules: CelluleVue[]; cote: 'gauche' | 'droite'; filtre: (c: { chef: ChefVue | null; agents: number; membresExternes?: boolean }) => boolean; onFiche: (f: Fiche) => void }) {
  if (!cellules.length) return <div />;
  return (
    <div className={`flex items-center gap-2 ${cote === 'gauche' ? 'justify-end' : 'justify-start'}`}>
      {cote === 'droite' && <span aria-hidden className="w-8 border-t-2 border-dotted border-line-fort" />}
      <div className="flex flex-wrap gap-2">
        {cellules.map((c) => (
          <Case key={c.id} sigle={c.code} titre={`${c.libelleNature} · ${c.nom}`} chef={c.chef} agents={c.membresExternes ? null : c.agents} variante="cellule" attenuee={!filtre(c)} onClick={() => onFiche({ type: 'cellule', c })} testid="case-cellule" />
        ))}
      </div>
      {cote === 'gauche' && <span aria-hidden className="w-8 border-t-2 border-dotted border-line-fort" />}
    </div>
  );
}

/**
 * Organigramme en schéma (S8a) : DN en haut, DNA dessous ; cellules SUR LE CÔTÉ de l'axe (pointillés, plus
 * petites et plus pâles : elles ne dominent pas les divisions) ; « Chargés d'études auprès du DN » (case
 * calculée) ; divisions sur la barre hiérarchique en trait plein, sections empilées dessous. Bord rouge = sans
 * responsable ; filtres, zoom, impression A4 paysage ; fiche au clic.
 */
export function SchemaOrganigramme({ v, onChange }: { v: VueOrganisation; onChange: () => void }) {
  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const [zoom, setZoom] = useState(1);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const garde = (u: { chef: ChefVue | null; agents: number; membresExternes?: boolean }) =>
    filtre === 'toutes' ? true : filtre === 'sansResponsable' ? !u.chef : u.agents === 0 && !u.membresExternes;
  const actives = (l: CelluleVue[]) => l.filter((c) => c.actif);
  const celDn = actives(v.cellules.filter((c) => c.rattachement === 'DN'));
  const celDna = actives(v.cellules.filter((c) => c.rattachement === 'DNA'));
  const divisions = v.divisions.filter((d) => d.actif);

  return (
    <section data-testid="schema-organigramme" aria-label="Organigramme en schéma">
      <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } }'}</style>
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <div role="group" aria-label="Filtrer les unités" className="flex rounded-[9px] border border-line bg-surface p-[3px]">
          {(
            [
              ['toutes', 'Toutes'],
              ['sansResponsable', 'Sans responsable'],
              ['sansAgent', 'Sans agent'],
            ] as const
          ).map(([cle, libelle]) => (
            <button key={cle} type="button" aria-pressed={filtre === cle} onClick={() => setFiltre(cle)} className={`h-7 rounded-[6px] px-[11px] text-[13px] font-semibold ${filtre === cle ? 'bg-ink text-white' : 'text-text-muted hover:text-ink'}`}>
              {libelle}
            </button>
          ))}
        </div>
        <span className="text-[12.5px] text-text-muted">{pluriel(v.chiffres.sansResponsable, 'unité')} sans responsable</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={BTN_LIGNE} aria-label="Réduire" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}>
            <Minus aria-hidden size={14} />
          </button>
          <span className="w-12 text-center text-[12.5px] font-semibold" data-testid="zoom">{Math.round(zoom * 100)} %</span>
          <button type="button" className={BTN_LIGNE} aria-label="Agrandir" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(1)))}>
            <Plus aria-hidden size={14} />
          </button>
          <button type="button" className={BTN_SECONDAIRE} onClick={() => window.print()}>
            <Printer aria-hidden size={15} /> Imprimer / PDF
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface p-5">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }} className="mx-auto w-max min-w-full">
          {/* Axe DN–DNA, cellules sur le côté */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Cote cellules={celDn} cote="gauche" filtre={garde} onFiche={setFiche} />
            <div className="flex justify-center">
              <Case sigle="DN" titre="Directeur national" chef={v.direction.dn} agents={null} variante="direction" onClick={() => setFiche({ type: 'direction', titre: 'Direction nationale (DN)', chef: v.direction.dn, equipe: v.direction.chargesAupresDn })} testid="case-dn" />
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden className="w-8 border-t-2 border-dotted border-line-fort" />
              <Case
                sigle="Auprès du DN"
                titre="Chargés d’études auprès du DN"
                chef={null}
                agents={v.direction.chargesAupresDn.length}
                variante="calculee"
                sousTitre="rattachés directement à la Direction"
                attenuee={filtre !== 'toutes'}
                onClick={() => setFiche({ type: 'direction', titre: 'Chargés d’études auprès du DN', chef: null, equipe: v.direction.chargesAupresDn })}
                testid="case-aupres-dn"
              />
            </div>
          </div>
          <div className="mx-auto h-5 w-0 border-l-2 border-ink-900" aria-hidden />
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Cote cellules={celDna} cote="gauche" filtre={garde} onFiche={setFiche} />
            <div className="flex justify-center">
              <Case sigle="DNA" titre="Directrice nationale adjointe" chef={v.direction.dna} agents={null} variante="direction" onClick={() => setFiche({ type: 'direction', titre: 'Direction nationale adjointe (DNA)', chef: v.direction.dna, equipe: [] })} testid="case-dna" />
            </div>
            <div />
          </div>
          <div className="mx-auto h-5 w-0 border-l-2 border-ink-900" aria-hidden />
          {/* Barre hiérarchique en trait plein, divisions et sections */}
          <div className="flex justify-center">
            <div className="relative flex gap-4 border-t-2 border-ink-900 pt-0" data-testid="barre-divisions">
              {divisions.map((d) => (
                <div key={d.id} className="flex flex-col items-center">
                  <span aria-hidden className="h-4 w-0 border-l-2 border-ink-900" />
                  <Case sigle={d.code} titre={d.nom} chef={d.chef} agents={d.agents} variante="division" attenuee={!garde(d)} onClick={() => setFiche({ type: 'division', d })} testid="case-division" />
                  <div className="mt-2 flex flex-col items-stretch gap-1.5 border-l border-line-fort pl-2">
                    {d.sections
                      .filter((s) => s.actif)
                      .map((s) => (
                        <Case key={s.id} sigle={s.code} titre={s.nom} chef={s.chef} agents={s.agents} variante="section" attenuee={!garde(s)} onClick={() => setFiche({ type: 'section', d, s })} testid="case-section" />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {fiche && <FicheUnite fiche={fiche} v={v} onClose={() => setFiche(null)} onChange={onChange} />}
    </section>
  );
}

/** Fiche au clic : chef, suppléant, agents (dont en congé), sections sans chef, « Voir les agents », « Désigner un chef ». */
export function FicheUnite({ fiche, v, onClose, onChange }: { fiche: Fiche; v: VueOrganisation; onClose: () => void; onChange: () => void }) {
  const [designer, setDesigner] = useState(false);
  const titre = fiche.type === 'division' ? `${fiche.d.code} — ${fiche.d.nom}` : fiche.type === 'section' ? `${fiche.s.code} — ${fiche.s.nom}` : fiche.type === 'cellule' ? `${fiche.c.code} — ${fiche.c.nom}` : fiche.titre;
  const chef = fiche.type === 'division' ? fiche.d.chef : fiche.type === 'section' ? fiche.s.chef : fiche.type === 'cellule' ? fiche.c.chef : fiche.chef;
  const equipe = fiche.type === 'division' ? fiche.d.equipe : fiche.type === 'section' ? fiche.s.equipe : fiche.type === 'cellule' ? fiche.c.equipe : fiche.equipe;
  const enConge = fiche.type === 'division' ? fiche.d.enConge : fiche.type === 'cellule' ? fiche.c.enConge : null;
  const sigle = fiche.type === 'division' ? fiche.d.code : fiche.type === 'section' ? fiche.s.code : fiche.type === 'cellule' ? fiche.c.code : 'DN';
  const peutDesigner = v.droits.designerChef && fiche.type !== 'direction';
  const cible =
    fiche.type === 'division'
      ? { role: 'CHEF_DIVISION' as const, rattachement: { divisionId: fiche.d.id, sectionId: null, celluleId: null, supervisorId: null } }
      : fiche.type === 'section'
        ? { role: 'CHEF_SECTION' as const, rattachement: { divisionId: fiche.d.id, sectionId: fiche.s.id, celluleId: null, supervisorId: null } }
        : fiche.type === 'cellule'
          ? { role: 'CHEF_CELLULE' as const, rattachement: { divisionId: null, sectionId: null, celluleId: fiche.c.id, supervisorId: null } }
          : null;
  if (designer && cible) return <DesignerChef unite={titre} role={cible.role} rattachement={cible.rattachement} onClose={() => setDesigner(false)} onFait={() => (setDesigner(false), onClose(), onChange())} />;
  return (
    <FenetreDetail
      titre={titre}
      onClose={onClose}
      largeur={720}
      testid="fiche-unite"
      filAriane={['Organisation']}
      cote={
        <div className="grid gap-2">
          <Link href={`/annuaire?q=${encodeURIComponent(sigle)}`} className={BTN_SECONDAIRE}>
            Voir les agents
          </Link>
          {peutDesigner && (
            <button type="button" className={chef ? BTN_LIGNE : BTN_LIGNE_PRINCIPAL} onClick={() => setDesigner(true)}>
              {chef ? 'Changer le chef' : 'Désigner un chef'}
            </button>
          )}
        </div>
      }
    >
      <CleValeur
        largeur={150}
        lignes={[
          ['Responsable', chef ? chef.nom : <span key="c" className="font-semibold text-clay">Sans responsable</span>],
          ['Suppléance en cours', chef?.suppleant ?? '—'],
          ['Agents', `${fiche.type === 'cellule' && fiche.c.membresExternes ? 'membres d’autres institutions' : pluriel(equipe.length, 'agent')}${enConge ? ` · dont ${enConge} en congé aujourd’hui` : ''}`],
          ...(fiche.type === 'division' ? ([['Sections sans chef', fiche.d.sections.filter((s) => s.actif && !s.chef).map((s) => s.code).join(', ') || 'aucune']] as [string, ReactNode][]) : []),
          ...(fiche.type === 'cellule' ? ([['Rattachement', fiche.c.rattachement === 'DN' ? 'Directeur national' : 'Directrice nationale adjointe']] as [string, ReactNode][]) : []),
        ]}
      />
      {equipe.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" data-testid="equipe-unite">
          {equipe.slice(0, 40).map((m) => (
            <Pastille key={m.id} ton="gris">
              {m.nom}
            </Pastille>
          ))}
        </div>
      )}
    </FenetreDetail>
  );
}
