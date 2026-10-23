'use client';

import Link from 'next/link';
import { ArrowLeft, Lock, Paperclip, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  creerFil,
  getDestinatairesFil,
  getFil,
  getFils,
  rechercher,
  repondreFil,
} from '../../lib/api/pilotage';
import type { Fil, FilResume, TypeObjet } from '../../lib/pilotage/types';
import { LIBELLE_TYPE_OBJET } from '../../lib/pilotage/types';
import { Button } from '../ui/Button';
import { Initiales } from '../ui/Charte';
import { CLASSE_SAISIE, FenetreFormulaire, Saisie, SelecteurPersonnes, ZoneTexte } from '../ui/Formulaire';
import { Chargement, messageChargement } from '../ui/ErreurChargement';
import { messageErreur, useToast } from '../ui/Toast';

type Lien = { type: TypeObjet; id: string; libelle: string };
const champ = `${CLASSE_SAISIE} border-line mt-1.5 h-10 font-normal`;
const heure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Type d'objet d'un résultat de la recherche transverse (l'annuaire n'est pas joignable). */
function typeDe(cle: string, lien: string): TypeObjet | null {
  if (cle === 'taches') return 'TACHE';
  if (cle === 'documents') return 'DOCUMENT';
  if (cle === 'reunions') return 'REUNION';
  if (cle === 'courrier') return lien.includes('acte=') ? 'ACTE' : 'ARRIVEE';
  return null;
}

/** Choix d'un objet de la plateforme à joindre : passe par la recherche, donc par les droits de l'auteur. */
function ChoixObjet({
  valeur,
  onChange,
}: {
  valeur: Lien | null;
  onChange: (l: Lien | null) => void;
}) {
  const [q, setQ] = useState('');
  const [resultats, setResultats] = useState<Lien[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (q.trim().length < 3) return setResultats([]);
    const t = setTimeout(() => {
      rechercher(q.trim())
        .then((r) =>
          setResultats(
            r.categories.flatMap((c) =>
              c.resultats.flatMap((x) => {
                const type = typeDe(c.cle, x.lien);
                return type ? [{ type, id: x.id, libelle: x.libelle }] : [];
              }),
            ),
          ),
        )
        .catch((e) => setMessage(messageChargement(e)));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  if (valeur) {
    return (
      <div className="flex items-center gap-2 text-[12.5px]" data-testid="objet-joint">
        <span className="flex min-w-0 items-center gap-1.5">
          <Paperclip aria-hidden size={14} className="flex-none text-text-muted" />
          {LIBELLE_TYPE_OBJET[valeur.type]} : <strong className="truncate">{valeur.libelle}</strong>
        </span>
        <button type="button" className="text-clay underline" onClick={() => onChange(null)}>
          Retirer
        </button>
      </div>
    );
  }
  return (
    <div>
      <label className="block text-[13px] font-semibold text-text">
        Joindre un objet{' '}
        <span className="font-normal text-text-muted">
          (tâche, document, courrier, réunion — facultatif)
        </span>
        <input
          className={champ}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher (3 caractères au moins)…"
        />
      </label>
      {message && <p className="mt-1 text-[12px] text-clay">{message}</p>}
      {resultats.length > 0 && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-line">
          {resultats.map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-bg"
                onClick={() => (onChange(r), setQ(''))}
              >
                <span className="text-text-muted">{LIBELLE_TYPE_OBJET[r.type]} · </span>
                {r.libelle}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Fils de discussion (socle N5) : objet, plusieurs destinataires, accusés de lecture, renvoi vers un objet. */
export function FilsDiscussion({
  filInitial,
  peutJoindre,
  onChange,
}: {
  filInitial: string | null;
  peutJoindre: boolean;
  /** Après lecture ou envoi : compteur de l'onglet. */
  onChange?: () => void;
}) {
  const [fils, setFils] = useState<FilResume[] | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(filInitial);
  const [nouveau, setNouveau] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => {
    getFils()
      .then(setFils)
      .catch((e) => setErreur(messageChargement(e)));
    onChange?.();
    // onChange (compteur de l'onglet) : fourni par la page, stable.
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <div className="flex h-[calc(100vh-230px)] min-h-[480px] overflow-hidden rounded-xl border border-line bg-surface">
      <div
        className={`w-full flex-shrink-0 overflow-y-auto border-r border-line md:block md:w-[320px] ${ouvert ? 'hidden' : ''}`}
      >
        <div className="border-b border-line p-3">
          <button type="button" onClick={() => setNouveau(true)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] bg-ink text-[13.5px] font-bold text-white hover:bg-ink-800">
            <Plus aria-hidden size={15} />
            Nouveau fil
          </button>
        </div>
        {erreur && <p className="px-4 py-3 text-[12.5px] text-clay">{erreur}</p>}
        {!fils ? (
          <Chargement
            erreur={erreur}
            className="px-4 py-6 text-center text-[13px] text-text-muted"
          />
        ) : fils.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-text-muted">
            Aucun fil de discussion : « Nouveau fil » pour en démarrer un.
          </p>
        ) : (
          <ul>
            {fils.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  data-testid="fil"
                  aria-current={ouvert === f.id ? 'true' : undefined}
                  onClick={() => setOuvert(f.id)}
                  className={`w-full border-b border-line-doux px-3.5 py-[11px] text-left ${ouvert === f.id ? 'bg-ink-50' : 'hover:bg-survol'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold">{f.objet}</span>
                    {f.nonLus > 0 && (
                      <span className="flex-none rounded-[10px] bg-gold px-[7px] py-px text-[11.5px] font-bold text-sur-or">
                        {f.nonLus}
                        <span className="sr-only"> non lu{f.nonLus > 1 ? 's' : ''}</span>
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[12px] text-text-muted">
                    {f.participants.map((p) => p.nom).join(', ')}
                  </div>
                  {f.dernier && (
                    <div className={`truncate text-[12.5px] ${f.nonLus > 0 ? 'font-semibold text-text' : 'text-text-muted'}`}>
                      {f.dernier.auteur} : {f.dernier.extrait}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={`min-w-0 flex-1 ${ouvert ? '' : 'hidden md:block'}`}>
        {ouvert ? (
          <FilOuvert
            id={ouvert}
            peutJoindre={peutJoindre}
            onRetour={() => setOuvert(null)}
            onChange={charger}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-[13.5px] text-text-muted">
            Choisissez un fil ou démarrez-en un avec « Nouveau fil ».
          </div>
        )}
      </div>
      {nouveau && (
        <NouveauFil
          peutJoindre={peutJoindre}
          onClose={() => setNouveau(false)}
          onCree={(id) => (setNouveau(false), setOuvert(id), charger())}
        />
      )}
    </div>
  );
}

function FilOuvert({
  id,
  peutJoindre,
  onRetour,
  onChange,
}: {
  id: string;
  peutJoindre: boolean;
  onRetour: () => void;
  onChange: () => void;
}) {
  const [fil, setFil] = useState<Fil | null>(null);
  const [corps, setCorps] = useState('');
  const [lien, setLien] = useState<Lien | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const toast = useToast();
  useEffect(() => {
    setFil(null);
    getFil(id)
      .then((f) => (setFil(f), onChange()))
      .catch((e) => setErreur(messageChargement(e)));
    // onChange (liste) volontairement hors dépendances : ouvrir un fil le marque lu une fois.
  }, [id]);
  if (!fil) return <Chargement erreur={erreur} className="p-6 text-[13px] text-text-muted" />;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-[11px] border-b border-line px-4 py-3 sm:px-[18px]">
        <button type="button" onClick={onRetour} aria-label="Retour à la liste des fils" className="-ml-1 grid h-8 w-8 flex-none place-items-center rounded-md text-text-muted hover:bg-bg md:hidden">
          <ArrowLeft aria-hidden size={18} />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-bold">{fil.objet}</h2>
          <div className="truncate text-[12px] text-text-muted">
            {fil.participants.map((p) => p.nom).join(', ')}
          </div>
        </div>
      </div>
      <ol className="flex-1 space-y-3 overflow-y-auto bg-fond-doux px-4 py-4 sm:px-[22px]">
        {fil.messages.map((m) => (
          <li key={m.id} data-testid="message-fil" className="rounded-[12px] border border-line bg-surface p-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[12px] text-text-muted">
              <span className="flex items-center gap-2">
                <Initiales texte={m.auteur.nom.split(' ').map((x) => x.charAt(0)).slice(0, 2).join('').toUpperCase()} taille={26} />
                <strong className="text-text">{m.auteur.nom}</strong>
              </span>
              <span>{heure(m.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-[13px]">{m.corps}</p>
            {m.lien &&
              (m.lien.accessible && m.lien.lien ? (
                <Link
                  href={m.lien.lien}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-[8px] border border-line px-2.5 py-1.5 text-[12.5px] font-semibold text-ink hover:border-ink"
                  data-testid="lien-objet"
                >
                  <Paperclip aria-hidden size={14} />
                  {LIBELLE_TYPE_OBJET[m.lien.type]} : {m.lien.libelle}
                </Link>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] italic text-text-muted" data-testid="lien-objet">
                  <Lock aria-hidden size={13} />
                  {LIBELLE_TYPE_OBJET[m.lien.type]} joint(e) — vous n’y avez pas accès.
                </p>
              ))}
            <p className="mt-2 text-[11.5px] text-text-muted" data-testid="accuses">
              {m.lectures
                .map((l) =>
                  l.luLe ? `Lu par ${l.nom} le ${heure(l.luLe)}` : `Non lu par ${l.nom}`,
                )
                .join(' · ')}
            </p>
          </li>
        ))}
      </ol>
      <form
        className="space-y-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!corps.trim()) return;
          setErreur(null);
          setEnvoi(true);
          repondreFil(id, { corps, ...(lien ? { lien: { type: lien.type, id: lien.id } } : {}) })
            .then((f) => {
              setFil(f);
              setCorps('');
              setLien(null);
              onChange();
              const autres = f.participants.length - 1;
              toast.succes('Réponse envoyée', { detail: autres > 0 ? `${autres} participant${autres > 1 ? 's' : ''} prévenu${autres > 1 ? 's' : ''}.` : undefined });
            })
            .catch((err) => setErreur(messageErreur(err, 'Impossible d’envoyer la réponse.')))
            .finally(() => setEnvoi(false));
        }}
      >
        {erreur && (
          <p role="alert" className="text-[12.5px] font-semibold text-clay">
            {erreur}
          </p>
        )}
        <label className="sr-only" htmlFor="reponse-fil">
          Votre message
        </label>
        <textarea
          id="reponse-fil"
          className={`${CLASSE_SAISIE} border-line py-2.5`}
          rows={2}
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
          placeholder="Votre message…"
          required
        />
        {peutJoindre && <ChoixObjet valeur={lien} onChange={setLien} />}
        <div className="flex justify-end">
          <Button variant="solid" type="submit" disabled={envoi || !corps.trim()}>
            {envoi ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function NouveauFil({
  peutJoindre,
  onClose,
  onCree,
}: {
  peutJoindre: boolean;
  onClose: () => void;
  onCree: (id: string) => void;
}) {
  const [personnes, setPersonnes] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [choisis, setChoisis] = useState<string[]>([]);
  const [objet, setObjet] = useState('');
  const [corps, setCorps] = useState('');
  const [lien, setLien] = useState<Lien | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const toast = useToast();
  useEffect(() => {
    getDestinatairesFil()
      .then(setPersonnes)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  return (
    <FenetreFormulaire
      titre="Nouveau fil de discussion"
      onClose={onClose}
      largeur={720}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Démarrer le fil"
      testid="fenetre-nouveau-fil"
      pied="Chaque destinataire est prévenu ; vous voyez qui a lu chaque message."
      valider={() => ({
        ...(objet.trim().length >= 2 ? {} : { 'fil-objet': 'Donnez un objet au fil (2 caractères au moins).' }),
        ...(corps.trim() ? {} : { 'fil-message': 'Écrivez le premier message.' }),
      })}
      onSubmit={() => {
        setEnCours(true);
        setErreur(null);
        return creerFil({
          objet: objet.trim(),
          destinataires: choisis,
          corps,
          ...(lien ? { lien: { type: lien.type, id: lien.id } } : {}),
        })
          .then((f) => {
            toast.succes('Fil de discussion démarré', { detail: `${choisis.length} destinataire${choisis.length > 1 ? 's' : ''} prévenu${choisis.length > 1 ? 's' : ''}.` });
            onCree(f.id);
          })
          .catch((e) => setErreur(messageErreur(e, 'Impossible de démarrer le fil.')))
          .finally(() => setEnCours(false));
      }}
    >
      <Saisie id="fil-objet" label="Objet" value={objet} onChange={setObjet} required messageObligatoire="Donnez un objet au fil." />
      <SelecteurPersonnes
        id="fil-destinataires"
        label="Destinataires"
        options={personnes.map((p) => ({ id: p.id, nom: `${p.firstName} ${p.lastName}` }))}
        valeurs={choisis}
        onChange={setChoisis}
        required
        messageObligatoire="Choisissez au moins un destinataire."
      />
      <ZoneTexte id="fil-message" label="Message" value={corps} onChange={setCorps} lignes={4} required messageObligatoire="Écrivez le premier message." />
      {peutJoindre && (
        <div className="mb-1">
          <ChoixObjet valeur={lien} onChange={setLien} />
        </div>
      )}
    </FenetreFormulaire>
  );
}
