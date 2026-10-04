'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import {
  creerJourFerie,
  getJoursFeries,
  modifierJourFerie,
  reprendreFetesFixes,
  supprimerJourFerie,
} from '../../lib/api/leaves';
import type { CalendrierFeries, JourFerie } from '../../lib/leaves/types';
import { BTN_LIGNE, BTN_PRINCIPAL, BTN_SECONDAIRE, EtatVide, FiltreSelect, Filtres } from '../ui/Charte';
import { Chargement, messageChargement } from '../ui/ErreurChargement';
import { ChampDate, ChoixSegment, FenetreFormulaire, Saisie } from '../ui/Formulaire';
import { Fenetre } from '../ui/Fenetre';
import { messageErreur, useToast } from '../ui/Toast';

type Nature = 'FIXE' | 'RELIGIEUX';
const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
const NATURE: Record<Nature, string> = { FIXE: 'Fête fixe', RELIGIEUX: 'Fête religieuse' };

/** Ajout ou modification d'un jour férié (date, libellé, nature). */
function FenetreJourFerie({ jour, onClose, onFait }: { jour: JourFerie | null; onClose: () => void; onFait: (libelle: string) => void }) {
  const [date, setDate] = useState(jour ? jour.date.slice(0, 10) : '');
  const [libelle, setLibelle] = useState(jour?.libelle ?? '');
  const [nature, setNature] = useState<Nature>(jour?.nature ?? 'RELIGIEUX');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    try {
      const donnees = { date, libelle: libelle.trim(), nature };
      if (jour) await modifierJourFerie(jour.id, donnees);
      else await creerJourFerie(donnees);
      onFait(donnees.libelle);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }
  return (
    <FenetreFormulaire
      titre={jour ? 'Modifier le jour férié' : 'Ajouter un jour férié'}
      largeur={560}
      onClose={onClose}
      onSubmit={enregistrer}
      libelleValider={jour ? 'Enregistrer' : 'Ajouter le jour férié'}
      enCours={enCours}
      erreur={erreur}
      testid="fenetre-jour-ferie"
      pied="Exclu aussitôt du décompte des congés et des délais d’avis."
    >
      <ChampDate id="ferie-date" label="Date" value={date} onChange={setDate} required raccourcis={false} messageObligatoire="Indiquez la date du jour férié." />
      <Saisie id="ferie-libelle" label="Libellé" value={libelle} onChange={setLibelle} required placeholder="Ex. Tabaski" maxLength={120} messageObligatoire="Indiquez le nom du jour férié." />
      <ChoixSegment<Nature>
        id="ferie-nature"
        label="Nature"
        value={nature}
        onChange={setNature}
        options={[
          { value: 'RELIGIEUX', label: NATURE.RELIGIEUX },
          { value: 'FIXE', label: NATURE.FIXE },
        ]}
      />
    </FenetreFormulaire>
  );
}

/** Calendrier des jours fériés (socle N3) : lu par tous, tenu par l'administrateur et le DRH. */
export function JoursFeries({ anneeInitiale }: { anneeInitiale: number }) {
  const toast = useToast();
  const [annee, setAnnee] = useState(anneeInitiale);
  const [c, setC] = useState<CalendrierFeries | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<{ jour: JourFerie | null } | null>(null);
  const [aSupprimer, setASupprimer] = useState<JourFerie | null>(null);
  const [suppression, setSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);

  const charger = useCallback(() => {
    setErreur(null);
    getJoursFeries(annee)
      .then(setC)
      .catch((e) => setErreur(messageChargement(e)));
  }, [annee]);
  useEffect(() => {
    charger();
  }, [charger]);

  async function reprendre(a: number) {
    try {
      await reprendreFetesFixes(a);
      charger();
      toast.succes('Fêtes fixes ajoutées', { detail: `Calendrier ${a} complété.` });
    } catch (e) {
      toast.erreur('Action impossible', messageErreur(e));
    }
  }

  async function supprimer() {
    if (!aSupprimer) return;
    setSuppression(true);
    setErreurSuppression(null);
    try {
      await supprimerJourFerie(aSupprimer.id);
      toast.succes('Jour férié supprimé', { detail: `${aSupprimer.libelle} est de nouveau décompté des congés.` });
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreurSuppression(messageErreur(e));
    } finally {
      setSuppression(false);
    }
  }

  const annees = [anneeInitiale - 1, anneeInitiale, anneeInitiale + 1, anneeInitiale + 2];

  return (
    <section data-testid="jours-feries">
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-extrabold">Jours fériés {annee}</h2>
          <p className="text-[12.5px] text-text-muted">Exclus du délai d’avis (heures ouvrées) et du décompte des jours de congé.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filtres actifs={annee !== anneeInitiale ? 1 : 0} onEffacer={() => setAnnee(anneeInitiale)}>
            <FiltreSelect<string>
              label="Année"
              value={String(annee)}
              defaut={String(anneeInitiale)}
              onChange={(v) => setAnnee(Number(v))}
              options={annees.map((a) => ({ value: String(a), label: `Année ${a}` }))}
            />
          </Filtres>
          {c?.droits.gerer && (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setFenetre({ jour: null })}>
              <CalendarPlus aria-hidden size={16} />
              Ajouter un jour férié
            </button>
          )}
        </div>
      </div>
      {erreur && <p className="mb-3 rounded-md bg-clay-soft px-3 py-2 text-[12.5px] text-clay">{erreur}</p>}
      {!c ? (
        <Chargement erreur={erreur} />
      ) : (
        <>
          {c.droits.gerer && !c.religieusesSaisies && (
            <p className="mb-3 rounded-md bg-gold-soft px-3.5 py-2.5 text-[12.5px]" role="status">
              Aucune fête religieuse saisie pour {c.annee} (Tabaski, fin du Ramadan, Maouloud, lundi de Pâques…) : ajoutez-les avec leur date de l’année.
            </p>
          )}
          {c.droits.gerer && c.fixesManquantes.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-line px-3.5 py-2.5 text-[12.5px]">
              <span>Fêtes fixes absentes : {c.fixesManquantes.map((f) => f.libelle).join(', ')}.</span>
              <button type="button" className={`${BTN_SECONDAIRE} !h-8 !text-[12.5px]`} onClick={() => reprendre(c.annee)}>
                Ajouter les fêtes fixes
              </button>
            </div>
          )}
          {c.jours.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface">
              <EtatVide
                texte={`Aucun jour férié saisi pour ${c.annee}.`}
                action={
                  c.droits.gerer ? (
                    <button type="button" className={`${BTN_SECONDAIRE} !h-8 !text-[13px]`} onClick={() => setFenetre({ jour: null })}>
                      Ajouter un jour férié
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {c.jours.map((j) => (
                <li key={j.id} data-testid="jour-ferie" className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold first-letter:uppercase">{dateLongue(j.date)}</div>
                    <div className="text-[12px] text-text-muted">
                      {j.libelle} · {NATURE[j.nature]}
                    </div>
                  </div>
                  {c.droits.gerer && (
                    <div className="flex gap-2">
                      <button type="button" className={BTN_LIGNE} aria-label={`Modifier ${j.libelle}`} onClick={() => setFenetre({ jour: j })}>
                        Modifier
                      </button>
                      <button type="button" className={BTN_LIGNE} aria-label={`Supprimer ${j.libelle}`} onClick={() => setASupprimer(j)}>
                        Supprimer
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {fenetre && (
        <FenetreJourFerie
          jour={fenetre.jour}
          onClose={() => setFenetre(null)}
          onFait={(libelle) => {
            toast.succes(fenetre.jour ? 'Jour férié modifié' : 'Jour férié ajouté', { detail: `${libelle} n’est pas décompté des congés.` });
            setFenetre(null);
            charger();
          }}
        />
      )}
      {aSupprimer && (
        <Fenetre
          titre="Supprimer le jour férié"
          onClose={() => setASupprimer(null)}
          onSubmit={supprimer}
          libelleValider="Supprimer"
          danger
          enCours={suppression}
          erreur={erreurSuppression}
          pied="Cette date sera de nouveau décomptée des congés demandés ensuite."
        >
          <p className="text-[13.5px]">
            Supprimer « {aSupprimer.libelle} » ({dateLongue(aSupprimer.date)}) du calendrier ?
          </p>
        </Fenetre>
      )}
    </section>
  );
}
