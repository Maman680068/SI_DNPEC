'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Download, Eye, FilePlus2, FileText, LogIn, LogOut, Pencil, ShieldCheck, ShieldAlert, Trash2, Check, XCircle, Megaphone, X } from 'lucide-react';
import { exporterJournalAudit, lireJournalAudit, verifierJournalAudit } from '../../../lib/api/securite';
import type { EntreeAudit, PageAudit, VerificationAudit } from '../../../lib/securite/types';
import { ACTIONS_AUDIT } from '../../../lib/securite/types';
import { ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { Case, ChampDate } from '../../../components/ui/Formulaire';
import { SquelettePage } from '../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../components/ui/Toast';
import { Bandeau, BarreOutils, BTN_LIGNE, BTN_SECONDAIRE, CleValeur, EnTetePage, EtatVide, Filtres, FiltreSelect, Pastille, Recherche, SectionFenetre } from '../../../components/ui/Charte';
import { FenetreDetail } from '../../../components/ui/FenetreDetail';

const heure = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dateComplete = (d: string) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'medium' });
const jourLong = (j: string) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const ICONES: Record<string, typeof Pencil> = {
  CREATION: FilePlus2,
  MODIFICATION: Pencil,
  SUPPRESSION: Trash2,
  VALIDATION: Check,
  REJET: XCircle,
  PUBLICATION: Megaphone,
  CONNEXION: LogIn,
  DECONNEXION: LogOut,
  CONSULTATION: Eye,
  EXPORT: Download,
};

/**
 * Journal d'audit (socle N2, refait en S9a) : chaque entrée est une phrase en français calculée par l'API
 * (auteur, verbe, objet nommé ; libellé générique pour un objet protégé), regroupée par jour, avec une icône
 * par action ; le sceau apparaît une fois en tête (état, nombre d'entrées, dernière vérification, « Vérifier
 * maintenant ») ; fiche au clic (auteur, action, objet, lien, avant / après, empreinte) ; filtres recherche,
 * période, auteur, domaine, action, « Sensibles seulement » ; export PDF et CSV (journalisé). Portée fixée
 * par l'API selon l'annexe 1 ; le journal reste en écriture seule.
 */
export default function JournalAuditPage() {
  const [page, setPage] = useState<PageAudit | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtres, setFiltres] = useState<Record<string, string>>({});
  const [numero, setNumero] = useState(1);
  const [verif, setVerif] = useState<VerificationAudit | null>(null);
  const [detail, setDetail] = useState<EntreeAudit | null>(null);
  /** Nom de l'auteur filtré (affiché dans la barre de filtres ; l'API filtre sur `acteurId`). */
  const [auteurFiltre, setAuteurFiltre] = useState<string | null>(null);
  const toast = useToast();

  const charger = useCallback(() => {
    lireJournalAudit({ ...filtres, page: numero, taille: 50 })
      .then((p) => {
        setPage(p);
        setErreur(null);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, [filtres, numero]);
  useEffect(charger, [charger]);

  const filtre = (k: string, v: string) => {
    setNumero(1);
    setFiltres((f) => ({ ...f, [k]: v }));
  };
  const effacer = () => {
    setNumero(1);
    setFiltres({});
    setAuteurFiltre(null);
  };
  const verifier = () =>
    verifierJournalAudit()
      .then((v) => {
        setVerif(v);
        charger();
      })
      .catch((e) => toast.erreur('Vérification impossible', messageErreur(e)));
  const exporter = (format: 'csv' | 'pdf') =>
    exporterJournalAudit(filtres, format)
      .then(() => toast.succes(`Export ${format.toUpperCase()} téléchargé`, { detail: 'L’export est lui-même inscrit au journal.' }))
      .catch((e) => toast.erreur('Export impossible', messageErreur(e)));

  if (!page)
    return (
      <div>
        <ErreurChargement message={erreur} />
        {erreur ? <EnTetePage titre="Journal d’audit" /> : <SquelettePage />}
      </div>
    );
  const nbPages = Math.max(1, Math.ceil(page.total / page.taille));
  const filtresActifs = ['du', 'au', 'domaine', 'action', 'acteurId', 'sensibles'].filter((k) => filtres[k]).length;
  const dateFiltre = (k: 'du' | 'au', libelle: string) => (
    <div className="flex items-center gap-1.5 text-[12.5px] text-text-muted md:w-[210px] [&>div]:mb-0 [&>div]:min-w-0 [&>div]:flex-1 [&_input]:!h-9 [&_label]:sr-only">
      <span aria-hidden className="w-6 flex-none md:w-auto">{libelle}</span>
      <ChampDate id={`journal-${k}`} label={k === 'du' ? 'Du' : 'Au'} value={filtres[k] ?? ''} onChange={(v) => filtre(k, v)} raccourcis={false} />
    </div>
  );
  const parJour = page.entrees.reduce<{ jour: string; entrees: EntreeAudit[] }[]>((acc, e) => {
    const dernier = acc[acc.length - 1];
    if (dernier && dernier.jour === e.jour) dernier.entrees.push(e);
    else acc.push({ jour: e.jour, entrees: [e] });
    return acc;
  }, []);
  const s = page.sceau;

  return (
    <div>
      <EnTetePage
        titre="Journal d’audit"
        sousTitre={
          <>
            Portée : <strong className="text-text">{page.portee}</strong>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_SECONDAIRE} onClick={() => exporter('pdf')}>
              <FileText aria-hidden size={15} /> Exporter en PDF
            </button>
            <button type="button" className={BTN_SECONDAIRE} onClick={() => exporter('csv')}>
              <Download aria-hidden size={15} /> Exporter en CSV
            </button>
          </div>
        }
      />
      {/* Le sceau, une seule fois en tête. */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3" data-testid="sceau-journal">
        <span className={`grid h-10 w-10 place-items-center rounded-full ${s.intacte === false ? 'bg-clay-50 text-clay' : 'bg-sage-50 text-sage'}`} aria-hidden>
          {s.intacte === false ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
        </span>
        <div className="min-w-0 flex-1 text-[13px]">
          <b className="block text-[14px] text-ink-900">{s.intacte === false ? 'Chaîne rompue : le journal a été altéré en dehors de l’application' : s.intacte ? 'Journal scellé, chaîne intacte' : 'Journal scellé, pas encore vérifié'}</b>
          <span className="text-text-muted">
            {s.entrees.toLocaleString('fr-FR')} entrées · dernière vérification : {s.derniereVerification ? dateComplete(s.derniereVerification) : 'jamais'} · vérifié automatiquement chaque nuit. Écriture seule : personne, administrateur compris, ne peut le modifier ni l’effacer.
          </span>
        </div>
        {page.droits.peutVerifier && (
          <button type="button" className={BTN_SECONDAIRE} onClick={verifier}>
            <ShieldCheck aria-hidden size={16} /> Vérifier maintenant
          </button>
        )}
      </div>
      <ErreurChargement message={erreur} />
      {verif && (
        <Bandeau ton={verif.intacte ? 'vert' : 'rouge'} testid="verification-audit">
          {verif.intacte
            ? `Chaîne intacte : ${verif.lignesVerifiees} entrées scellées vérifiées${verif.nonScellees ? `, ${verif.nonScellees} en attente de scellement (moins d’une minute)` : ''}.`
            : `Chaîne rompue à l’entrée n° ${verif.rangRompu} : le journal a été altéré en dehors de l’application.`}
        </Bandeau>
      )}

      <BarreOutils>
        <Recherche value={filtres.q ?? ''} onChange={(v) => filtre('q', v)} placeholder="Auteur, objet, identifiant…" label="Rechercher dans le journal" />
        <Filtres actifs={filtresActifs} onEffacer={effacer}>
          {dateFiltre('du', 'Du')}
          {dateFiltre('au', 'au')}
          <FiltreSelect label="Domaine" value={filtres.domaine ?? ''} defaut="" onChange={(v) => filtre('domaine', v)} options={[{ value: '', label: 'Tous les domaines' }, ...page.domaines.map((d) => ({ value: d.valeur, label: d.libelle }))]} />
          <FiltreSelect label="Action" value={filtres.action ?? ''} defaut="" onChange={(v) => filtre('action', v)} options={[{ value: '', label: 'Toutes les actions' }, ...Object.entries(ACTIONS_AUDIT).map(([k, v]) => ({ value: k, label: v }))]} />
          <div className="flex h-9 items-center [&>div]:mb-0">
            <Case id="journal-sensibles" label="Sensibles seulement" checked={filtres.sensibles === '1'} onChange={(v) => filtre('sensibles', v ? '1' : '')} />
          </div>
          {filtres.acteurId && (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-ink bg-ink-50 px-2.5 text-[13px] font-semibold text-ink"
              onClick={() => (filtre('acteurId', ''), setAuteurFiltre(null))}
              aria-label={`Retirer le filtre sur l’auteur ${auteurFiltre ?? ''}`.trim()}
              data-testid="filtre-auteur"
            >
              Auteur : {auteurFiltre ?? '…'}
              <X aria-hidden size={14} />
            </button>
          )}
        </Filtres>
      </BarreOutils>

      {page.entrees.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EtatVide texte="Aucune entrée ne correspond." action={filtresActifs || filtres.q ? <button type="button" className={BTN_SECONDAIRE} onClick={effacer}>Effacer les filtres</button> : undefined} />
        </div>
      ) : (
        <div className="space-y-3" data-testid="journal">
          {parJour.map(({ jour, entrees }) => (
            <Fragment key={jour}>
              <h2 className="text-[13px] font-bold capitalize text-text-muted" data-testid="jour-journal">
                {jourLong(jour)}
              </h2>
              <ul className="divide-y divide-line-doux rounded-xl border border-line bg-surface">
                {entrees.map((e) => {
                  const Icone = ICONES[e.icone] ?? Pencil;
                  return (
                    <li key={e.id} data-testid="entree-audit" className="flex items-start gap-3 px-4 py-2.5">
                      <span aria-hidden className={`mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full ${e.sensible ? 'bg-gold-50 text-ambre' : 'bg-ink-50 text-ink'}`}>
                        <Icone size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] text-text">{e.phrase}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-text-muted">
                          <span>{heure(e.date)}</span>
                          <span>· n° {e.numero}</span>
                          <span>· {e.domaine}</span>
                          {e.sensible && <Pastille ton="ambre">Sensible</Pastille>}
                          {!e.scellee && <Pastille ton="gris">En attente de scellement</Pastille>}
                        </p>
                      </div>
                      <button type="button" className={BTN_LIGNE} aria-label={`Voir l’entrée n° ${e.numero}`} onClick={() => setDetail(e)}>
                        Voir
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Fragment>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-text-muted">
        <span>
          {page.total.toLocaleString('fr-FR')} entrée{page.total > 1 ? 's' : ''} · page {page.page} sur {nbPages}
        </span>
        <span className="flex gap-1.5">
          <button type="button" className={BTN_LIGNE} disabled={numero <= 1} onClick={() => setNumero((n) => n - 1)}>
            Précédentes
          </button>
          <button type="button" className={BTN_LIGNE} disabled={numero >= nbPages} onClick={() => setNumero((n) => n + 1)}>
            Suivantes
          </button>
        </span>
      </div>

      {detail && (
        <FenetreDetail
          titre={`Entrée n° ${detail.numero}`}
          onClose={() => setDetail(null)}
          largeur={760}
          testid="fenetre-entree-audit"
          filAriane={['Journal d’audit']}
          cote={
            <div className="grid gap-2">
              {detail.objet.lien && (
                <Link href={detail.objet.lien} className={BTN_SECONDAIRE}>
                  Ouvrir l’objet
                </Link>
              )}
              {detail.acteur && (
                <button
                  type="button"
                  className={BTN_SECONDAIRE}
                  onClick={() => {
                    filtre('acteurId', detail.acteur!.id);
                    setAuteurFiltre(detail.acteur!.nom);
                    setDetail(null);
                  }}
                >
                  Voir les actions de cet auteur
                </button>
              )}
            </div>
          }
        >
          <p className="mb-3 text-[14px] font-semibold text-ink-900" data-testid="phrase-audit">
            {detail.phrase}
          </p>
          <CleValeur
            largeur={130}
            lignes={[
              ['Date', dateComplete(detail.date)],
              ['Auteur', detail.acteur ? `${detail.acteur.nom}${detail.auNomDe ? ` (par intérim, au nom de ${detail.auNomDe.nom})` : ''}` : 'Le système'],
              ['Action', detail.libelle],
              ['Objet', detail.objet.protege ? `${detail.objet.libelle} (protégé : sans titre ni contenu)` : detail.objet.libelle],
              ['Domaine', detail.domaine],
              ...(detail.objetId ? ([['Identifiant', <span key="i" className="break-all font-mono text-[12px]">{detail.objetId}</span>]] as [string, React.ReactNode][]) : []),
            ]}
          />
          {detail.avantApres.length > 0 && (
            <SectionFenetre titre="Avant / après">
              <table className="w-full text-left text-[12.5px]" data-testid="avant-apres">
                <thead>
                  <tr className="text-text-muted">
                    <th className="py-1 pr-3 font-semibold">Champ</th>
                    <th className="py-1 pr-3 font-semibold">Avant</th>
                    <th className="py-1 font-semibold">Après</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.avantApres.map((l) => (
                    <tr key={l.champ} className="border-t border-line-doux">
                      <td className="py-1 pr-3">{l.champ}</td>
                      <td className="break-all py-1 pr-3">{l.avant}</td>
                      <td className="break-all py-1">{l.apres}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionFenetre>
          )}
          <SectionFenetre titre="Scellement">
            <p className="text-[12.5px] text-text-muted">
              {detail.scellee ? 'Entrée scellée et chaînée à la précédente : toute altération en dehors de l’application est détectée par la vérification.' : 'En attente de scellement (moins d’une minute).'}
            </p>
            {detail.empreinte && <p className="mt-1 break-all font-mono text-[11.5px] text-text-muted" data-testid="empreinte-audit">Empreinte : {detail.empreinte}</p>}
          </SectionFenetre>
        </FenetreDetail>
      )}
    </div>
  );
}
