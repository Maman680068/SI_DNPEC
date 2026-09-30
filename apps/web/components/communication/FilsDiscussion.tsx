'use client';

import Link from 'next/link';
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
import { Fenetre } from '../ui/Fenetre';
import { Chargement, messageChargement } from '../ui/ErreurChargement';

type Lien = { type: TypeObjet; id: string; libelle: string };
const champ = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]';
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
        <span>
          📎 {LIBELLE_TYPE_OBJET[valeur.type]} : <strong>{valeur.libelle}</strong>
        </span>
        <button type="button" className="text-clay underline" onClick={() => onChange(null)}>
          Retirer
        </button>
      </div>
    );
  }
  return (
    <div>
      <label className="block text-[12.5px] font-semibold">
        Joindre un objet{' '}
        <span className="font-normal text-text-faint">
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
                <span className="text-text-faint">{LIBELLE_TYPE_OBJET[r.type]} · </span>
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
}: {
  filInitial: string | null;
  peutJoindre: boolean;
}) {
  const [fils, setFils] = useState<FilResume[] | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(filInitial);
  const [nouveau, setNouveau] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => {
    getFils()
      .then(setFils)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <div className="flex h-[calc(100vh-260px)] min-h-[420px] overflow-hidden rounded-lg border border-line bg-surface">
      <div
        className={`w-full flex-shrink-0 overflow-y-auto border-r border-line md:block md:w-[320px] ${ouvert ? 'hidden' : ''}`}
      >
        <div className="border-b border-line p-3">
          <Button variant="gold" className="w-full" onClick={() => setNouveau(true)}>
            + Nouveau fil
          </Button>
        </div>
        {erreur && <p className="px-4 py-3 text-[12.5px] text-clay">{erreur}</p>}
        {!fils ? (
          <Chargement
            erreur={erreur}
            className="px-4 py-6 text-center text-[13px] text-text-muted"
          />
        ) : fils.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-text-faint">
            Aucun fil de discussion.
          </p>
        ) : (
          <ul>
            {fils.map((f) => (
              <li key={f.id}>
                <button
                  data-testid="fil"
                  onClick={() => setOuvert(f.id)}
                  className={`w-full border-b border-line px-4 py-3 text-left ${ouvert === f.id ? 'bg-bg' : 'hover:bg-bg'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold">{f.objet}</span>
                    {f.nonLus > 0 && (
                      <span className="rounded-full bg-clay px-1.5 text-[11px] font-bold text-white">
                        {f.nonLus}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[12px] text-text-muted">
                    {f.participants.map((p) => p.nom).join(', ')}
                  </div>
                  {f.dernier && (
                    <div className="truncate text-[12px] text-text-faint">
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
          <div className="flex h-full items-center justify-center text-[13px] text-text-faint">
            Choisissez un fil ou démarrez-en un nouveau.
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
      <div className="border-b border-line px-4 py-3">
        <button onClick={onRetour} className="mb-1 text-[12.5px] text-text-muted md:hidden">
          ← Fils
        </button>
        <h2 className="text-[15px] font-bold">{fil.objet}</h2>
        <div className="text-[12px] text-text-muted">
          {fil.participants.map((p) => p.nom).join(', ')}
        </div>
      </div>
      <ol className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {fil.messages.map((m) => (
          <li key={m.id} data-testid="message-fil" className="rounded-md border border-line p-3">
            <div className="mb-1 flex flex-wrap justify-between gap-2 text-[12px] text-text-muted">
              <strong className="text-text">{m.auteur.nom}</strong>
              <span>{heure(m.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-[13px]">{m.corps}</p>
            {m.lien &&
              (m.lien.accessible && m.lien.lien ? (
                <Link
                  href={m.lien.lien}
                  className="mt-2 inline-block rounded bg-bg px-2 py-1 text-[12.5px] text-ink underline"
                  data-testid="lien-objet"
                >
                  📎 {LIBELLE_TYPE_OBJET[m.lien.type]} : {m.lien.libelle}
                </Link>
              ) : (
                <p className="mt-2 text-[12px] italic text-text-faint" data-testid="lien-objet">
                  📎 {LIBELLE_TYPE_OBJET[m.lien.type]} joint(e) — vous n’y avez pas accès.
                </p>
              ))}
            <p className="mt-2 text-[11.5px] text-text-faint" data-testid="accuses">
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
          setErreur(null);
          repondreFil(id, { corps, ...(lien ? { lien: { type: lien.type, id: lien.id } } : {}) })
            .then((f) => (setFil(f), setCorps(''), setLien(null), onChange()))
            .catch((err) => setErreur(messageChargement(err)));
        }}
      >
        {erreur && <p className="text-[12.5px] text-clay">{erreur}</p>}
        <label className="sr-only" htmlFor="reponse-fil">
          Votre message
        </label>
        <textarea
          id="reponse-fil"
          className={champ}
          rows={2}
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
          placeholder="Votre message…"
          required
        />
        {peutJoindre && <ChoixObjet valeur={lien} onChange={setLien} />}
        <div className="flex justify-end">
          <Button variant="solid" type="submit">
            Envoyer
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
  const [personnes, setPersonnes] = useState<{ id: string; firstName: string; lastName: string }[]>(
    [],
  );
  const [filtre, setFiltre] = useState('');
  const [choisis, setChoisis] = useState<string[]>([]);
  const [objet, setObjet] = useState('');
  const [corps, setCorps] = useState('');
  const [lien, setLien] = useState<Lien | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    getDestinatairesFil()
      .then(setPersonnes)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  const visibles = personnes.filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(filtre.toLowerCase()),
  );
  return (
    <Fenetre
      titre="Nouveau fil de discussion"
      onClose={onClose}
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Envoyer"
      onSubmit={() => {
        if (!choisis.length) return setErreur('Choisissez au moins un destinataire.');
        setEnCours(true);
        return creerFil({
          objet,
          destinataires: choisis,
          corps,
          ...(lien ? { lien: { type: lien.type, id: lien.id } } : {}),
        })
          .then((f) => onCree(f.id))
          .catch((e) => setErreur(messageChargement(e)))
          .finally(() => setEnCours(false));
      }}
    >
      <label className="mb-3 block text-[12.5px] font-semibold">
        Objet
        <input
          className={champ}
          value={objet}
          onChange={(e) => setObjet(e.target.value)}
          required
          minLength={2}
        />
      </label>
      <fieldset className="mb-3">
        <legend className="text-[12.5px] font-semibold">Destinataires ({choisis.length})</legend>
        <input
          className={champ}
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          placeholder="Filtrer par nom…"
          aria-label="Filtrer les destinataires"
        />
        <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-line px-3 py-1.5">
          {visibles.map((p) => (
            <label key={p.id} className="flex items-center gap-2 py-0.5 text-[13px]">
              <input
                type="checkbox"
                checked={choisis.includes(p.id)}
                onChange={() =>
                  setChoisis((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id]))
                }
              />
              {p.firstName} {p.lastName}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mb-3 block text-[12.5px] font-semibold">
        Message
        <textarea
          className={champ}
          rows={4}
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
          required
        />
      </label>
      {peutJoindre && (
        <div className="mb-3">
          <ChoixObjet valeur={lien} onChange={setLien} />
        </div>
      )}
    </Fenetre>
  );
}
