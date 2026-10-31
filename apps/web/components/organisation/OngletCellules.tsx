'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { createCellule, deleteCellule, modifierRattachementCellule, reactivateCellule, suspendCellule, type CelluleVue, type VueOrganisation } from '../../lib/api/org';
import { useOrg } from '../../lib/org/OrgProvider';
import { BTN_LIGNE, BTN_LIGNE_PRINCIPAL, BTN_SECONDAIRE, Initiales, Pastille } from '../ui/Charte';
import { MenuActions, type ActionMenu } from '../ui/MenuActions';
import { messageErreur, useToast } from '../ui/Toast';
import { OrgEntityFormModal } from './OrgEntityFormModal';
import { RetirerChefModal } from './RetirerChefModal';
import { DesignerChef } from './DesignerChef';

type Filtre = 'toutes' | 'sansResponsable' | 'suspendues';
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Cellules (S8c) : deux groupes « Rattachées au DN » et « Rattachées à la DNA » — structures d'appui, à côté
 * des divisions et non au-dessus. Une carte par cellule : sigle (cadre pointillé), nature, responsable,
 * équipe, en congé aujourd'hui, rôles tenus par ses agents (calculés par l'API). Lecture par tous ; actions
 * selon les droits de l'API (structure et chef : administrateur ; rattachement et nature : administrateur ou DRH).
 */
export function OngletCellules({ v, onChange }: { v: VueOrganisation; onChange: () => void }) {
  const toast = useToast();
  const { refreshOrg } = useOrg();
  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const [nouvelle, setNouvelle] = useState(false);
  const [retrait, setRetrait] = useState<CelluleVue | null>(null);
  const [designer, setDesigner] = useState<CelluleVue | null>(null);
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
  const garde = (c: CelluleVue) => (filtre === 'sansResponsable' ? !c.chef : filtre === 'suspendues' ? !c.actif : true);

  const carte = (c: CelluleVue) => {
    const actions: ActionMenu[] = [
      ...(v.droits.rattachement
        ? [
            { label: c.rattachement === 'DN' ? 'Rattacher à la DNA' : 'Rattacher au DN', onSelect: () => agir(modifierRattachementCellule(c.id, { rattachement: c.rattachement === 'DN' ? 'DNA' : 'DN' }), 'Rattachement modifié', `${c.code} rattachée ${c.rattachement === 'DN' ? 'à la DNA' : 'au DN'}.`) },
            ...(['CELLULE', 'SERVICE', 'INSTANCE'] as const)
              .filter((n) => n !== c.nature)
              .map((n) => ({ label: `Nature : ${n === 'CELLULE' ? 'cellule' : n === 'SERVICE' ? 'service' : 'instance'}`, onSelect: () => agir(modifierRattachementCellule(c.id, { nature: n }), 'Nature modifiée', c.code) })),
          ]
        : []),
      ...(v.droits.designerChef && c.chef ? [{ label: 'Retirer le chef', onSelect: () => setRetrait(c) }] : []),
      ...(v.droits.structure
        ? [
            { label: c.actif ? 'Suspendre' : 'Réactiver', onSelect: () => agir(c.actif ? suspendCellule(c.id) : reactivateCellule(c.id), c.actif ? 'Cellule suspendue' : 'Cellule réactivée', c.nom) },
            { label: 'Supprimer', danger: true, onSelect: () => window.confirm(`Supprimer « ${c.nom} » ?`) && agir(deleteCellule(c.id), 'Cellule supprimée', c.nom) },
          ]
        : []),
    ];
    return (
      <li key={c.id} data-testid="carte-cellule" className={`rounded-xl border bg-surface p-3.5 ${c.chef ? 'border-line' : 'border-clay'} ${garde(c) ? '' : 'hidden'}`}>
        {!c.chef && (
          <div className="-mx-3.5 -mt-3.5 mb-2.5 flex items-center justify-between rounded-t-xl bg-clay-50 px-3.5 py-1.5 text-[12px] font-semibold text-clay" data-testid="sans-responsable">
            Sans responsable
            {v.droits.designerChef && c.actif && (
              <button type="button" className={BTN_LIGNE_PRINCIPAL} onClick={() => setDesigner(c)}>
                Désigner
              </button>
            )}
          </div>
        )}
        <div className="flex items-start gap-3">
          <span className="grid h-11 min-w-11 place-items-center rounded-[9px] border-2 border-dashed border-line-fort px-1.5 font-heading text-[12.5px] font-extrabold text-ink-900">{c.code}</span>
          <div className="min-w-0 flex-1">
            <b className="block text-[14px] font-bold leading-tight text-ink-900">{c.nom}</b>
            <span className="mt-1 flex flex-wrap gap-1">
              <Pastille ton="encre" testid="nature-cellule">
                {c.libelleNature}
              </Pastille>
              {!c.actif && <Pastille ton="gris">Suspendue</Pastille>}
            </span>
          </div>
          {actions.length > 0 && <MenuActions libelle={`Plus d’actions pour ${c.code}`} actions={actions} />}
        </div>
        {c.chef && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
            <span>
              Responsable : <b>{c.chef.nom}</b>
              {c.chef.suppleant && <span className="text-text-muted"> · suppléé par {c.chef.suppleant}</span>}
            </span>
            {v.droits.designerChef && (
              <button type="button" className={BTN_LIGNE} onClick={() => setDesigner(c)}>
                Changer
              </button>
            )}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-text-muted" data-testid="equipe-cellule">
          {c.equipe.slice(0, 8).map((m) => (
            <span key={m.id} title={m.nom}>
              <Initiales texte={m.initiales} taille={26} />
            </span>
          ))}
          <span>{c.membresExternes ? 'membres d’autres institutions' : pluriel(c.agents, 'agent')}</span>
          {c.enConge > 0 && <span>· {c.enConge} en congé aujourd’hui</span>}
        </div>
        {c.roles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1" data-testid="roles-cellule">
            {c.roles.map((r) => (
              <Pastille key={r} ton="vert">
                {r}
              </Pastille>
            ))}
          </div>
        )}
      </li>
    );
  };

  return (
    <div data-testid="onglet-cellules">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrer les cellules" className="flex rounded-[9px] border border-line bg-surface p-[3px]">
          {(
            [
              ['toutes', 'Toutes'],
              ['sansResponsable', 'Sans responsable'],
              ['suspendues', 'Suspendues'],
            ] as const
          ).map(([cle, libelle]) => (
            <button key={cle} type="button" aria-pressed={filtre === cle} onClick={() => setFiltre(cle)} className={`h-7 rounded-[6px] px-[11px] text-[13px] font-semibold ${filtre === cle ? 'bg-ink text-white' : 'text-text-muted hover:text-ink'}`}>
              {libelle}
            </button>
          ))}
        </div>
        {v.droits.structure && (
          <button type="button" className={`${BTN_SECONDAIRE} ml-auto`} onClick={() => setNouvelle(true)}>
            <Plus aria-hidden size={15} /> Nouvelle cellule ou instance
          </button>
        )}
      </div>
      <p className="mb-3 text-[12.5px] text-text-muted">Structures d’appui, à côté des divisions et non au-dessus.</p>
      {(['DN', 'DNA'] as const).map((r) => (
        <section key={r} className="mb-4" aria-label={r === 'DN' ? 'Rattachées au DN' : 'Rattachées à la DNA'} data-testid={`groupe-${r}`}>
          <h2 className="mb-2 text-[14px] font-bold text-ink-900">{r === 'DN' ? 'Rattachées au DN' : 'Rattachées à la DNA'}</h2>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{v.cellules.filter((c) => c.rattachement === r).map(carte)}</ul>
        </section>
      ))}
      {nouvelle && (
        <OrgEntityFormModal
          title="Nouvelle cellule ou instance"
          codeHint="2 à 10 lettres majuscules, ex. CSID"
          libelleValider="Créer"
          onClose={() => setNouvelle(false)}
          onSubmit={async (code, name) => {
            await createCellule({ code, name });
            setNouvelle(false);
            await recharger();
            toast.succes('Unité créée', { detail: `${code} — ${name} (rattachée au DN ; modifiable par le menu ⋯).` });
          }}
        />
      )}
      {retrait && retrait.chef && (
        <RetirerChefModal
          cellule={{ id: retrait.id, code: retrait.code, name: retrait.nom, chefId: retrait.chef.id, isActive: retrait.actif }}
          chef={retrait.chef.nom}
          onClose={() => setRetrait(null)}
          onDone={() => {
            const c = retrait;
            setRetrait(null);
            void recharger();
            toast.succes('Chef retiré', { detail: `${c.nom} n’a plus de chef ; la personne a été prévenue.` });
          }}
        />
      )}
      {designer && (
        <DesignerChef
          unite={designer.code}
          role="CHEF_CELLULE"
          rattachement={{ divisionId: null, sectionId: null, celluleId: designer.id, supervisorId: null }}
          onClose={() => setDesigner(null)}
          onFait={() => {
            setDesigner(null);
            void recharger();
          }}
        />
      )}
    </div>
  );
}
