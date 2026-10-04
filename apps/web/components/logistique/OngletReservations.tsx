'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import {
  annulerReservation,
  creerRessource,
  getDisponibilite,
  getReservation,
  getReservations,
  getRessources,
  modifierRessource,
  refuserReservation,
  reserver,
  validerReservation,
} from '../../lib/api/logistique';
import type { Disponibilite, ModeReservation, Reservation, Ressource, StatutReservation, TypeRessource } from '../../lib/logistique/types';
import { MODE_LABEL, STATUT_RESERVATION_LABEL, TYPE_RESSOURCE_LABEL } from '../../lib/logistique/types';
import { ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { Case, ChampDate, ChoixSegment, FenetreFormulaire, Grille2, Liste, Saisie, ZoneTexte } from '../ui/Formulaire';
import { SqueletteListe } from '../ui/Squelette';
import { messageErreur, useToast } from '../ui/Toast';
import { useEnvoi } from '../courrier/formulaire';
import {
  BTN_DANGER_CONTOUR,
  BTN_LIGNE,
  BTN_LIGNE_PRINCIPAL,
  BTN_PRINCIPAL,
  BTN_SECONDAIRE,
  BarreOutils,
  CleValeur,
  EtatVide,
  LigneTableau,
  Pastille,
  SectionFenetre,
  Tableau,
  type TonPastille,
} from '../ui/Charte';
import { Panneau, SousOnglets, dateHeure, nom, useAction } from './commun';

const TON: Record<StatutReservation, TonPastille> = {
  EN_ATTENTE: 'ambre',
  CONFIRMEE: 'vert',
  REFUSEE: 'rouge',
  ANNULEE: 'gris',
  ANNULEE_PRIORITE: 'rouge',
};
const GRILLE_RES = 'lg:grid-cols-[minmax(0,1fr)_170px_minmax(0,1.2fr)_minmax(0,1fr)_150px]';
const GRILLE_RESSOURCES = 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_100px_minmax(0,1fr)_96px]';
const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const demain = () => {
  const d = new Date(Date.now() + 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Vue = 'reserver' | 'miennes' | 'a_valider' | 'ressources';

export function OngletReservations({ gestionnaire, ouvrirId, onChange }: { gestionnaire: boolean; ouvrirId: string | null; onChange: () => void }) {
  const toast = useToast();
  const [vue, setVue] = useState<Vue>(ouvrirId ? 'miennes' : 'reserver');
  /** Numéro de version des listes : rechargées après chaque action. */
  const [version, setVersion] = useState(0);
  const [ouverte, setOuverte] = useState<Reservation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (ouvrirId) getReservation(ouvrirId).then(setOuverte).catch((e) => setErreur(messageChargement(e)));
  }, [ouvrirId]);
  const options: { cle: Vue; libelle: string }[] = [
    { cle: 'reserver', libelle: 'Réserver' },
    { cle: 'miennes', libelle: 'Mes réservations' },
    ...(gestionnaire
      ? [
          { cle: 'a_valider' as Vue, libelle: 'À valider' },
          { cle: 'ressources' as Vue, libelle: 'Ressources' },
        ]
      : []),
  ];
  const fait = (m: { titre: string; detail?: string; annuler?: () => Promise<void> }) => {
    toast.succes(m.titre, { detail: m.detail, annuler: m.annuler });
    setOuverte(null);
    setVersion((v) => v + 1);
    onChange();
  };
  return (
    <div data-testid="onglet-reservations">
      <ErreurChargement message={erreur} />
      <div className="mb-3.5">
        <SousOnglets valeur={vue} options={options} onChange={setVue} label="Réservations affichées" />
      </div>
      {vue === 'reserver' && (
        <Reserver
          onReserve={(r, prioritaire) => {
            fait({
              titre: r.statut === 'EN_ATTENTE' ? 'Réservation enregistrée' : 'Réservation confirmée',
              detail: r.statut === 'EN_ATTENTE' ? 'En attente de validation par un gestionnaire.' : prioritaire ? 'Les titulaires évincés sont prévenus.' : `${r.ressource.nom}, ${dateHeure(r.debut)}.`,
              // Annulation par la même route que « Annuler la réservation » (titulaire) ; jamais pour une priorité (les réservations évincées ne reviennent pas).
              annuler: prioritaire
                ? undefined
                : async () => {
                    try {
                      await annulerReservation(r.id);
                      toast.succes('Réservation annulée');
                    } catch (e) {
                      toast.erreur('Annulation impossible', messageErreur(e));
                    }
                    setVersion((v) => v + 1);
                    onChange();
                  },
            });
            setVue('miennes');
          }}
        />
      )}
      {(vue === 'miennes' || vue === 'a_valider') && <ListeReservations key={`${vue}-${version}`} vue={vue} onOuvrir={setOuverte} />}
      {vue === 'ressources' && <Ressources />}
      {ouverte && <FicheReservation r={ouverte} onClose={() => setOuverte(null)} onChange={fait} />}
    </div>
  );
}

function Reserver({ onReserve }: { onReserve: (r: Reservation, prioritaire: boolean) => void }) {
  const toast = useToast();
  const [jour, setJour] = useState(demain());
  const [de, setDe] = useState('09:00');
  const [a, setA] = useState('10:00');
  const [type, setType] = useState<TypeRessource | ''>('');
  const [dispo, setDispo] = useState<Disponibilite[] | null>(null);
  const [choix, setChoix] = useState<{ ressource: Disponibilite; prioritaire: boolean } | null>(null);
  const [regle, setRegle] = useState<string | null>(null);
  const { enCours, lancer } = useAction();
  const debut = () => new Date(`${jour}T${de}`).toISOString();
  const fin = () => new Date(`${jour}T${a}`).toISOString();
  const chercher = async () => {
    const manque = !jour ? 'Choisissez le jour.' : !de || !a ? 'Indiquez l’heure de début et l’heure de fin.' : a <= de ? 'L’heure de fin doit suivre l’heure de début.' : null;
    setRegle(manque);
    if (manque) return;
    const r = await lancer(() => getDisponibilite(debut(), fin(), type || undefined), 'Recherche impossible');
    if (r.ok) setDispo(r.valeur);
    else toast.erreur('Recherche impossible', r.erreur);
  };
  return (
    <div>
      <form
        className="mb-4 grid grid-cols-2 items-end gap-x-2.5 rounded-xl border border-line bg-surface p-3.5 pb-0 sm:flex sm:flex-wrap [&>div]:min-w-0"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void chercher();
        }}
      >
        <div className="col-span-2 sm:w-[230px]">
          <ChampDate id="res-jour" label="Jour" value={jour} onChange={setJour} raccourcis={false} />
        </div>
        <div className="sm:w-[110px]">
          <Saisie id="res-de" label="De" type="time" value={de} onChange={setDe} />
        </div>
        <div className="sm:w-[110px]">
          <Saisie id="res-a" label="À" type="time" value={a} onChange={setA} />
        </div>
        <div className="col-span-2 sm:w-[230px]">
          <Liste id="res-type" label="Ressource" value={type} onChange={(v) => setType(v as TypeRessource | '')} vide="Toutes" options={(Object.keys(TYPE_RESSOURCE_LABEL) as TypeRessource[]).map((t) => ({ value: t, label: TYPE_RESSOURCE_LABEL[t] }))} />
        </div>
        <div className="col-span-2 mb-3.5">
          <button type="submit" className={`${BTN_PRINCIPAL} !h-10 w-full sm:w-auto`} disabled={enCours}>
            Voir les disponibilités
          </button>
        </div>
        {regle && (
          <p className="col-span-2 mb-3 w-full text-[12.5px] font-semibold text-clay" data-testid="erreur-champ">
            {regle}
          </p>
        )}
      </form>
      {dispo && dispo.length === 0 && <EtatVide texte="Aucune ressource réservable." />}
      {dispo && dispo.length > 0 && (
        <ul className="grid gap-2.5 sm:grid-cols-2" data-testid="disponibilites">
          {dispo.map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-surface p-3.5" data-testid="ressource">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-semibold">{r.nom}</div>
                  <div className="text-[12px] text-text-muted">
                    {TYPE_RESSOURCE_LABEL[r.type]}
                    {r.capacite ? ` · ${r.capacite} places` : ''} · {MODE_LABEL[r.mode]}
                  </div>
                </div>
                <Pastille ton={r.libre ? 'vert' : 'rouge'}>{r.libre ? 'Libre' : 'Occupée'}</Pastille>
              </div>
              {r.conflits.map((c) => (
                <p key={c.id} className="text-[12.5px] text-text-muted">
                  Réservée par {nom(c.titulaire)} de {heure(c.debut)} à {heure(c.fin)}
                  {c.objet ? ` — ${c.objet}` : ''}
                </p>
              ))}
              <div className="mt-2 flex justify-end">
                {r.libre ? (
                  <button type="button" className={BTN_LIGNE_PRINCIPAL} onClick={() => setChoix({ ressource: r, prioritaire: false })}>
                    Réserver
                  </button>
                ) : r.prioritePossible ? (
                  <button type="button" className={BTN_LIGNE} onClick={() => setChoix({ ressource: r, prioritaire: true })}>
                    Faire valoir la priorité
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {choix && (
        <FenetreReserver
          ressource={choix.ressource}
          prioritaire={choix.prioritaire}
          debut={debut()}
          fin={fin()}
          onClose={() => setChoix(null)}
          onDone={(r) => {
            const prioritaire = choix.prioritaire;
            setChoix(null);
            onReserve(r, prioritaire);
          }}
        />
      )}
    </div>
  );
}

function FenetreReserver({ ressource, prioritaire, debut, fin, onClose, onDone }: { ressource: Disponibilite; prioritaire: boolean; debut: string; fin: string; onClose: () => void; onDone: (r: Reservation) => void }) {
  const [objet, setObjet] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre={prioritaire ? 'Réserver en faisant valoir la priorité' : `Réserver ${ressource.nom}`}
      sousTitre={`${ressource.nom} — du ${dateHeure(debut)} au ${dateHeure(fin)}`}
      onClose={onClose}
      libelleValider={prioritaire ? 'Prendre le créneau' : 'Réserver'}
      danger={prioritaire}
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      pied={
        prioritaire
          ? 'Les titulaires évincés sont prévenus avec votre nom.'
          : ressource.mode === 'VALIDATION'
            ? 'Cette ressource demande la validation d’un gestionnaire : le créneau vous est réservé en attendant.'
            : 'La réservation est confirmée immédiatement.'
      }
      valider={() => (objet.trim().length === 1 ? { 'res-objet': 'Indiquez au moins 2 caractères.' } : {})}
      onSubmit={async () => {
        const r = await envoyer(() => reserver({ ressourceId: ressource.id, debut, fin, objet: objet.trim(), prioritaire: prioritaire || undefined }));
        if (r.ok) onDone(r.valeur);
      }}
    >
      {prioritaire && (
        <div className="mb-3.5 rounded-[10px] border border-[#E7B3BB] bg-clay-50 px-3.5 py-2.5 text-[12.5px] text-clay">
          Ces réservations seront annulées pour priorité, et leurs titulaires prévenus avec votre nom :
          <ul className="mt-1 list-disc pl-5">
            {ressource.conflits.map((c) => (
              <li key={c.id}>
                {nom(c.titulaire)}, de {heure(c.debut)} à {heure(c.fin)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Saisie id="res-objet" label="Objet" value={objet} onChange={setObjet} required maxLength={300} messageObligatoire="Indiquez l’objet de la réservation." placeholder="Réunion de service, formation…" />
    </FenetreFormulaire>
  );
}

function ListeReservations({ vue, onOuvrir }: { vue: 'miennes' | 'a_valider'; onOuvrir: (r: Reservation) => void }) {
  const [liste, setListe] = useState<Reservation[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    getReservations({ vue })
      .then(setListe)
      .catch((e) => setErreur(messageChargement(e)));
  }, [vue]);
  if (erreur) return <ErreurChargement message={erreur} />;
  if (!liste) return <SqueletteListe lignes={4} colonnes={5} />;
  return (
    <Tableau
      label={vue === 'miennes' ? 'Mes réservations' : 'Réservations à valider'}
      grille={GRILLE_RES}
      colonnes={['Ressource', 'Créneau', 'Objet', 'Titulaire', 'Statut']}
      vide={<EtatVide texte={vue === 'miennes' ? 'Aucune réservation.' : 'Aucune réservation en attente.'} />}
    >
      {liste.map((r) => (
        <LigneTableau key={r.id} grille={GRILLE_RES} onClick={() => onOuvrir(r)} testid="ligne-reservation" label={`${r.ressource.nom}, ${dateHeure(r.debut)}`}>
          <span className="block font-semibold">{r.ressource.nom}</span>
          <span className="text-[12.5px]">
            {dateHeure(r.debut)} → {heure(r.fin)}
          </span>
          <span className="block truncate text-[12.5px] text-text-muted">{r.objet ?? 'Réservé'}</span>
          <span className="block text-[12.5px]">
            {nom(r.titulaire)}
            {r.statut === 'ANNULEE_PRIORITE' && r.evinceePar ? <span className="block text-text-muted">priorité de {nom(r.evinceePar)}</span> : null}
          </span>
          <Pastille ton={TON[r.statut]}>{STATUT_RESERVATION_LABEL[r.statut]}</Pastille>
        </LigneTableau>
      ))}
    </Tableau>
  );
}

type Message = { titre: string; detail?: string };

function FicheReservation({ r, onClose, onChange }: { r: Reservation; onClose: () => void; onChange: (m: Message) => void }) {
  const toast = useToast();
  const [refus, setRefus] = useState<'refuser' | 'annuler' | null>(null);
  const [motif, setMotif] = useState('');
  const { enCours, lancer } = useAction();
  const fenetre = useEnvoi();
  const agir = async (fn: () => Promise<unknown>, m: Message) => {
    const x = await lancer(fn, 'Action impossible');
    if (x.ok) onChange(m);
    else toast.erreur('Action impossible', x.erreur);
  };
  if (refus) {
    return (
      <FenetreFormulaire
        titre={refus === 'refuser' ? 'Rejeter la réservation' : 'Annuler la réservation'}
        sousTitre={`${r.ressource.nom} — ${nom(r.titulaire)}, du ${dateHeure(r.debut)} au ${dateHeure(r.fin)}`}
        onClose={() => setRefus(null)}
        libelleValider={refus === 'refuser' ? 'Rejeter' : 'Annuler la réservation'}
        danger
        largeur={560}
        enCours={fenetre.enCours}
        erreur={fenetre.erreur}
        pied="Le titulaire est prévenu avec votre motif."
        valider={() => (motif.trim() && motif.trim().length < 3 ? { 'res-motif': 'Le motif doit compter au moins 3 caractères.' } : {})}
        onSubmit={async () => {
          const x = await fenetre.envoyer(() => (refus === 'refuser' ? refuserReservation(r.id, motif.trim()) : annulerReservation(r.id, motif.trim())));
          if (x.ok) onChange({ titre: refus === 'refuser' ? 'Réservation rejetée' : 'Réservation annulée', detail: `${nom(r.titulaire)} est prévenu(e).` });
        }}
      >
        <ZoneTexte id="res-motif" label="Motif (communiqué au titulaire)" value={motif} onChange={setMotif} required messageObligatoire="Indiquez le motif." />
      </FenetreFormulaire>
    );
  }
  return (
    <Panneau
      titre={r.ressource.nom}
      filAriane={['Logistique', 'Réservations']}
      sousTitre={
        <span className="flex flex-wrap items-center gap-2">
          <Pastille ton={TON[r.statut]}>{STATUT_RESERVATION_LABEL[r.statut]}</Pastille>
          Du {dateHeure(r.debut)} au {dateHeure(r.fin)}
        </span>
      }
      onClose={onClose}
      testid="fiche-reservation"
      cote={
        <>
          {(r.droits.valider || r.droits.refuser || r.droits.annuler) && (
            <div className="mb-[18px] grid gap-2">
              {r.droits.valider && (
                <button type="button" className={`${BTN_PRINCIPAL} w-full`} disabled={enCours} onClick={() => agir(() => validerReservation(r.id), { titre: 'Réservation confirmée', detail: `${nom(r.titulaire)} est prévenu(e).` })}>
                  Valider
                </button>
              )}
              {r.droits.refuser && (
                <button type="button" className={`${BTN_DANGER_CONTOUR} w-full`} disabled={enCours} onClick={() => setRefus('refuser')}>
                  Rejeter avec un motif
                </button>
              )}
              {r.droits.annuler && (
                <button type="button" className={`${BTN_SECONDAIRE} w-full`} disabled={enCours} onClick={() => (r.estTitulaire ? void agir(() => annulerReservation(r.id), { titre: 'Réservation annulée', detail: 'Le créneau est libéré.' }) : setRefus('annuler'))}>
                  Annuler la réservation
                </button>
              )}
            </div>
          )}
          <SectionFenetre titre="Informations" className="">
            <CleValeur largeur={84} lignes={[['Type', TYPE_RESSOURCE_LABEL[r.ressource.type]], ['Mode', MODE_LABEL[r.ressource.mode]], ['Titulaire', nom(r.titulaire)]]} />
          </SectionFenetre>
        </>
      }
    >
      <SectionFenetre titre="Réservation" className="">
        <CleValeur
          largeur={110}
          lignes={
            [
              ['Objet', r.objet ?? '—'],
              r.meeting ? ['Réunion', r.meeting.title] : null,
              r.statut === 'ANNULEE_PRIORITE' ? ['Priorité', <span key="p" className="text-clay">Annulée : {nom(r.evinceePar)} a fait valoir la priorité hiérarchique.</span>] : null,
              r.motifRefus ? ['Refus', <span key="r" className="text-clay">{r.motifRefus}</span>] : null,
              r.motifAnnulation && r.statut === 'ANNULEE' ? ['Annulation', `${r.motifAnnulation} (${nom(r.annuleePar)})`] : null,
            ].filter(Boolean) as [ReactNode, ReactNode][]
          }
        />
      </SectionFenetre>
    </Panneau>
  );
}

function Ressources() {
  const toast = useToast();
  const [liste, setListe] = useState<Ressource[] | null>(null);
  const [edition, setEdition] = useState<Ressource | 'nouvelle' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => {
    getRessources()
      .then(setListe)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);
  return (
    <div>
      <ErreurChargement message={erreur} />
      <BarreOutils
        droite={
          <button type="button" className={BTN_PRINCIPAL} onClick={() => setEdition('nouvelle')}>
            <Plus aria-hidden size={17} />
            Nouvelle ressource
          </button>
        }
      >
        <span className="text-[13px] text-text-muted">Salles et matériel de présentation proposés à la réservation.</span>
      </BarreOutils>
      {!liste && !erreur && <SqueletteListe lignes={4} colonnes={4} />}
      {liste && (
        <Tableau label="Ressources réservables" grille={GRILLE_RESSOURCES} colonnes={['Ressource', 'Type', 'Capacité', 'Mode', <span key="a" className="sr-only">Action</span>]} vide={<EtatVide texte="Aucune ressource : créez les salles et le matériel de présentation." />}>
          {liste.map((r) => (
            <LigneTableau key={r.id} grille={GRILLE_RESSOURCES}>
              <span className="block font-semibold">
                {r.nom} {!r.actif && <Pastille ton="gris">Inactive</Pastille>}
              </span>
              <span className="text-[12.5px] text-text-muted">{TYPE_RESSOURCE_LABEL[r.type]}</span>
              <span className="text-[12.5px] text-text-muted">{r.capacite ? `${r.capacite} places` : '—'}</span>
              <span className="text-[12.5px] text-text-muted">{MODE_LABEL[r.mode]}</span>
              <button type="button" className={BTN_LIGNE} onClick={() => setEdition(r)} aria-label={`Modifier ${r.nom}`}>
                Modifier
              </button>
            </LigneTableau>
          ))}
        </Tableau>
      )}
      {edition && (
        <FenetreRessource
          ressource={edition === 'nouvelle' ? null : edition}
          onClose={() => setEdition(null)}
          onDone={(m) => {
            setEdition(null);
            toast.succes(m);
            charger();
          }}
        />
      )}
    </div>
  );
}

function FenetreRessource({ ressource, onClose, onDone }: { ressource: Ressource | null; onClose: () => void; onDone: (message: string) => void }) {
  const [v, setV] = useState({
    nom: ressource?.nom ?? '',
    type: ressource?.type ?? ('SALLE' as TypeRessource),
    capacite: ressource?.capacite ? String(ressource.capacite) : '',
    mode: ressource?.mode ?? ('IMMEDIATE' as ModeReservation),
    description: ressource?.description ?? '',
    actif: ressource?.actif ?? true,
  });
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre={ressource ? `Modifier ${ressource.nom}` : 'Nouvelle ressource réservable'}
      onClose={onClose}
      libelleValider={ressource ? 'Enregistrer' : 'Créer la ressource'}
      largeur={640}
      enCours={enCours}
      erreur={erreur}
      pied="La ressource est proposée à la réservation dès qu’elle est réservable."
      valider={() => ({
        ...(v.nom.trim().length === 1 ? { 'rs-nom': 'Indiquez au moins 2 caractères.' } : {}),
        ...(v.capacite && !(Number.isInteger(Number(v.capacite)) && Number(v.capacite) >= 1) ? { 'rs-cap': 'Indiquez un nombre entier de places, au moins 1.' } : {}),
      })}
      onSubmit={async () => {
        const capacite = v.capacite ? Number(v.capacite) : null;
        const r = await envoyer(() =>
          ressource
            ? modifierRessource(ressource.id, { nom: v.nom.trim(), capacite, mode: v.mode, description: v.description.trim() || null, actif: v.actif })
            : creerRessource({ nom: v.nom.trim(), type: v.type, capacite: capacite ?? undefined, mode: v.mode, description: v.description.trim() || undefined }),
        );
        if (r.ok) onDone(ressource ? 'Ressource modifiée' : 'Ressource créée');
      }}
    >
      <Saisie id="rs-nom" label="Nom" value={v.nom} onChange={(nom) => setV({ ...v, nom })} required maxLength={200} messageObligatoire="Indiquez le nom de la ressource." />
      {!ressource && (
        <ChoixSegment<TypeRessource> id="rs-type" label="Type" value={v.type} onChange={(type) => setV({ ...v, type })} options={(Object.keys(TYPE_RESSOURCE_LABEL) as TypeRessource[]).map((t) => ({ value: t, label: TYPE_RESSOURCE_LABEL[t] }))} />
      )}
      <Grille2>
        <Saisie id="rs-cap" label="Capacité" facultatif type="number" min={1} value={v.capacite} onChange={(capacite) => setV({ ...v, capacite })} />
        <ChoixSegment<ModeReservation> id="rs-mode" label="Confirmation" value={v.mode} onChange={(mode) => setV({ ...v, mode })} options={(Object.keys(MODE_LABEL) as ModeReservation[]).map((m) => ({ value: m, label: m === 'IMMEDIATE' ? 'Immédiate' : 'Par un gestionnaire' }))} />
      </Grille2>
      <Saisie id="rs-desc" label="Description" facultatif value={v.description} onChange={(description) => setV({ ...v, description })} />
      {ressource && <Case id="rs-actif" label="Réservable" checked={v.actif} onChange={(actif) => setV({ ...v, actif })} />}
    </FenetreFormulaire>
  );
}
