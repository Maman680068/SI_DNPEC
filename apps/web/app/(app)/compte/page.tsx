'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, CircleHelp, Lock, Palette } from 'lucide-react';
import { ChoixTheme } from '../../../components/layout/MenuHaut';
import { useAuth } from '../../../lib/auth/AuthProvider';
import {
  activerDoubleAuth,
  configurerDoubleAuth,
  desactiverDoubleAuth,
  fermerSession,
  forgotPasswordRequest,
  getProfil,
  listerSessions,
  type Profil,
  type SessionOuverte,
} from '../../../lib/api/auth';
import { getPreferences, modifierPreferences } from '../../../lib/api/pilotage';
import type { PreferencesNotification } from '../../../lib/pilotage/types';
import { ROLE_LABEL } from '../../../lib/users/types';
import type { SystemRole } from '../../../lib/auth/types';
import { BTN_LIGNE, BTN_LIGNE_PRINCIPAL, CleValeur, EnTetePage, Pastille } from '../../../components/ui/Charte';
import { ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { Barre } from '../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../components/ui/Toast';
import { Fenetre } from '../../../components/ui/Fenetre';

/**
 * Mon profil (refonte, étape 9, maquette `apres-profil`) : identité, unité, chef direct, matricule,
 * complétude de son dossier (GET api/v1/profil) ; sécurité — mot de passe (lien de changement envoyé
 * par email, route existante), double authentification, sessions ouvertes — ; notifications ; aide.
 * Les anciennes pages « Sécurité du compte » et « Préférences de notification » sont devenues des
 * sections de cette page (?section=securite | notifications, redirections dans anciens-liens.json).
 */
/** Sections que `?section=` peut viser (liens des emails, anciennes adresses). */
const SECTIONS: string[] = ['securite', 'notifications', 'aide'];

export default function ProfilPage() {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => {
    getProfil()
      .then(setProfil)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);

  // ?section=securite | notifications | aide : la section est amenée à l'écran.
  const deja = useRef(false);
  useEffect(() => {
    if (!profil || deja.current) return;
    deja.current = true;
    const s = new URLSearchParams(window.location.search).get('section');
    if (s && SECTIONS.includes(s)) document.getElementById(`section-${s}`)?.scrollIntoView({ block: 'start' });
  }, [profil]);

  return (
    <div>
      <EnTetePage titre="Mon profil" />
      <ErreurChargement message={erreur} />
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <CarteIdentite profil={profil} />
        <div className="min-w-0 space-y-4">
          <SectionSecurite profil={profil} onChange={charger} />
          <SectionNotifications />
          <SectionAffichage />
          <SectionAide />
        </div>
      </div>
    </div>
  );
}

function Section({ id, icone, titre, children }: { id: string; icone: ReactNode; titre: string; children: ReactNode }) {
  return (
    <section id={`section-${id}`} aria-labelledby={`titre-${id}`} className="scroll-mt-4 overflow-hidden rounded-xl border border-line bg-surface">
      <h2 id={`titre-${id}`} className="flex items-center gap-2.5 border-b border-line px-[18px] py-3.5 font-heading text-[16px] font-extrabold text-ink-900">
        <span aria-hidden className="text-ink">
          {icone}
        </span>
        {titre}
      </h2>
      <div className="divide-y divide-line-doux">{children}</div>
    </section>
  );
}

function Ligne({ titre, sous, milieu, action, testid }: { titre: ReactNode; sous?: ReactNode; milieu?: ReactNode; action?: ReactNode; testid?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-[18px] py-3" data-testid={testid}>
      <div className="min-w-0 flex-1">
        <b className="block text-[14px] font-semibold text-text">{titre}</b>
        {sous && <span className="block text-[12.5px] text-text-muted">{sous}</span>}
      </div>
      {milieu}
      {action && <div className="flex flex-none items-center gap-2">{action}</div>}
    </div>
  );
}

function CarteIdentite({ profil }: { profil: Profil | null }) {
  if (!profil) {
    return (
      <div className="space-y-3 rounded-xl border border-line bg-surface p-5" role="status" aria-label="Chargement en cours">
        <span className="sr-only">Chargement en cours</span>
        <Barre className="mx-auto h-[84px] w-[84px] rounded-full" />
        <Barre className="mx-auto h-4 w-[60%]" />
        <Barre className="mx-auto h-3 w-[45%]" />
        <Barre className="h-3 w-full" />
        <Barre className="h-3 w-[80%]" />
      </div>
    );
  }
  const nomAffiche = `${profil.prenom} ${profil.nom}`.replace(/^\s*TEST\s*[—–-]\s*/i, '');
  const init = nomAffiche
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join('');
  const c = profil.completude;
  return (
    <div className="rounded-xl border border-line bg-surface p-5" data-testid="carte-identite">
      <div className="mb-4 text-center">
        <span aria-hidden className="mx-auto mb-2.5 grid h-[84px] w-[84px] place-items-center rounded-full bg-gold font-heading text-[28px] font-extrabold text-sur-or">
          {init}
        </span>
        <p className="font-heading text-[18px] font-extrabold text-ink-900">
          {profil.prenom} {profil.nom}
        </p>
        <p className="text-[13px] text-text-muted">{profil.fonction ?? ROLE_LABEL[profil.role as SystemRole] ?? profil.role}</p>
      </div>
      <CleValeur
        largeur={96}
        lignes={[
          ['Unité', <b key="u" className="font-semibold">{profil.unite ?? 'Direction'}</b>],
          ['Chef direct', <b key="c" className="font-semibold">{profil.chefDirect ?? '—'}</b>],
          ['Matricule', <b key="m" className="font-semibold">{profil.matricule ? `${profil.matricule.valeur}${profil.matricule.provisoire ? ' (provisoire)' : ''}` : '—'}</b>],
          ['Email', <b key="e" className="break-all font-semibold">{profil.email}</b>],
          ['Téléphone', <b key="t" className="font-semibold">{profil.telephone ?? '—'}</b>],
        ]}
      />
      <div className={`mt-4 rounded-[10px] px-3.5 py-3 text-[12.5px] ${c.pourcentage >= 100 ? 'bg-sage-50' : 'bg-gold-50'}`} data-testid="completude">
        <p className="mb-2 font-bold text-ink-900">Profil complété à {c.pourcentage} %</p>
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label="Complétude du dossier" aria-valuenow={c.pourcentage} aria-valuemin={0} aria-valuemax={100}>
          <span className={`block h-full rounded-full ${c.pourcentage >= 100 ? 'bg-sage' : 'bg-gold'}`} style={{ width: `${c.pourcentage}%` }} />
        </div>
        {c.manquants.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4 text-ambre">
            {c.manquants.slice(0, 5).map((m) => (
              <li key={m}>{m}</li>
            ))}
            {c.manquants.length > 5 && <li>et {c.manquants.length - 5} autre(s) élément(s)</li>}
          </ul>
        ) : (
          <p className="text-sage">Votre dossier est complet.</p>
        )}
        <Link href="/personnel" className="mt-2 inline-block font-semibold text-ink underline-offset-2 hover:underline">
          Voir mon dossier
        </Link>
      </div>
    </div>
  );
}

const ilYA = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} jour${j > 1 ? 's' : ''}`;
};

function SectionSecurite({ profil, onChange }: { profil: Profil | null; onChange: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionOuverte[] | null>(null);
  const [fenetre, setFenetre] = useState<null | 'activer' | 'desactiver'>(null);
  const [qr, setQr] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const chargerSessions = useCallback(() => {
    listerSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);
  useEffect(() => {
    chargerSessions();
  }, [chargerSessions]);

  async function envoyerLien() {
    if (!user) return;
    try {
      await forgotPasswordRequest(user.email);
      toast.succes('Lien envoyé', { detail: `Un lien pour choisir un nouveau mot de passe a été envoyé à ${user.email}.` });
    } catch (e) {
      toast.erreur('Envoi impossible', messageErreur(e));
    }
  }
  async function ouvrirActivation() {
    setErreur(null);
    setCode('');
    setFenetre('activer');
    try {
      setQr(await configurerDoubleAuth());
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de générer le QR code.'));
    }
  }
  async function confirmer() {
    setEnCours(true);
    setErreur(null);
    try {
      if (fenetre === 'activer') await activerDoubleAuth(code);
      else await desactiverDoubleAuth(code);
      toast.succes(fenetre === 'activer' ? 'Double authentification activée' : 'Double authentification désactivée', {
        detail: fenetre === 'activer' ? 'Le code sera demandé à votre prochaine connexion.' : undefined,
      });
      setFenetre(null);
      setQr(null);
      onChange();
    } catch (e) {
      setErreur(messageErreur(e, 'Code incorrect.'));
    } finally {
      setEnCours(false);
    }
  }
  async function fermer(s: SessionOuverte) {
    try {
      await fermerSession(s.id);
      toast.succes('Session fermée', { detail: s.deviceLabel ?? 'Appareil inconnu' });
      chargerSessions();
    } catch (e) {
      toast.erreur('Action impossible', messageErreur(e));
    }
  }

  return (
    <Section id="securite" icone={<Lock size={18} />} titre="Sécurité">
      <Ligne
        titre="Mot de passe"
        sous="Pour le changer, recevez par email un lien valable une heure."
        action={
          <button type="button" className={BTN_LIGNE} onClick={envoyerLien}>
            Changer
          </button>
        }
      />
      <Ligne
        testid="double-auth"
        titre="Double authentification"
        sous="Un code à 6 chiffres de votre téléphone à chaque connexion"
        milieu={profil && <Pastille ton={profil.deuxFacteurs ? 'vert' : 'gris'}>{profil.deuxFacteurs ? 'Activée' : 'Désactivée'}</Pastille>}
        action={
          profil &&
          (profil.deuxFacteurs ? (
            <button type="button" className={BTN_LIGNE} onClick={() => (setErreur(null), setCode(''), setFenetre('desactiver'))}>
              Désactiver
            </button>
          ) : (
            <button type="button" className={BTN_LIGNE_PRINCIPAL} onClick={ouvrirActivation}>
              Activer
            </button>
          ))
        }
      />
      <div className="px-[18px] py-3" data-testid="sessions">
        <b className="block text-[14px] font-semibold text-text">Sessions ouvertes</b>
        <span className="mb-2 block text-[12.5px] text-text-muted">Appareils connectés à votre compte. Fermez une session que vous ne reconnaissez pas.</span>
        {!sessions ? (
          <Barre className="h-3 w-[60%]" />
        ) : sessions.length === 0 ? (
          <p className="text-[13px] text-text-muted">Aucune autre session.</p>
        ) : (
          <ul className="divide-y divide-line-doux rounded-[10px] border border-line">
            {sessions.map((s, i) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]" data-testid="session">
                <span className="min-w-0 flex-1">
                  <b className="font-semibold">{s.deviceLabel ?? 'Appareil inconnu'}</b>
                  <span className="text-text-muted"> · dernière activité {ilYA(s.lastUsedAt)}</span>
                  {i === 0 && <span className="text-text-muted"> · probablement cet appareil</span>}
                </span>
                <button type="button" className={BTN_LIGNE} onClick={() => void fermer(s)} aria-label={`Déconnecter ${s.deviceLabel ?? 'cet appareil'}`}>
                  Déconnecter
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {fenetre && (
        <Fenetre
          titre={fenetre === 'activer' ? 'Activer la double authentification' : 'Désactiver la double authentification'}
          onClose={() => (setFenetre(null), setQr(null))}
          onSubmit={confirmer}
          libelleValider={fenetre === 'activer' ? 'Confirmer l’activation' : 'Désactiver'}
          enCours={enCours}
          erreur={erreur}
          danger={fenetre === 'desactiver'}
          pied={fenetre === 'desactiver' ? 'Téléphone perdu ? Demandez à l’administrateur système de réinitialiser la double authentification.' : undefined}
        >
          {fenetre === 'activer' && (
            <>
              <ol className="mb-3 list-decimal pl-5 text-[13px]">
                <li>Ouvrez l’application d’authentification de votre téléphone (Google Authenticator, Microsoft Authenticator, FreeOTP…) et ajoutez un compte.</li>
                <li>Scannez ce QR code (ou saisissez la clé affichée dessous).</li>
                <li>Saisissez le code à 6 chiffres qu’elle affiche.</li>
              </ol>
              {qr && (
                <div className="mb-3 inline-block rounded-[10px] border border-line bg-fond-doux p-3 text-center">
                  <img src={qr.qrCodeDataUrl} alt="QR code de la double authentification" className="mx-auto h-40 w-40" />
                  <p className="mt-2 break-all font-mono text-[11px]" data-testid="cle-manuelle">
                    {qr.secret}
                  </p>
                </div>
              )}
            </>
          )}
          <div className="mb-2">
            <label htmlFor="code-2fa" className="mb-1.5 block text-[13px] font-semibold">
              {fenetre === 'activer' ? 'Code à 6 chiffres affiché par l’application' : 'Code actuel de votre application'}
            </label>
            <input
              id="code-2fa"
              className="h-10 w-40 rounded-[10px] border border-line px-3 tracking-[0.3em]"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>
        </Fenetre>
      )}
    </Section>
  );
}

const HEURES = Array.from({ length: 24 }, (_, h) => h);

function SectionNotifications() {
  const toast = useToast();
  const [p, setP] = useState<PreferencesNotification | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    getPreferences()
      .then(setP)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  async function enregistrer(resumeQuotidien: boolean, heureResume: number) {
    if (!p) return;
    const avant = p;
    setP({ ...p, resumeQuotidien, heureResume });
    try {
      setP(await modifierPreferences({ resumeQuotidien, heureResume }));
      toast.succes('Préférences enregistrées', {
        detail: resumeQuotidien ? `Résumé quotidien à ${String(heureResume).padStart(2, '0')} h 00.` : 'Un email par notification.',
        annuler: async () => {
          setP(await modifierPreferences({ resumeQuotidien: avant.resumeQuotidien, heureResume: avant.heureResume }));
        },
      });
    } catch (e) {
      setP(avant);
      toast.erreur('Enregistrement impossible', messageErreur(e));
    }
  }
  return (
    <Section id="notifications" icone={<Bell size={18} />} titre="Notifications">
      {erreur && <p className="px-[18px] py-3 text-[13px] text-clay">{erreur}</p>}
      {!p ? (
        !erreur && (
          <div className="px-[18px] py-4">
            <Barre className="h-3 w-[50%]" />
          </div>
        )
      ) : (
        <>
          <Ligne
            testid="resume-quotidien"
            titre={<label htmlFor="resume-quotidien">Résumé quotidien par email</label>}
            sous={p.resumeQuotidien ? `Un seul email à ${String(p.heureResume).padStart(2, '0')}:00 pour les notifications ordinaires` : 'Désactivé : un email par notification'}
            action={
              <button
                id="resume-quotidien"
                type="button"
                role="switch"
                aria-checked={p.resumeQuotidien}
                onClick={() => void enregistrer(!p.resumeQuotidien, p.heureResume)}
                className={`relative h-[26px] w-[46px] rounded-full transition-colors ${p.resumeQuotidien ? 'bg-sage' : 'bg-line-fort'}`}
              >
                <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all ${p.resumeQuotidien ? 'left-[23px]' : 'left-[3px]'}`} />
              </button>
            }
          />
          {p.resumeQuotidien && (
            <Ligne
              titre={<label htmlFor="heure-resume">Heure du résumé</label>}
              sous="Heure de Conakry"
              action={
                <select id="heure-resume" value={p.heureResume} onChange={(e) => void enregistrer(true, Number(e.target.value))} className="h-9 rounded-[9px] border border-line bg-surface px-2.5 text-[13px] font-semibold">
                  {HEURES.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              }
            />
          )}
          <p className="px-[18px] py-3 text-[12.5px] text-text-muted">
            Toujours envoyés immédiatement : sécurité du compte, décision sur une de vos demandes, acte à signer, instruction de la Direction, tâche en retard, rappel ou annulation de réunion, alerte de supervision.
            {p.enAttente > 0 && <span data-testid="en-attente"> {p.enAttente} email(s) en attente du prochain résumé.</span>}
          </p>
        </>
      )}
    </Section>
  );
}

/** Affichage : thème clair ou sombre, gardé dans ce navigateur (même choix que le menu du compte). */
function SectionAffichage() {
  return (
    <Section id="affichage" icone={<Palette size={18} />} titre="Affichage">
      <Ligne titre="Thème de l’application" sous="Clair par défaut ; le choix est gardé dans ce navigateur" action={<ChoixTheme />} testid="ligne-theme" />
    </Section>
  );
}

function SectionAide() {
  return (
    <Section id="aide" icone={<CircleHelp size={18} />} titre="Aide">
      <Ligne
        titre="Guide de votre profil"
        sous="Les écrans et les gestes de votre rôle, pas à pas"
        action={
          <Link href="/aide" className={BTN_LIGNE}>
            Ouvrir
          </Link>
        }
      />
      <Ligne
        titre="Premiers pas"
        sous="Se repérer dans l’application : menu, Créer, recherche, notifications"
        action={
          <Link href="/aide#premiers-pas" className={BTN_LIGNE}>
            Lire
          </Link>
        }
      />
    </Section>
  );
}
