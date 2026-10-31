'use client';

import { useCallback, useEffect, useState } from 'react';
import { getVueOrganisation, type VueOrganisation } from '../../../lib/api/org';
import { useEcranLarge } from '../../../lib/navigation/bandeau';
import { SchemaOrganigramme } from '../../../components/organisation/SchemaOrganigramme';
import { OngletDivisions } from '../../../components/organisation/OngletDivisions';
import { OngletCellules } from '../../../components/organisation/OngletCellules';
import { Organigramme } from '../../../components/socle/Organigramme';
import { EnTetePage, Onglets } from '../../../components/ui/Charte';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';

type Tab = 'organigramme' | 'divisions' | 'cellules';

/**
 * Organisation (S8) : trois onglets lus par tous — organigramme (schéma ou liste ; liste d'office sur
 * téléphone), Divisions & Sections, Cellules. L'administrateur et le DRH agissent, selon les droits renvoyés
 * par l'API (`api/v1/organisation`) ; tous les chiffres sont calculés par l'API.
 */
export default function OrganisationPage() {
  const [tab, setTab] = useState<Tab>('organigramme');
  const [vueSchema, setVueSchema] = useState<'schema' | 'liste'>('schema');
  const [v, setV] = useState<VueOrganisation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const large = useEcranLarge();
  const charger = useCallback(() => {
    getVueOrganisation()
      .then(setV)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
    const o = new URLSearchParams(window.location.search).get('onglet');
    if (o === 'divisions' || o === 'cellules') setTab(o);
  }, [charger]);

  return (
    <div>
      <EnTetePage titre="Organisation" sousTitre="Unités, responsables et effectifs de la DNPEC" />
      <Onglets
        label="Organisation"
        actif={tab}
        onChange={setTab}
        onglets={[
          { cle: 'organigramme', label: 'Organigramme' },
          { cle: 'divisions', label: 'Divisions & Sections' },
          { cle: 'cellules', label: 'Cellules' },
        ]}
      />
      <ErreurChargement message={erreur} />
      {tab === 'organigramme' && (
        <>
          {large && (
            <div role="group" aria-label="Présentation" className="mb-3 inline-flex rounded-[9px] border border-line bg-surface p-[3px] print:hidden">
              {(
                [
                  ['schema', 'Schéma'],
                  ['liste', 'Liste'],
                ] as const
              ).map(([cle, libelle]) => (
                <button key={cle} type="button" aria-pressed={vueSchema === cle} onClick={() => setVueSchema(cle)} className={`h-7 rounded-[6px] px-[11px] text-[13px] font-semibold ${vueSchema === cle ? 'bg-ink text-white' : 'text-text-muted hover:text-ink'}`}>
                  {libelle}
                </button>
              ))}
            </div>
          )}
          {large && vueSchema === 'schema' ? v ? <SchemaOrganigramme v={v} onChange={charger} /> : <Chargement erreur={erreur} /> : <Organigramme />}
        </>
      )}
      {tab === 'divisions' && (v ? <OngletDivisions v={v} onChange={charger} /> : <Chargement erreur={erreur} />)}
      {tab === 'cellules' && (v ? <OngletCellules v={v} onChange={charger} /> : <Chargement erreur={erreur} />)}
    </div>
  );
}
