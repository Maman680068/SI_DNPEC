'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  creerJourFerie,
  getJoursFeries,
  modifierJourFerie,
  reprendreFetesFixes,
  supprimerJourFerie,
} from '../../lib/api/leaves';
import type { CalendrierFeries, JourFerie } from '../../lib/leaves/types';
import { Button } from '../ui/Button';
import { Chargement, messageChargement } from '../ui/ErreurChargement';

const champ = 'rounded-md border border-line bg-surface px-3 py-2 text-[13px]';
const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
const NATURE = { FIXE: 'Fête fixe', RELIGIEUX: 'Fête religieuse' } as const;

/** Calendrier des jours fériés (socle N3) : lu par tous, tenu par l'administrateur et le DRH. */
export function JoursFeries({ anneeInitiale }: { anneeInitiale: number }) {
  const [annee, setAnnee] = useState(anneeInitiale);
  const [c, setC] = useState<CalendrierFeries | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState({
    date: '',
    libelle: '',
    nature: 'RELIGIEUX' as 'FIXE' | 'RELIGIEUX',
  });
  const [edition, setEdition] = useState<JourFerie | null>(null);

  const charger = useCallback(() => {
    setErreur(null);
    getJoursFeries(annee)
      .then(setC)
      .catch((e) => setErreur(messageChargement(e)));
  }, [annee]);
  useEffect(() => {
    charger();
  }, [charger]);
  const agir = (p: Promise<unknown>) =>
    p.then(charger).catch((e) => setErreur(messageChargement(e)));

  return (
    <section data-testid="jours-feries">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-extrabold">Jours fériés {annee}</h2>
          <p className="text-[12.5px] text-text-muted">
            Exclus du délai d’avis (heures ouvrées) et du décompte des jours de congé.
          </p>
        </div>
        <label className="text-[12.5px] font-semibold">
          Année{' '}
          <select
            className={champ}
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value))}
          >
            {[anneeInitiale - 1, anneeInitiale, anneeInitiale + 1, anneeInitiale + 2].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>
      {erreur && (
        <p className="mb-3 rounded-md bg-clay-soft px-3 py-2 text-[12.5px] text-clay">{erreur}</p>
      )}
      {!c ? (
        <Chargement erreur={erreur} />
      ) : (
        <>
          {c.droits.gerer && !c.religieusesSaisies && (
            <p className="mb-3 rounded-md bg-gold-soft px-3.5 py-2.5 text-[12.5px]" role="status">
              Aucune fête religieuse saisie pour {c.annee} (Tabaski, fin du Ramadan, Maouloud, lundi
              de Pâques…) : ajoutez-les avec leur date de l’année.
            </p>
          )}
          {c.droits.gerer && c.fixesManquantes.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-line px-3.5 py-2.5 text-[12.5px]">
              <span>
                Fêtes fixes absentes : {c.fixesManquantes.map((f) => f.libelle).join(', ')}.
              </span>
              <Button
                className="!px-3 !py-1.5 !text-[12.5px]"
                onClick={() => agir(reprendreFetesFixes(c.annee))}
              >
                Ajouter les fêtes fixes
              </Button>
            </div>
          )}
          {c.jours.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface p-5 text-[13px] text-text-muted">
              Aucun jour férié saisi pour {c.annee}.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {c.jours.map((j) => (
                <li
                  key={j.id}
                  data-testid="jour-ferie"
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                >
                  {edition?.id === j.id ? (
                    <form
                      className="flex flex-1 flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        agir(
                          modifierJourFerie(j.id, {
                            date: edition.date.slice(0, 10),
                            libelle: edition.libelle,
                            nature: edition.nature,
                          }),
                        ).then(() => setEdition(null));
                      }}
                    >
                      <input
                        aria-label="Date"
                        type="date"
                        className={champ}
                        value={edition.date.slice(0, 10)}
                        onChange={(e) => setEdition({ ...edition, date: e.target.value })}
                        required
                      />
                      <input
                        aria-label="Libellé"
                        className={`${champ} min-w-[180px] flex-1`}
                        value={edition.libelle}
                        onChange={(e) => setEdition({ ...edition, libelle: e.target.value })}
                        required
                      />
                      <Button
                        variant="solid"
                        type="submit"
                        className="!px-3 !py-1.5 !text-[12.5px]"
                      >
                        Enregistrer
                      </Button>
                      <Button
                        type="button"
                        className="!px-3 !py-1.5 !text-[12.5px]"
                        onClick={() => setEdition(null)}
                      >
                        Annuler
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div>
                        <div className="text-[13.5px] font-semibold first-letter:uppercase">
                          {dateLongue(j.date)}
                        </div>
                        <div className="text-[12px] text-text-muted">
                          {j.libelle} · {NATURE[j.nature]}
                        </div>
                      </div>
                      {c.droits.gerer && (
                        <div className="flex gap-2">
                          <Button
                            className="!px-2.5 !py-1 !text-[12px]"
                            onClick={() => setEdition(j)}
                          >
                            Modifier
                          </Button>
                          <Button
                            className="!px-2.5 !py-1 !text-[12px]"
                            onClick={() => {
                              if (window.confirm(`Supprimer « ${j.libelle} » ?`))
                                agir(supprimerJourFerie(j.id));
                            }}
                          >
                            Supprimer
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {c.droits.gerer && (
            <form
              className="mt-4 flex flex-wrap items-end gap-2.5 rounded-lg border border-line bg-surface p-4"
              onSubmit={(e) => {
                e.preventDefault();
                agir(creerJourFerie(nouveau)).then(() =>
                  setNouveau({ date: '', libelle: '', nature: 'RELIGIEUX' }),
                );
              }}
            >
              <label className="text-[12.5px] font-semibold">
                Date
                <input
                  type="date"
                  className={`${champ} mt-1 block`}
                  value={nouveau.date}
                  onChange={(e) => setNouveau({ ...nouveau, date: e.target.value })}
                  required
                />
              </label>
              <label className="min-w-[200px] flex-1 text-[12.5px] font-semibold">
                Libellé
                <input
                  className={`${champ} mt-1 block w-full`}
                  value={nouveau.libelle}
                  onChange={(e) => setNouveau({ ...nouveau, libelle: e.target.value })}
                  placeholder="Ex. Tabaski"
                  required
                  minLength={2}
                />
              </label>
              <label className="text-[12.5px] font-semibold">
                Nature
                <select
                  className={`${champ} mt-1 block`}
                  value={nouveau.nature}
                  onChange={(e) =>
                    setNouveau({ ...nouveau, nature: e.target.value as 'FIXE' | 'RELIGIEUX' })
                  }
                >
                  <option value="RELIGIEUX">Fête religieuse</option>
                  <option value="FIXE">Fête fixe</option>
                </select>
              </label>
              <Button variant="solid" type="submit">
                Ajouter le jour férié
              </Button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
