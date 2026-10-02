'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  emettreInstruction,
  executerInstruction,
  getInstruction,
  getInstructions,
  prendreEnCompte,
  rejeterInstruction,
} from '../../../lib/api/pilotage';
import type {
  Instruction,
  ListeInstructions,
  StatutInstruction,
} from '../../../lib/pilotage/types';
import { LIBELLE_STATUT_INSTRUCTION } from '../../../lib/pilotage/types';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Fenetre } from '../../../components/ui/Fenetre';
import {
  Chargement,
  ErreurChargement,
  messageChargement,
} from '../../../components/ui/ErreurChargement';

type Onglet = 'recues' | 'emises' | 'meConcernant';
const champ = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]';
const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
const TON: Record<StatutInstruction, 'accent' | 'gold' | 'sage' | 'clay' | 'muted'> = {
  EMISE: 'gold',
  RECUE: 'accent',
  PRISE_EN_COMPTE: 'accent',
  EXECUTEE: 'sage',
  REJETEE: 'clay',
};

/** Instructions de la Direction (socle N5) : émises par le DN ou la DNA, suivies jusqu'à l'exécution. */
export default function InstructionsPage() {
  const [liste, setListe] = useState<ListeInstructions | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('recues');
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [emission, setEmission] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => {
    getInstructions()
      .then((l) => {
        setListe(l);
        if (l.peutEmettre && l.recues.length === 0)
          setOnglet((o) => (o === 'recues' ? 'emises' : o));
        else if (!l.peutEmettre && l.recues.length === 0 && l.meConcernant.length > 0)
          setOnglet((o) => (o === 'recues' ? 'meConcernant' : o));
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setOuverte(id);
  }, [charger]);

  if (!liste) {
    return (
      <div>
        <ErreurChargement message={erreur} />
        <Chargement erreur={erreur} />
      </div>
    );
  }
  const onglets: { cle: Onglet; libelle: string; items: Instruction[]; visible: boolean }[] = [
    { cle: 'recues', libelle: 'Reçues', items: liste.recues, visible: true },
    {
      cle: 'emises',
      libelle: liste.peutEmettre ? 'Émises (Direction)' : 'Émises',
      items: liste.emises,
      visible: liste.peutEmettre || liste.emises.length > 0,
    },
    {
      cle: 'meConcernant',
      libelle: 'Me concernant',
      items: liste.meConcernant,
      visible: liste.meConcernant.length > 0,
    },
  ];
  const courant = onglets.find((o) => o.cle === onglet) ?? onglets[0]!;

  return (
    <div className="max-w-[980px]">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Général</div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-extrabold">Instructions de la Direction</h1>
        {liste.peutEmettre && (
          <Button variant="solid" onClick={() => setEmission(true)}>
            + Nouvelle instruction
          </Button>
        )}
      </div>
      <p className="mb-5 text-[13px] text-text-muted">
        Émise → Reçue → Prise en compte → Exécutée ou Rejetée. Relance automatique tous les 7 jours
        tant qu’elle reste ouverte. Une instruction qui concerne un agent s’exécute par un acte
        signé du Courrier ; l’agent ne la voit qu’une fois exécutée.
      </p>
      <ErreurChargement message={erreur} />
      <div
        role="tablist"
        className="mb-4 flex w-fit flex-wrap gap-0.5 rounded-md border border-line bg-bg p-0.5"
      >
        {onglets
          .filter((o) => o.visible)
          .map((o) => (
            <button
              key={o.cle}
              role="tab"
              aria-selected={onglet === o.cle}
              onClick={() => setOnglet(o.cle)}
              className={`rounded-[6px] px-4 py-1.5 text-[12.5px] font-semibold ${onglet === o.cle ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'}`}
            >
              {o.libelle} <span className="text-text-faint">{o.items.length}</span>
            </button>
          ))}
      </div>
      {courant.items.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-5 text-[13px] text-text-muted">
          Aucune instruction.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {courant.items.map((i) => (
            <li key={i.id}>
              <button
                data-testid="instruction"
                onClick={() => setOuverte(i.id)}
                className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-bg"
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold">{i.objet}</div>
                  <div className="text-[12px] text-text-muted">
                    {i.emetteur.nom} → {i.destinataire.nom} · émise le {date(i.emiseLe)}
                    {i.echeance ? ` · échéance ${date(i.echeance)}` : ''}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {i.enRetard && <Badge tone="clay">En retard</Badge>}
                  <Badge tone={TON[i.statut]}>{LIBELLE_STATUT_INSTRUCTION[i.statut]}</Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {emission && (
        <FenetreEmission
          liste={liste}
          onClose={() => setEmission(false)}
          onFait={() => (setEmission(false), setOnglet('emises'), charger())}
        />
      )}
      {ouverte && (
        <FicheInstruction
          id={ouverte}
          onClose={() => {
            setOuverte(null);
            window.history.replaceState(null, '', '/instructions');
          }}
          onChange={charger}
        />
      )}
    </div>
  );
}

function FenetreEmission({
  liste,
  onClose,
  onFait,
}: {
  liste: ListeInstructions;
  onClose: () => void;
  onFait: () => void;
}) {
  const [v, setV] = useState({
    objet: '',
    texte: '',
    destinataireId: '',
    agentConcerneId: '',
    echeance: '',
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  return (
    <Fenetre
      titre="Nouvelle instruction"
      onClose={onClose}
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Émettre"
      onSubmit={() => {
        setEnCours(true);
        return emettreInstruction({
          objet: v.objet,
          texte: v.texte,
          destinataireId: v.destinataireId,
          ...(v.agentConcerneId ? { agentConcerneId: v.agentConcerneId } : {}),
          ...(v.echeance ? { echeance: v.echeance } : {}),
        })
          .then(onFait)
          .catch((e) => setErreur(messageChargement(e)))
          .finally(() => setEnCours(false));
      }}
    >
      <label className="mb-3 block text-[12.5px] font-semibold">
        Objet
        <input
          className={champ}
          value={v.objet}
          onChange={(e) => setV({ ...v, objet: e.target.value })}
          required
          minLength={3}
        />
      </label>
      <label className="mb-3 block text-[12.5px] font-semibold">
        Instruction
        <textarea
          className={champ}
          rows={4}
          value={v.texte}
          onChange={(e) => setV({ ...v, texte: e.target.value })}
          required
          minLength={5}
        />
      </label>
      <label className="mb-3 block text-[12.5px] font-semibold">
        Destinataire
        <select
          className={champ}
          value={v.destinataireId}
          onChange={(e) => setV({ ...v, destinataireId: e.target.value })}
          required
        >
          <option value="">Choisir…</option>
          {liste.personnesPossibles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-3 block text-[12.5px] font-semibold">
        Agent concerné{' '}
        <span className="font-normal text-text-faint">
          (instruction RH — facultatif ; ne la verra qu’une fois exécutée)
        </span>
        <select
          className={champ}
          value={v.agentConcerneId}
          onChange={(e) => setV({ ...v, agentConcerneId: e.target.value })}
        >
          <option value="">Aucun</option>
          {liste.personnesPossibles
            .filter((p) => p.id !== v.destinataireId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
        </select>
      </label>
      <label className="block text-[12.5px] font-semibold">
        Échéance <span className="font-normal text-text-faint">(facultatif)</span>
        <input
          type="date"
          className={champ}
          value={v.echeance}
          onChange={(e) => setV({ ...v, echeance: e.target.value })}
        />
      </label>
    </Fenetre>
  );
}

function FicheInstruction({
  id,
  onClose,
  onChange,
}: {
  id: string;
  onClose: () => void;
  onChange: () => void;
}) {
  const [i, setI] = useState<Instruction | null>(null);
  const [action, setAction] = useState<'executer' | 'rejeter' | null>(null);
  const [texte, setTexte] = useState('');
  const [acteId, setActeId] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    getInstruction(id)
      .then((x) => (setI(x), onChange()))
      .catch((e) => setErreur(messageChargement(e)));
  }, [id]);
  const apres = (p: Promise<Instruction>) =>
    p
      .then(() => getInstruction(id))
      .then((x) => (setI(x), setAction(null), setTexte(''), onChange()))
      .catch((e) => setErreur(messageChargement(e)));
  return (
    <Fenetre titre={i ? i.objet : 'Instruction'} onClose={onClose} largeur={620} erreur={erreur}>
      {!i ? (
        <Chargement erreur={erreur} />
      ) : (
        <div data-testid="fiche-instruction">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Badge tone={TON[i.statut]}>{LIBELLE_STATUT_INSTRUCTION[i.statut]}</Badge>
            {i.enRetard && <Badge tone="clay">En retard</Badge>}
          </div>
          <p className="mb-3 whitespace-pre-wrap text-[13.5px]">{i.texte}</p>
          <dl className="mb-4 space-y-1 text-[12.5px]">
            <div>
              <dt className="inline font-semibold">De : </dt>
              <dd className="inline">{i.emetteur.nom}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">À : </dt>
              <dd className="inline">{i.destinataire.nom}</dd>
            </div>
            {i.agentConcerne && (
              <div>
                <dt className="inline font-semibold">Agent concerné : </dt>
                <dd className="inline">{i.agentConcerne.nom}</dd>
              </div>
            )}
            <div>
              <dt className="inline font-semibold">Suivi : </dt>
              <dd className="inline" data-testid="suivi-instruction">
                émise le {date(i.emiseLe)}
                {i.recueLe && ` · reçue le ${date(i.recueLe)}`}
                {i.priseEnCompteLe && ` · prise en compte le ${date(i.priseEnCompteLe)}`}
                {i.executeeLe && ` · exécutée le ${date(i.executeeLe)}`}
                {i.rejeteeLe && ` · rejetée le ${date(i.rejeteeLe)}`}
                {i.echeance && ` · échéance ${date(i.echeance)}`}
              </dd>
            </div>
            {i.compteRendu && (
              <div>
                <dt className="inline font-semibold">Compte rendu : </dt>
                <dd className="inline">{i.compteRendu}</dd>
              </div>
            )}
            {i.acteId && (
              <div>
                <dt className="inline font-semibold">Acte : </dt>
                <dd className="inline">
                  <Link className="underline" href={`/courrier?acte=${i.acteId}`}>
                    voir l’acte d’exécution
                  </Link>
                </dd>
              </div>
            )}
            {i.motifRejet && (
              <div>
                <dt className="inline font-semibold">Motif du rejet : </dt>
                <dd className="inline">{i.motifRejet}</dd>
              </div>
            )}
          </dl>
          {action ? (
            <form
              className="rounded-md border border-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                setErreur(null);
                apres(
                  action === 'executer'
                    ? executerInstruction(id, { compteRendu: texte, ...(acteId ? { acteId } : {}) })
                    : rejeterInstruction(id, texte),
                );
              }}
            >
              <label className="mb-2 block text-[12.5px] font-semibold">
                {action === 'executer' ? 'Compte rendu d’exécution' : 'Motif du rejet'}
                <textarea
                  className={champ}
                  rows={3}
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  required
                  minLength={action === 'executer' ? 3 : 5}
                />
              </label>
              {action === 'executer' && i.droits.acteRequis && (
                <label className="mb-2 block text-[12.5px] font-semibold">
                  Acte signé qui exécute l’instruction
                  <select
                    className={champ}
                    value={acteId}
                    onChange={(e) => setActeId(e.target.value)}
                    required
                  >
                    <option value="">Choisir…</option>
                    {(i.actesPossibles ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.libelle}
                      </option>
                    ))}
                  </select>
                  {(i.actesPossibles ?? []).length === 0 && (
                    <span className="mt-1 block font-normal text-text-muted">
                      Préparez puis faites signer l’acte dans le module Courrier (ou Documents
                      générés).
                    </span>
                  )}
                </label>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" onClick={() => setAction(null)}>
                  Annuler
                </Button>
                <Button variant="solid" type="submit">
                  {action === 'executer' ? 'Confirmer l’exécution' : 'Confirmer le rejet'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              {i.droits.prendreEnCompte && (
                <Button variant="solid" onClick={() => apres(prendreEnCompte(id))}>
                  Prendre en compte
                </Button>
              )}
              {i.droits.executer && (
                <Button variant="solid" onClick={() => setAction('executer')}>
                  Marquer exécutée
                </Button>
              )}
              {i.droits.rejeter && <Button onClick={() => setAction('rejeter')}>Rejeter</Button>}
            </div>
          )}
        </div>
      )}
    </Fenetre>
  );
}
