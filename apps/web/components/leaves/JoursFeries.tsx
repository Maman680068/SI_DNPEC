'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ajouterJoursFeriesLot,
  creerJourFerie,
  getJoursFeries,
  modifierJourFerie,
  recalculerConge,
  reprendreFetesFixes,
  supprimerJourFerie,
} from '../../lib/api/leaves';
import type { CalendrierFeries, CongesARecalculer, JourFerie } from '../../lib/leaves/types';
import { BandeCompteurs, BTN_LIGNE, BTN_PRINCIPAL, BTN_SECONDAIRE, EtatVide, Pastille } from '../ui/Charte';
import { Chargement, messageChargement } from '../ui/ErreurChargement';
import { Case, ChampDate, ChoixSegment, FenetreFormulaire, Saisie } from '../ui/Formulaire';
import { MenuActions } from '../ui/MenuActions';
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
function FenetreJourFerie({ jour, onClose, onFait }: { jour: JourFerie | null; onClose: () => void; onFait: (libelle: string, aRecalculer: CongesARecalculer) => void }) {
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
      const r = jour ? await modifierJourFerie(jour.id, donnees) : await creerJourFerie(donnees);
      onFait(donnees.libelle, r.aRecalculer);
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

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const dateCourte = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** « Vérifier et ajouter » : fêtes religieuses proposées (lundi de Pâques calculé, autres estimées), cases et dates modifiables. */
function FenetreReligieuses({ c, onClose, onFait }: { c: CalendrierFeries; onClose: () => void; onFait: (n: number) => void }) {
  const proposees = c.religieusesProposees.filter((f) => !f.dejaSaisie);
  const [choix, setChoix] = useState(() => Object.fromEntries(proposees.map((f) => [f.cle, { coche: !!f.date && f.cle !== 'LENDEMAIN_TABASKI', date: f.date ?? '' }])));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <FenetreFormulaire
      titre={`Fêtes religieuses ${c.annee}`}
      sousTitre="Dates « à vérifier » : estimées d’après le calendrier lunaire ; corrigez-les selon le décret de l’année."
      onClose={onClose}
      largeur={640}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Ajouter les fêtes cochées"
      testid="fenetre-religieuses"
      pied="Seules les fêtes cochées, avec une date, sont ajoutées ; aucune n’est ajoutée deux fois."
      onSubmit={async () => {
        const jours = proposees.filter((f) => choix[f.cle]?.coche && choix[f.cle]?.date).map((f) => ({ date: choix[f.cle]!.date, libelle: f.libelle.replace(/ \(si décrété\)$/, ''), nature: 'RELIGIEUX' as const }));
        if (!jours.length) return setErreur('Cochez au moins une fête et indiquez sa date.');
        setEnCours(true);
        setErreur(null);
        try {
          const r = await ajouterJoursFeriesLot(c.annee, jours);
          onFait(r.ajoutes);
        } catch (e) {
          setErreur(messageErreur(e));
        } finally {
          setEnCours(false);
        }
      }}
    >
      {proposees.length === 0 && <p className="text-[13px] text-text-muted">Toutes les fêtes religieuses proposées sont déjà saisies.</p>}
      {proposees.map((f) => (
        <div key={f.cle} className="mb-2 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_220px]" data-testid="fete-proposee">
          <div className="pb-3.5">
            <Case id={`rel-${f.cle}`} label={<>{f.libelle} {f.aVerifier ? <Pastille ton="ambre">À vérifier</Pastille> : <Pastille ton="vert">Calculée</Pastille>}</>} checked={!!choix[f.cle]?.coche} onChange={(v) => setChoix((o) => ({ ...o, [f.cle]: { ...o[f.cle]!, coche: v } }))} />
          </div>
          <ChampDate id={`rel-date-${f.cle}`} label="Date" facultatif value={choix[f.cle]?.date ?? ''} onChange={(v) => setChoix((o) => ({ ...o, [f.cle]: { ...o[f.cle]!, date: v } }))} raccourcis={false} />
        </div>
      ))}
    </FenetreFormulaire>
  );
}

/** Vue annuelle : 12 mini-calendriers (fête fixe en bleu, religieuse en vert, aujourd'hui entouré). */
function VueAnnuelle({ annee, jours }: { annee: number; jours: JourFerie[] }) {
  const parDate = new Map(jours.map((j) => [j.date.slice(0, 10), j]));
  const auj = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="vue-annuelle">
      {MOIS.map((m, mi) => {
        const premier = new Date(Date.UTC(annee, mi, 1));
        const decalage = (premier.getUTCDay() + 6) % 7;
        const nb = new Date(Date.UTC(annee, mi + 1, 0)).getUTCDate();
        return (
          <section key={m} className="rounded-lg border border-line bg-surface p-2.5" aria-label={`${m} ${annee}`}>
            <h3 className="mb-1.5 text-[13px] font-bold capitalize text-ink-900">{m}</h3>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
              {JOURS_COURTS.map((j, k) => (
                <span key={k} className="font-semibold text-text-muted">{j}</span>
              ))}
              {Array.from({ length: decalage }, (_, k) => <span key={`v${k}`} />)}
              {Array.from({ length: nb }, (_, k) => {
                const iso = `${annee}-${String(mi + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`;
                const f = parDate.get(iso);
                const ton = f ? (f.nature === 'FIXE' ? 'bg-bleu-50 font-bold text-bleu' : 'bg-sage-50 font-bold text-sage') : 'text-text';
                return (
                  <span key={iso} title={f ? f.libelle : undefined} data-ferie={f ? f.nature : undefined} className={`grid h-6 place-items-center rounded ${ton} ${iso === auj ? 'ring-2 ring-ink' : ''}`}>
                    {k + 1}
                  </span>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Congés approuvés à recalculer (DRH : congé par congé ; administrateur : le nombre seulement). */
function CongesAReclaculer({ a, peutRecalculer, onFait }: { a: CongesARecalculer; peutRecalculer: boolean; onFait: () => void }) {
  const toast = useToast();
  if (!a.nombre) return null;
  return (
    <div className="mb-3 rounded-md border border-gold-bord bg-gold-50 px-3.5 py-2.5 text-[12.5px]" data-testid="conges-a-recalculer" role="status">
      <p className="font-semibold">
        {a.nombre} congé{a.nombre > 1 ? 's' : ''} approuvé{a.nombre > 1 ? 's' : ''} ne correspond{a.nombre > 1 ? 'ent' : ''} plus au calendrier : le nombre de jours a été arrêté à l’approbation.
        {!peutRecalculer && ' Le DRH les recalcule un par un.'}
      </p>
      {peutRecalculer && (
        <ul className="mt-2 divide-y divide-line-doux">
          {a.conges.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-1.5" data-testid="conge-a-recalculer">
              <span className="min-w-0 flex-1">
                <b>{c.agent}</b> · du {dateCourte(c.debut)} au {dateCourte(c.fin)} · {c.joursEnregistres} j enregistrés → {c.joursRecalcules} j selon le calendrier
              </span>
              <button
                type="button"
                className={BTN_LIGNE}
                onClick={() =>
                  recalculerConge(c.id)
                    .then((r) => {
                      toast.succes('Congé recalculé', { detail: `${c.agent} : ${r.joursAvant} → ${r.joursApres} jours, solde ajusté.` });
                      onFait();
                    })
                    .catch((e) => toast.erreur('Recalcul impossible', messageErreur(e)))
                }
              >
                Recalculer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Calendrier des jours fériés (socle N3, refait en S6) : lu par tous, tenu par l'administrateur et le DRH.
 * Navigation ‹ année ›, « Préparer [année + 1] », quatre chiffres, liste par mois ou vue annuelle,
 * « Vérifier et ajouter » les fêtes religieuses, congés approuvés à recalculer.
 */
export function JoursFeries({ anneeInitiale }: { anneeInitiale: number }) {
  const toast = useToast();
  const [annee, setAnnee] = useState(anneeInitiale);
  const [c, setC] = useState<CalendrierFeries | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vue, setVue] = useState<'liste' | 'annee'>('liste');
  const [fenetre, setFenetre] = useState<{ jour: JourFerie | null } | null>(null);
  const [religieuses, setReligieuses] = useState(false);
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

  const signalerConges = (a: CongesARecalculer) => {
    if (a.nombre) toast.succes('Congés à recalculer', { detail: `${a.nombre} congé${a.nombre > 1 ? 's' : ''} approuvé${a.nombre > 1 ? 's' : ''} concerné${a.nombre > 1 ? 's' : ''} : voir la liste au-dessus du calendrier.` });
  };

  async function preparer(a: number) {
    try {
      await reprendreFetesFixes(a);
      setAnnee(a);
      toast.succes(`Calendrier ${a} préparé`, { detail: 'Fêtes fixes ajoutées ; vérifiez ensuite les fêtes religieuses.' });
    } catch (e) {
      toast.erreur('Action impossible', messageErreur(e));
    }
  }

  async function supprimer() {
    if (!aSupprimer) return;
    setSuppression(true);
    setErreurSuppression(null);
    try {
      const r = await supprimerJourFerie(aSupprimer.id);
      toast.succes('Jour férié supprimé', { detail: `${aSupprimer.libelle} est de nouveau décompté des congés.` });
      signalerConges(r.aRecalculer);
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreurSuppression(messageErreur(e));
    } finally {
      setSuppression(false);
    }
  }

  const parMois = MOIS.map((m, i) => ({ m, jours: (c?.jours ?? []).filter((j) => Number(j.date.slice(5, 7)) === i + 1) })).filter((x) => x.jours.length);

  return (
    <section data-testid="jours-feries">
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Année précédente" className="grid h-9 w-9 place-items-center rounded-[9px] border border-line bg-surface hover:bg-bg" onClick={() => setAnnee((a) => a - 1)}>
            <ChevronLeft aria-hidden size={17} />
          </button>
          <h2 className="min-w-[160px] text-center text-[16px] font-extrabold" data-testid="annee-feries">
            Jours fériés {annee}
          </h2>
          <button type="button" aria-label="Année suivante" className="grid h-9 w-9 place-items-center rounded-[9px] border border-line bg-surface hover:bg-bg" onClick={() => setAnnee((a) => a + 1)}>
            <ChevronRight aria-hidden size={17} />
          </button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Affichage" className="flex rounded-[9px] border border-line bg-surface p-[3px]">
            {(
              [
                ['liste', 'Liste'],
                ['annee', 'Vue annuelle'],
              ] as const
            ).map(([cle, libelle]) => (
              <button key={cle} type="button" aria-pressed={vue === cle} onClick={() => setVue(cle)} className={`h-7 rounded-[6px] px-[11px] text-[13px] font-semibold ${vue === cle ? 'bg-ink text-white' : 'text-text-muted hover:text-ink'}`}>
                {libelle}
              </button>
            ))}
          </div>
          {c?.droits.gerer && (
            <>
              <button type="button" className={BTN_SECONDAIRE} onClick={() => preparer(annee + 1)}>
                Préparer {annee + 1}
              </button>
              <button type="button" className={BTN_PRINCIPAL} onClick={() => setFenetre({ jour: null })}>
                <CalendarPlus aria-hidden size={16} />
                Ajouter un jour férié
              </button>
            </>
          )}
        </div>
      </div>
      <p className="-mt-1.5 mb-3 text-[12.5px] text-text-muted">Exclus du délai d’avis (heures ouvrées) et du décompte des jours de congé.</p>
      {erreur && <p className="mb-3 rounded-md bg-clay-soft px-3 py-2 text-[12.5px] text-clay">{erreur}</p>}
      {!c ? (
        <Chargement erreur={erreur} />
      ) : (
        <>
          <BandeCompteurs
            label={`Jours fériés ${c.annee}`}
            items={[
              { valeur: c.prochain ? dateCourte(c.prochain.date) : '—', label: 'Prochain jour férié', sous: c.prochain ? `${c.prochain.libelle} · ${c.prochain.dansJours === 0 ? 'aujourd’hui' : `dans ${c.prochain.dansJours} jour${c.prochain.dansJours > 1 ? 's' : ''}`}` : 'aucun saisi', ton: 'encre' },
              { valeur: c.chiffres.saisis, label: 'Jours saisis', sous: `en ${c.annee}` },
              { valeur: c.chiffres.enSemaine, label: 'En semaine', sous: 'retirés des délais d’avis et des congés', ton: 'vert' },
              { valeur: c.chiffres.weekEnd, label: 'En week-end', sous: 'sans effet sur les délais d’avis', ton: 'gris' },
            ]}
          />
          <CongesAReclaculer a={c.aRecalculer} peutRecalculer={c.droits.recalculer} onFait={charger} />
          {c.droits.gerer && !c.religieusesSaisies && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-gold-soft px-3.5 py-2.5 text-[12.5px]" role="status">
              <span>Aucune fête religieuse saisie pour {c.annee} (Tabaski, Korité, Maouloud, lundi de Pâques…).</span>
              <button type="button" className={`${BTN_SECONDAIRE} !h-8 !text-[12.5px]`} onClick={() => setReligieuses(true)}>
                Vérifier et ajouter
              </button>
            </div>
          )}
          {c.droits.gerer && c.fixesManquantes.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-line px-3.5 py-2.5 text-[12.5px]">
              <span>Fêtes fixes absentes : {c.fixesManquantes.map((f) => f.libelle).join(', ')}.</span>
              <button type="button" className={`${BTN_SECONDAIRE} !h-8 !text-[12.5px]`} onClick={() => reprendreFetesFixes(c.annee).then(charger).catch((e) => toast.erreur('Action impossible', messageErreur(e)))}>
                Ajouter les fêtes fixes
              </button>
            </div>
          )}
          {vue === 'annee' ? (
            <VueAnnuelle annee={c.annee} jours={c.jours} />
          ) : c.jours.length === 0 ? (
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
            <div className="space-y-3">
              {parMois.map(({ m, jours }) => (
                <Fragment key={m}>
                  <h3 className="text-[13px] font-bold capitalize text-text-muted">{m}</h3>
                  <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                    {jours.map((j) => {
                      const d = new Date(`${j.date.slice(0, 10)}T00:00:00Z`);
                      return (
                        <li key={j.id} data-testid="jour-ferie" data-passe={j.passe ? 'oui' : undefined} data-prochain={j.prochain ? 'oui' : undefined} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${j.passe ? 'opacity-60' : ''} ${j.prochain ? 'bg-ink-50' : ''}`}>
                          <span className="grid h-11 w-11 flex-none place-items-center rounded-[9px] border border-line bg-surface text-center leading-tight">
                            <b className="text-[16px] text-ink-900">{d.getUTCDate()}</b>
                            <small className="text-[10.5px] uppercase text-text-muted">{d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' })}</small>
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-semibold first-letter:uppercase">{j.libelle}</div>
                            <div className="mt-0.5 flex flex-wrap gap-1.5 text-[12px] text-text-muted">
                              <span className="sr-only">{dateLongue(j.date)}</span>
                              <Pastille ton={j.nature === 'FIXE' ? 'bleu' : 'vert'}>{NATURE[j.nature]}</Pastille>
                              {j.weekEnd && <Pastille ton="gris">Week-end · sans effet sur les délais</Pastille>}
                              {j.prochain && <Pastille ton="encre">Prochain</Pastille>}
                            </div>
                          </div>
                          {c.droits.gerer && (
                            <MenuActions
                              libelle={`Actions sur ${j.libelle}`}
                              actions={[
                                { label: 'Modifier', onSelect: () => setFenetre({ jour: j }) },
                                { label: 'Supprimer', danger: true, onSelect: () => setASupprimer(j) },
                              ]}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Fragment>
              ))}
            </div>
          )}
        </>
      )}
      {fenetre && (
        <FenetreJourFerie
          jour={fenetre.jour}
          onClose={() => setFenetre(null)}
          onFait={(libelle, a) => {
            toast.succes(fenetre.jour ? 'Jour férié modifié' : 'Jour férié ajouté', { detail: `${libelle} n’est pas décompté des congés.` });
            signalerConges(a);
            setFenetre(null);
            charger();
          }}
        />
      )}
      {religieuses && c && (
        <FenetreReligieuses
          c={c}
          onClose={() => setReligieuses(false)}
          onFait={(n) => {
            setReligieuses(false);
            toast.succes('Fêtes religieuses ajoutées', { detail: `${n} jour${n > 1 ? 's' : ''} férié${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''}.` });
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
