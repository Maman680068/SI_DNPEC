'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, RefreshCw } from 'lucide-react';
import { declarerTestRestauration, getInventaireFichiers, getSupervision } from '../../../lib/api/securite';
import { telechargerFichier } from '../../../lib/api/client';
import type { EtatService, Supervision } from '../../../lib/securite/types';
import { LIBELLE_ETAPE, LIBELLE_ETAT } from '../../../lib/securite/types';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { BTN_LIGNE, BTN_SECONDAIRE, EnTetePage, EtatVide, FiltreSelect, Onglets, Panneau, Pastille } from '../../../components/ui/Charte';
import { ChampDate, ChoixSegment, FenetreFormulaire, Grille2, ZoneTexte } from '../../../components/ui/Formulaire';
import { messageErreur, useToast } from '../../../components/ui/Toast';
import { Parametres } from '../../../components/parametrage/Parametres';

type Onglet = 'parametres' | 'supervision' | 'journal';
const date = (d: string) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
const dateHeure = (d: string) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const releve = (d: string) => `${new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

/**
 * Paramétrage et supervision (socle N2, §13.6 et SOC-SUP ; refonte de l'interface, étapes 7 et 8) :
 * l'administrateur modifie les paramètres (bornés par le serveur, « Enregistrer » en en-tête) ; le DN
 * et la DNA consultent. Onglet Paramètres : `components/parametrage/Parametres.tsx`.
 * Supervision : bandeau d'état, « À traiter » / « Fonctionne normalement », sauvegardes regroupées.
 * Aucun élément protégé. Ouverture directe de la supervision : ?onglet=supervision (lien des alertes).
 */
export default function ParametragePage() {
  const router = useRouter();
  const [onglet, setOnglet] = useState<Onglet>('parametres');
  const [actions, setActions] = useState<ReactNode>(null);
  const [aTraiter, setATraiter] = useState<number | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('onglet') === 'supervision') setOnglet('supervision');
    // Compteur de l'onglet Supervision : services à traiter (même lecture que l'onglet ; sans compteur si refusée).
    getSupervision()
      .then((s) => setATraiter(s.services.filter((x) => x.etat !== 'NOMINAL').length))
      .catch(() => setATraiter(null));
  }, []);
  const poserActions = useCallback((a: ReactNode) => setActions(a), []);

  return (
    <div>
      <EnTetePage titre="Paramétrage et supervision" actions={onglet === 'parametres' ? actions : undefined} />
      <Onglets<Onglet>
        label="Paramétrage et supervision"
        actif={onglet}
        onChange={(o) => (o === 'journal' ? router.push('/journal-audit') : setOnglet(o))}
        onglets={[
          { cle: 'parametres', label: 'Paramètres' },
          { cle: 'supervision', label: 'Supervision', n: aTraiter, chaud: true },
          { cle: 'journal', label: 'Journal d’audit' },
        ]}
      />
      {onglet === 'parametres' ? <Parametres onActions={poserActions} /> : <SupervisionVue />}
    </div>
  );
}

type Ton = 'ok' | 'attention' | 'grave';
const POINT: Record<Ton, string> = { ok: 'bg-sage', attention: 'bg-ambre-vif', grave: 'bg-clay' };
const LIBELLE_TON: Record<Ton, string> = { ok: 'Fonctionne', attention: 'À surveiller', grave: 'Grave' };
const tonDe = (e: EtatService): Ton => (e === 'NOMINAL' ? 'ok' : e === 'DEGRADE' ? 'attention' : 'grave');

/** Ligne de la supervision : point de couleur (doublé d'un texte pour les lecteurs d'écran), titre, détail, action. */
function Point({ ton, titre, detail, action, testid, cle, etat }: { ton: Ton; titre: string; detail: ReactNode; action?: ReactNode; testid?: string; cle?: string; etat?: string }) {
  return (
    <li data-testid={testid} data-cle={cle} className="grid grid-cols-[12px_minmax(0,1fr)] items-start gap-3 border-b border-[#F0F1F6] px-4 py-[11px] text-[13.5px] last:border-b-0 sm:grid-cols-[12px_minmax(0,1fr)_auto]">
      <span aria-hidden className={`mt-[5px] h-2.5 w-2.5 rounded-full ${POINT[ton]}`} />
      <span className="min-w-0">
        <b className="block font-semibold text-text">
          <span className="sr-only">{etat ?? LIBELLE_TON[ton]} : </span>
          {titre}
        </b>
        <span className="block text-[12.5px] text-text-muted">{detail}</span>
      </span>
      {action ? <span className="col-start-2 sm:col-start-auto">{action}</span> : null}
    </li>
  );
}

const LIEN_ACTION = 'whitespace-nowrap text-[12.5px] font-bold text-ink hover:underline';
const Chip = ({ n, ton }: { n: number; ton: 'rouge' | 'vert' }) => (
  <span className={`ml-auto rounded-[6px] px-2 py-0.5 text-[12px] font-bold ${ton === 'rouge' ? 'bg-clay-50 text-clay' : 'bg-sage-50 text-sage'}`}>{n}</span>
);

/** Sauvegarde du stockage des fichiers (exploitation 2026-10) : le disque des fichiers n'est pas dans
 * l'export de la base ; l'administrateur télécharge ici une archive ZIP (mot de passe demandé). */
function SauvegardeFichiers() {
  const [inv, setInv] = useState<{ fichiers: number; octets: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const toast = useToast();
  useEffect(() => {
    getInventaireFichiers().then(setInv).catch((e) => setErreur(messageChargement(e)));
  }, []);
  return (
    <Point
      testid="sauvegarde-fichiers"
      ton={erreur ? 'attention' : 'ok'}
      titre="Fichiers déposés"
      detail={
        <>
          {erreur ?? (inv ? `${inv.fichiers.toLocaleString('fr-FR')} fichier(s), ${(inv.octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : '…')} · disque séparé de la base : à télécharger en même temps que l’export de la base, et à ranger avec lui.
        </>
      }
      action={
        <button
          type="button"
          className={BTN_LIGNE}
          disabled={enCours}
          onClick={() => {
            setEnCours(true);
            telechargerFichier('/api/v1/supervision/sauvegarde-fichiers/archive', null)
              .then(() => toast.succes('Archive téléchargée', { detail: 'Rangez-la avec l’export de la base.' }))
              .catch((e) => toast.erreur('Téléchargement impossible', messageErreur(e)))
              .finally(() => setEnCours(false));
          }}
        >
          {enCours ? 'Préparation de l’archive…' : 'Télécharger (ZIP)'}
        </button>
      }
    />
  );
}

function SupervisionVue() {
  const [s, setS] = useState<Supervision | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [test, setTest] = useState(false);
  const [periode, setPeriode] = useState<'24h' | '7j' | '30j'>('7j');
  const toast = useToast();
  const charger = useCallback(() => {
    getSupervision()
      .then((r) => {
        setS(r);
        setErreur(null);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(charger, [charger]);
  if (!s) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} lignes={8} /></>;
  const refus = s.accesRefuses.parPeriode[periode];
  const aTraiter = s.services.filter((x) => x.etat !== 'NOMINAL').sort((a, b) => (a.etat === b.etat ? 0 : a.etat === 'INDISPONIBLE' ? -1 : 1));
  const normaux = s.services.filter((x) => x.etat === 'NOMINAL');
  const grave = aTraiter.some((x) => x.etat === 'INDISPONIBLE');
  const action = (a: { libelle: string; lien: string } | null | undefined) =>
    a ? (
      a.lien.startsWith('#') ? (
        <a href={a.lien} className={LIEN_ACTION}>
          {a.libelle}
        </a>
      ) : (
        <Link href={a.lien} className={LIEN_ACTION}>
          {a.libelle}
        </Link>
      )
    ) : null;
  const sv = s.sauvegardes;

  return (
    <div className="space-y-4">
      <ErreurChargement message={erreur} />
      <div
        role="status"
        data-testid="etat-global"
        data-etat={s.etatGlobal}
        className={`flex flex-wrap items-center gap-3.5 rounded-xl border px-[18px] py-3.5 ${aTraiter.length === 0 ? 'border-[#A9D5B7] bg-sage-50' : grave ? 'border-[#E7B3BB] bg-clay-50' : 'border-[#F2D58A] bg-gold-50'}`}
      >
        {aTraiter.length === 0 ? <CircleCheck aria-hidden size={20} className="text-sage" /> : <CircleAlert aria-hidden size={20} className={grave ? 'text-clay' : 'text-ambre'} />}
        <div className="min-w-0 flex-1">
          <b className={`block font-heading text-[16px] font-bold ${aTraiter.length === 0 ? 'text-sage' : grave ? 'text-clay' : 'text-ambre'}`}>
            {aTraiter.length === 0 ? 'Tous les services fonctionnent normalement' : `${aTraiter.length} point${aTraiter.length > 1 ? 's' : ''} demande${aTraiter.length > 1 ? 'nt' : ''} votre attention`}
          </b>
          <span className="block text-[12.5px] text-text-muted">
            Relevé le {releve(s.genereLe)} · {normaux.length} service{normaux.length > 1 ? 's' : ''} fonctionne{normaux.length > 1 ? 'nt' : ''} normalement · état général : {LIBELLE_ETAT[s.etatGlobal].toLowerCase()}
          </span>
        </div>
        <button type="button" className={BTN_SECONDAIRE} onClick={charger}>
          <RefreshCw aria-hidden size={15} />
          Actualiser
        </button>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Panneau titre="À traiter" compteur={<Chip n={aTraiter.length} ton="rouge" />} testid="services-a-traiter">
          {aTraiter.length === 0 ? (
            <EtatVide texte="Rien à traiter." />
          ) : (
            <ul>
              {aTraiter.map((x) => (
                <Point key={x.cle} testid="service" cle={x.cle} ton={tonDe(x.etat)} etat={LIBELLE_ETAT[x.etat]} titre={x.libelle} detail={x.detail} action={action(x.action)} />
              ))}
            </ul>
          )}
        </Panneau>
        <Panneau titre="Fonctionne normalement" compteur={<Chip n={normaux.length} ton="vert" />} testid="services-normaux">
          <ul>
            {normaux.map((x) => (
              <Point key={x.cle} testid="service" cle={x.cle} ton="ok" etat={LIBELLE_ETAT[x.etat]} titre={x.libelle} detail={x.detail} />
            ))}
            <Point ton={s.connexions.echecs24h ? 'attention' : 'ok'} titre="Connexions (24 h)" detail={`${s.connexions.reussies24h} réussie(s) · ${s.connexions.echecs24h} échec(s) · ${s.sessions.ouvertes} session(s) ouverte(s), expirées après ${s.sessions.expirationJours} jours d’inactivité`} />
          </ul>
        </Panneau>
      </div>

      <Panneau titre="Sauvegardes" testid="sauvegardes">
        <ul>
          <Point
            ton={sv.testEnRetard ? 'attention' : sv.testRestauration?.resultat === 'ECHEC' ? 'grave' : 'ok'}
            titre="Test de restauration"
            detail={
              <>
                {sv.testRestauration
                  ? `Dernier test le ${date(sv.testRestauration.date)} — ${sv.testRestauration.resultat === 'REUSSI' ? 'réussi' : 'échec'}${sv.testRestauration.declarePar ? ` (${sv.testRestauration.declarePar})` : ''}.`
                  : 'Aucun test déclaré.'}
                {sv.testEnRetard && ' Un test tous les 6 mois est recommandé.'}
              </>
            }
            action={
              s.droits.peutDeclarerTest ? (
                <button type="button" className={BTN_LIGNE} onClick={() => setTest(true)}>
                  Déclarer un test<span className="sr-only"> de restauration</span>
                </button>
              ) : undefined
            }
          />
          <Point ton="ok" titre="Base de données" detail={sv.gestion} />
          {s.droits.peutDeclarerTest && <SauvegardeFichiers />}
        </ul>
      </Panneau>

      <Panneau titre="Tâches planifiées" compteur={<span className="text-[13px] font-semibold text-text-muted">{s.taches.length}</span>} testid="taches-planifiees">
        <div id="taches-planifiees" />
        <ul>
          {s.taches.map((t) => (
            <li key={t.tache} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#F0F1F6] px-4 py-2.5 text-[13px] last:border-b-0">
              <span className="min-w-0 flex-1 font-semibold">{t.libelle}</span>
              <span className="text-[12.5px] text-text-muted">{t.derniere ? dateHeure(t.derniere.debut) : 'Pas encore exécutée'}</span>
              {t.derniere && <Pastille ton={t.derniere.statut === 'ECHEC' ? 'rouge' : t.derniere.statut === 'SUCCES' ? 'vert' : 'gris'}>{t.derniere.statut === 'SUCCES' ? 'Réussie' : t.derniere.statut === 'ECHEC' ? 'Échec' : 'En cours'}</Pastille>}
              {t.echecs24h > 0 && <span className="text-[12.5px] text-clay">{t.echecs24h} échec(s) en 24 h</span>}
            </li>
          ))}
        </ul>
      </Panneau>

      <Panneau titre="Comptes à surveiller" compteur={<span className="text-[13px] font-semibold text-text-muted">{s.comptesASurveiller.length}</span>} testid="comptes-a-surveiller">
        {s.comptesASurveiller.length === 0 ? (
          <EtatVide texte="Aucun compte à surveiller." />
        ) : (
          <ul>
            {s.comptesASurveiller.map((c) => (
              <li key={c.id + c.motif} className="border-b border-[#F0F1F6] px-4 py-2.5 text-[13px] last:border-b-0">
                <strong className="font-semibold">{c.nom}</strong> <span className="text-text-muted">({c.email})</span> — {c.motif}
              </li>
            ))}
          </ul>
        )}
        {s.finsProches.length > 0 && (
          <div className="border-t border-line px-4 py-2.5">
            <h3 className="mb-1 text-[13px] font-bold text-ink-900">Fins de stage ou de contrat proches</h3>
            <ul className="space-y-1 text-[13px]">
              {s.finsProches.map((f) => (
                <li key={f.agentId}>
                  {f.nom} — {f.nature === 'STAGE' ? 'fin de stage' : 'fin de contrat'} le {date(f.date)}
                  {f.confirmee ? ' (confirmée)' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panneau>

      <Panneau
        titre="Accès refusés"
        testid="acces-refuses"
        action={
          <FiltreSelect<'24h' | '7j' | '30j'>
            label="Période"
            value={periode}
            defaut="7j"
            onChange={setPeriode}
            options={[
              { value: '24h', label: '24 heures' },
              { value: '7j', label: '7 jours' },
              { value: '30j', label: '30 jours' },
            ]}
          />
        }
      >
        <p className="border-b border-line px-4 py-2.5 text-[13px]">{refus.length === 0 ? 'Aucun refus sur la période.' : refus.map((r) => `${LIBELLE_ETAPE[r.etape] ?? r.etape} : ${r.nombre}`).join(' · ')}</p>
        <ul>
          {s.accesRefuses.derniers.map((r) => (
            <li key={r.id} className="grid gap-x-3 gap-y-0.5 border-b border-[#F0F1F6] px-4 py-2 text-[12.5px] last:border-b-0 lg:grid-cols-[130px_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]">
              <span className="whitespace-nowrap text-text-muted">{dateHeure(r.date)}</span>
              <span>{r.compte}</span>
              <span className="break-all font-mono text-[11.5px] text-text-muted">
                {r.methode} {r.route}
              </span>
              <span>{LIBELLE_ETAPE[r.etape] ?? r.etape}</span>
              <span className="text-text-muted">{r.motif}</span>
            </li>
          ))}
        </ul>
      </Panneau>

      {test && (
        <FenetreTest
          onClose={() => setTest(false)}
          onFait={(r) => {
            setTest(false);
            charger();
            toast.succes('Test de restauration déclaré', { detail: r === 'REUSSI' ? 'Résultat : réussi.' : 'Résultat : échec — à reprendre.' });
          }}
        />
      )}
    </div>
  );
}

function FenetreTest({ onClose, onFait }: { onClose: () => void; onFait: (resultat: 'REUSSI' | 'ECHEC') => void }) {
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
      onFait(resultat);
    } catch (e) {
      setErreur(messageErreur(e, 'Déclaration impossible'));
      setEnCours(false);
    }
  };
  return (
    <FenetreFormulaire
      titre="Test de restauration"
      sousTitre="Restauration d’une sauvegarde sur une base de test."
      onClose={onClose}
      onSubmit={envoyer}
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Déclarer"
      pied="Un test tous les 6 mois est recommandé ; la déclaration est tracée."
    >
      <Grille2>
        <ChampDate id="tr-date" label="Date du test" value={jour} onChange={setJour} required max={new Date().toISOString().slice(0, 10)} />
        <ChoixSegment<'REUSSI' | 'ECHEC'>
          id="tr-resultat"
          label="Résultat"
          options={[
            { value: 'REUSSI', label: 'Réussi' },
            { value: 'ECHEC', label: 'Échec' },
          ]}
          value={resultat}
          onChange={setResultat}
        />
      </Grille2>
      <ZoneTexte id="tr-commentaire" label="Commentaire" facultatif value={commentaire} onChange={setCommentaire} />
    </FenetreFormulaire>
  );
}
