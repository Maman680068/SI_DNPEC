'use client';

import { useCallback, useEffect, useState } from 'react';
import { declarerTestRestauration, getSupervision, listerParametres, modifierParametre } from '../../../lib/api/securite';
import type { ListeParametres, Parametre, Supervision } from '../../../lib/securite/types';
import { LIBELLE_ETAPE, LIBELLE_ETAT, TON_ETAT } from '../../../lib/securite/types';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Fenetre, Choix, Texte } from '../../../components/ui/Fenetre';
import { Field } from '../../../components/ui/Input';

type Onglet = 'parametres' | 'supervision';
const date = (d: string) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
const dateHeure = (d: string) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Paramétrage et supervision (socle N2, §13.6 et SOC-SUP) : l'administrateur modifie les
 * paramètres (bornés par le serveur) ; le DN et la DNA consultent. Aucun élément protégé.
 * Ouverture directe de la supervision : ?onglet=supervision (lien des alertes).
 */
export default function ParametragePage() {
  const [onglet, setOnglet] = useState<Onglet>('parametres');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('onglet') === 'supervision') setOnglet('supervision');
  }, []);

  return (
    <div>
      <div className="mb-[22px]">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Administration</div>
        <h1 className="text-[22px] font-extrabold">Paramétrage et supervision</h1>
      </div>
      <div role="tablist" className="mb-5 flex max-w-full flex-wrap gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
        {(
          [
            ['parametres', 'Paramètres'],
            ['supervision', 'Supervision'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={onglet === k}
            onClick={() => setOnglet(k)}
            className={`rounded-[6px] px-4 py-1.5 text-[12.5px] font-semibold ${onglet === k ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'}`}
          >
            {l}
          </button>
        ))}
      </div>
      {onglet === 'parametres' ? <Parametres /> : <SupervisionVue />}
    </div>
  );
}

function Parametres() {
  const [liste, setListe] = useState<ListeParametres | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState<Parametre | null>(null);
  useEffect(() => {
    listerParametres().then(setListe).catch((e) => setErreur(messageChargement(e)));
  }, []);
  if (!liste) return <Chargement erreur={erreur} />;
  return (
    <>
      <p className="mb-3 text-[12.5px] text-text-muted">Chaque valeur reste dans ses bornes, s’applique aussitôt au circuit concerné et chaque modification est tracée au journal d’audit.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {liste.parametres.map((p) => (
          <section key={p.cle} data-testid="parametre" data-cle={p.cle} className="rounded-md border border-line bg-surface px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-bold text-ink">{p.libelle}</h2>
                <div className="mt-1 text-[22px] font-extrabold text-ink" data-testid="valeur">
                  {p.valeur} <span className="text-[13px] font-semibold text-text-muted">{p.unite}</span>
                </div>
              </div>
              {liste.droits.peutModifier && (
                <Button className="!px-2.5 !py-1.5 !text-[12px]" onClick={() => setEdition(p)}>
                  Modifier
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-[12.5px] text-text-muted">{p.effet}</p>
            <p className="mt-1 text-[11.5px] text-text-faint">
              Bornes : {p.min} à {p.max} {p.unite} · défaut {p.defaut} · {p.reference}
              {p.modifie && p.modifieLe && <> · modifié le {date(p.modifieLe)}{p.modifiePar ? ` par ${p.modifiePar}` : ''}</>}
            </p>
          </section>
        ))}
      </div>
      {edition && (
        <FenetreParametre
          parametre={edition}
          onClose={() => setEdition(null)}
          onFait={(l) => {
            setListe(l);
            setEdition(null);
          }}
        />
      )}
    </>
  );
}

function FenetreParametre({ parametre, onClose, onFait }: { parametre: Parametre; onClose: () => void; onFait: (l: ListeParametres) => void }) {
  const [valeur, setValeur] = useState(String(parametre.valeur));
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const envoyer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      onFait(await modifierParametre(parametre.cle, Number(valeur)));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Modification impossible');
      setEnCours(false);
    }
  };
  return (
    <Fenetre titre={parametre.libelle} onClose={onClose} onSubmit={envoyer} enCours={enCours} erreur={erreur}>
      <Field label={`Valeur (${parametre.min} à ${parametre.max} ${parametre.unite})`} type="number" value={valeur} onChange={(e) => setValeur(e.target.value)} required />
      <p className="mb-3 text-[12.5px] text-text-muted">{parametre.effet}</p>
    </Fenetre>
  );
}

function SupervisionVue() {
  const [s, setS] = useState<Supervision | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [test, setTest] = useState(false);
  const [periode, setPeriode] = useState<'24h' | '7j' | '30j'>('7j');
  const charger = useCallback(() => {
    getSupervision()
      .then((r) => {
        setS(r);
        setErreur(null);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(charger, [charger]);
  if (!s) return <Chargement erreur={erreur} />;
  const refus = s.accesRefuses.parPeriode[periode];
  const carte = 'rounded-md border border-line bg-surface px-4 py-3.5';

  return (
    <div className="space-y-5">
      <ErreurChargement message={erreur} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px]">
          État général : <Badge tone={TON_ETAT[s.etatGlobal]} data-testid="etat-global">{LIBELLE_ETAT[s.etatGlobal].toUpperCase()}</Badge>
          <span className="text-text-faint">· relevé le {dateHeure(s.genereLe)}</span>
        </div>
        <Button className="!px-3 !py-1.5 !text-[12.5px]" onClick={charger}>
          Actualiser
        </Button>
      </div>

      <section aria-label="Services" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {s.services.map((x) => (
          <div key={x.cle} data-testid="service" data-cle={x.cle} className={carte}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13.5px] font-bold">{x.libelle}</h2>
              <Badge tone={TON_ETAT[x.etat]}>{LIBELLE_ETAT[x.etat].toUpperCase()}</Badge>
            </div>
            <p className="mt-1.5 text-[12.5px] text-text-muted">{x.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <div className={carte}>
          <h2 className="text-[13.5px] font-bold">Sessions ouvertes</h2>
          <div className="mt-1 text-[22px] font-extrabold">{s.sessions.ouvertes}</div>
          <p className="text-[12px] text-text-muted">expiration après {s.sessions.expirationJours} jours d’inactivité</p>
        </div>
        <div className={carte}>
          <h2 className="text-[13.5px] font-bold">Connexions (24 h)</h2>
          <div className="mt-1 text-[22px] font-extrabold">{s.connexions.reussies24h}</div>
          <p className={`text-[12px] ${s.connexions.echecs24h ? 'text-clay' : 'text-text-muted'}`}>{s.connexions.echecs24h} échec(s)</p>
        </div>
        <div className={carte} data-testid="sauvegardes">
          <h2 className="text-[13.5px] font-bold">Sauvegardes</h2>
          <p className="mt-1 text-[12.5px] text-text-muted">{s.sauvegardes.gestion}</p>
          <p className={`mt-1.5 text-[12.5px] ${s.sauvegardes.testEnRetard ? 'text-clay' : 'text-text'}`}>
            {s.sauvegardes.testRestauration
              ? `Dernier test de restauration : ${date(s.sauvegardes.testRestauration.date)} — ${s.sauvegardes.testRestauration.resultat === 'REUSSI' ? 'réussi' : 'échec'}${s.sauvegardes.testRestauration.declarePar ? ` (${s.sauvegardes.testRestauration.declarePar})` : ''}`
              : 'Aucun test de restauration déclaré.'}
            {s.sauvegardes.testEnRetard && ' Un test tous les 6 mois est recommandé.'}
          </p>
          {s.droits.peutDeclarerTest && (
            <Button className="mt-2 !px-2.5 !py-1.5 !text-[12px]" onClick={() => setTest(true)}>
              Déclarer un test de restauration
            </Button>
          )}
        </div>
      </div>

      <section className={carte}>
        <h2 className="mb-2 text-[13.5px] font-bold">Tâches planifiées</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[12.5px]">
            <tbody>
              {s.taches.map((t) => (
                <tr key={t.tache} className="border-b border-line last:border-0">
                  <td className="py-1.5 pr-3">{t.libelle}</td>
                  <td className="py-1.5 pr-3 text-text-muted">{t.derniere ? dateHeure(t.derniere.debut) : 'Pas encore exécutée'}</td>
                  <td className="py-1.5 text-right">
                    {t.derniere && <Badge tone={t.derniere.statut === 'ECHEC' ? 'clay' : t.derniere.statut === 'SUCCES' ? 'sage' : 'muted'}>{t.derniere.statut === 'SUCCES' ? 'RÉUSSIE' : t.derniere.statut === 'ECHEC' ? 'ÉCHEC' : 'EN COURS'}</Badge>}
                    {t.echecs24h > 0 && <span className="ml-2 text-clay">{t.echecs24h} échec(s) en 24 h</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={carte} data-testid="comptes-a-surveiller">
        <h2 className="mb-2 text-[13.5px] font-bold">Comptes à surveiller ({s.comptesASurveiller.length})</h2>
        {s.comptesASurveiller.length === 0 ? (
          <p className="text-[12.5px] text-text-muted">Aucun.</p>
        ) : (
          <ul className="space-y-1 text-[12.5px]">
            {s.comptesASurveiller.map((c) => (
              <li key={c.id + c.motif}>
                <strong>{c.nom}</strong> <span className="text-text-muted">({c.email})</span> — {c.motif}
              </li>
            ))}
          </ul>
        )}
        {s.finsProches.length > 0 && (
          <>
            <h3 className="mb-1 mt-3 text-[12.5px] font-bold">Fins de stage ou de contrat proches</h3>
            <ul className="space-y-1 text-[12.5px]">
              {s.finsProches.map((f) => (
                <li key={f.agentId}>
                  {f.nom} — {f.nature === 'STAGE' ? 'fin de stage' : 'fin de contrat'} le {date(f.date)}
                  {f.confirmee ? ' (confirmée)' : ''}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={carte} data-testid="acces-refuses">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13.5px] font-bold">Accès refusés</h2>
          <Choix label="Période" value={periode} onChange={(v) => setPeriode(v as '24h' | '7j' | '30j')} options={[{ value: '24h', label: '24 heures' }, { value: '7j', label: '7 jours' }, { value: '30j', label: '30 jours' }]} />
        </div>
        <p className="mb-2 text-[12.5px]">
          {refus.length === 0 ? 'Aucun refus sur la période.' : refus.map((r) => `${LIBELLE_ETAPE[r.etape] ?? r.etape} : ${r.nombre}`).join(' · ')}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <tbody>
              {s.accesRefuses.derniers.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap py-1.5 pr-3 text-text-muted">{dateHeure(r.date)}</td>
                  <td className="py-1.5 pr-3">{r.compte}</td>
                  <td className="py-1.5 pr-3 font-mono text-[11px] text-text-muted">
                    {r.methode} {r.route}
                  </td>
                  <td className="py-1.5 pr-3">{LIBELLE_ETAPE[r.etape] ?? r.etape}</td>
                  <td className="py-1.5 text-text-muted">{r.motif}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {test && (
        <FenetreTest
          onClose={() => setTest(false)}
          onFait={() => {
            setTest(false);
            charger();
          }}
        />
      )}
    </div>
  );
}

function FenetreTest({ onClose, onFait }: { onClose: () => void; onFait: () => void }) {
  const [jour, setJour] = useState(new Date().toISOString().slice(0, 10));
  const [resultat, setResultat] = useState<'REUSSI' | 'ECHEC'>('REUSSI');
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const envoyer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await declarerTestRestauration({ date: jour, resultat, ...(commentaire.trim() ? { commentaire: commentaire.trim() } : {}) });
      onFait();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Déclaration impossible');
      setEnCours(false);
    }
  };
  return (
    <Fenetre titre="Test de restauration" onClose={onClose} onSubmit={envoyer} enCours={enCours} erreur={erreur} libelleValider="Déclarer">
      <Field label="Date du test" type="date" value={jour} onChange={(e) => setJour(e.target.value)} required />
      <Choix label="Résultat" value={resultat} onChange={(v) => setResultat(v as 'REUSSI' | 'ECHEC')} options={[{ value: 'REUSSI', label: 'Réussi' }, { value: 'ECHEC', label: 'Échec' }]} />
      <Texte label="Commentaire (facultatif)" value={commentaire} onChange={setCommentaire} />
    </Fenetre>
  );
}
