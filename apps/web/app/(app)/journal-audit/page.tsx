'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { lireJournalAudit, verifierJournalAudit } from '../../../lib/api/securite';
import type { EntreeAudit, PageAudit, VerificationAudit } from '../../../lib/securite/types';
import { ACTIONS_AUDIT } from '../../../lib/securite/types';
import { ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { ChampDate } from '../../../components/ui/Formulaire';
import { SquelettePage } from '../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../components/ui/Toast';
import { ShieldCheck, X } from 'lucide-react';
import { Bandeau, BarreOutils, BTN_LIGNE, BTN_SECONDAIRE, CleValeur, EnTetePage, EtatVide, Filtres, FiltreSelect, LigneTableau, Pastille, SectionFenetre, Tableau } from '../../../components/ui/Charte';
import { FenetreDetail } from '../../../components/ui/FenetreDetail';

const GRILLE = 'lg:grid-cols-[72px_120px_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_104px_64px]';
const dateHeure = (d: string) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const dateComplete = (d: string) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'medium' });

/**
 * Journal d'audit (socle N2) : lecture seule, portée fixée par l'API selon l'annexe 1 (toute la
 * Direction pour le DN, la DNA et l'administrateur ; son périmètre pour un responsable ; ses propres
 * actions pour les autres). Jamais le contenu des éléments : action, objet, auteur, date. Refonte
 * (étape 8) : barre de filtres compacte (dates, objet, action, auteur), tableau, fenêtre de détail
 * d'une entrée (« Voir » ou clic sur la ligne).
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
  const verifier = () => verifierJournalAudit().then(setVerif).catch((e) => toast.erreur('Vérification impossible', messageErreur(e)));

  if (!page)
    return (
      <div>
        <ErreurChargement message={erreur} />
        {erreur ? <EnTetePage titre="Journal d’audit" /> : <SquelettePage />}
      </div>
    );
  const nbPages = Math.max(1, Math.ceil(page.total / page.taille));
  const filtresActifs = ['du', 'au', 'entityType', 'action', 'acteurId'].filter((k) => filtres[k]).length;
  /** Date d'un filtre : champ de date compact (libellé visible à gauche, celui du champ réservé aux lecteurs d'écran). */
  const dateFiltre = (k: 'du' | 'au', libelle: string) => (
    <div className="flex items-center gap-1.5 text-[12.5px] text-text-muted md:w-[210px] [&>div]:mb-0 [&>div]:min-w-0 [&>div]:flex-1 [&_input]:!h-9 [&_label]:sr-only">
      <span aria-hidden className="w-6 flex-none md:w-auto">{libelle}</span>
      <ChampDate id={`journal-${k}`} label={k === 'du' ? 'Du' : 'Au'} value={filtres[k] ?? ''} onChange={(v) => filtre(k, v)} raccourcis={false} />
    </div>
  );

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
          page.droits.peutVerifier && (
            <button type="button" className={BTN_SECONDAIRE} onClick={verifier}>
              <ShieldCheck aria-hidden size={16} /> Vérifier l’intégrité
            </button>
          )
        }
      />
      <p className="-mt-1.5 mb-4 text-[12.5px] text-text-muted">
        Le journal est en écriture seule : personne, administrateur compris, ne peut le modifier ni l’effacer.
      </p>
      <ErreurChargement message={erreur} />

      {verif && (
        <Bandeau ton={verif.intacte ? 'vert' : 'rouge'} testid="verification-audit">
          {verif.intacte
            ? `Chaîne intacte : ${verif.lignesVerifiees} entrées scellées vérifiées${verif.nonScellees ? `, ${verif.nonScellees} en attente de scellement (moins d’une minute)` : ''}.`
            : `Chaîne rompue à l’entrée n° ${verif.rangRompu} : le journal a été altéré en dehors de l’application.`}
        </Bandeau>
      )}

      <BarreOutils>
        <Filtres actifs={filtresActifs} onEffacer={effacer}>
        {dateFiltre('du', 'Du')}
        {dateFiltre('au', 'au')}
        <FiltreSelect
          label="Type d’objet"
          value={filtres.entityType ?? ''}
          defaut=""
          onChange={(v) => filtre('entityType', v)}
          options={[{ value: '', label: 'Tous les objets' }, ...page.typesObjets.map((t) => ({ value: t, label: t }))]}
        />
        <FiltreSelect
          label="Action"
          value={filtres.action ?? ''}
          defaut=""
          onChange={(v) => filtre('action', v)}
          options={[{ value: '', label: 'Toutes les actions' }, ...Object.entries(ACTIONS_AUDIT).map(([k, v]) => ({ value: k, label: v }))]}
        />
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

      <Tableau
        label="Journal d’audit"
        grille={GRILLE}
        colonnes={['N°', 'Date', 'Auteur', 'Action', 'Objet', 'Scellement', <span key="a" className="sr-only">Détail</span>]}
        vide={<EtatVide texte="Aucune entrée pour ces critères." action={Object.values(filtres).some(Boolean) ? <button type="button" className={BTN_LIGNE} onClick={effacer}>Effacer les filtres</button> : undefined} />}
        pied={
          <>
            <span>{page.total} entrée(s)</span>
            {nbPages > 1 && (
              <span className="flex items-center gap-2">
                <button type="button" className={`${BTN_LIGNE} disabled:opacity-50`} disabled={numero <= 1} onClick={() => setNumero((n) => n - 1)}>
                  Précédent
                </button>
                Page {numero} / {nbPages}
                <button type="button" className={`${BTN_LIGNE} disabled:opacity-50`} disabled={numero >= nbPages} onClick={() => setNumero((n) => n + 1)}>
                  Suivant
                </button>
              </span>
            )}
          </>
        }
      >
        {page.entrees.map((e) => (
          <LigneTableau key={e.id} grille={GRILLE} testid="entree-audit" onClick={() => setDetail(e)} actif={detail?.id === e.id}>
            <span className="font-mono text-[12px] text-text-muted">{e.numero}</span>
            <span className="whitespace-nowrap text-text-muted">{dateHeure(e.date)}</span>
            <span className="block">
              {e.acteur ? <b className="font-semibold text-ink-900">{e.acteur.nom}</b> : <span className="text-text-muted">Système</span>}
              {e.auNomDe && <small className="block text-[12px] text-text-muted">par intérim, au nom de {e.auNomDe.nom}</small>}
            </span>
            <span>{e.libelle}</span>
            <span className="block truncate text-text-muted">
              {e.objetType} <span className="font-mono text-[11.5px]">{e.objetId.length > 14 ? `${e.objetId.slice(0, 12)}…` : e.objetId}</span>
            </span>
            {e.scellee ? <Pastille ton="vert">Scellée</Pastille> : <Pastille ton="gris">En attente</Pastille>}
            <button
              type="button"
              className={BTN_LIGNE}
              onClick={(ev) => {
                ev.stopPropagation();
                setDetail(e);
              }}
              aria-label={`Voir l’entrée n° ${e.numero}`}
            >
              Voir
            </button>
          </LigneTableau>
        ))}
      </Tableau>

      {detail && (
        <FenetreEntree
          e={detail}
          onClose={() => setDetail(null)}
          filtrerAuteur={
            detail.acteur
              ? () => {
                  setNumero(1);
                  setFiltres((f) => ({ ...f, acteurId: detail.acteur!.id }));
                  setAuteurFiltre(detail.acteur!.nom);
                  setDetail(null);
                }
              : undefined
          }
          filtrerObjet={() => {
            filtre('entityType', detail.objetType);
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Détail d'une entrée du journal (fenêtre centrée deux colonnes) : uniquement ce que la liste
 * renvoie déjà — jamais les métadonnées brutes ni le contenu de l'objet (§2.2). À droite, filtres
 * rapides sur l'auteur ou le type d'objet, état du scellement.
 */
function FenetreEntree({ e, onClose, filtrerAuteur, filtrerObjet }: { e: EntreeAudit; onClose: () => void; filtrerAuteur?: () => void; filtrerObjet: () => void }) {
  return (
    <FenetreDetail
      titre={`${e.libelle} — ${e.objetType}`}
      filAriane={['Journal d’audit', `Entrée n° ${e.numero}`]}
      entete={
        <div className="mt-3">
          {e.scellee ? <Pastille ton="vert">Scellée</Pastille> : <Pastille ton="gris">En attente de scellement</Pastille>}
        </div>
      }
      largeur={820}
      onClose={onClose}
      testid="fenetre-entree-audit"
      cote={
        <>
          <div className="mb-4 flex flex-col gap-2">
            {filtrerAuteur && (
              <button type="button" className={`${BTN_SECONDAIRE} w-full`} onClick={filtrerAuteur}>
                Voir les actions de cet auteur
              </button>
            )}
            <button type="button" className={`${BTN_SECONDAIRE} w-full`} onClick={filtrerObjet}>
              Voir ce type d’objet
            </button>
            <p className="text-[12px] leading-[1.45] text-text-muted">
              {e.scellee
                ? 'Entrée scellée et chaînée à la précédente : toute altération en dehors de l’application est détectée par « Vérifier l’intégrité ».'
                : 'Entrée en attente de scellement : elle est chaînée au journal dans la minute.'}
            </p>
          </div>
          <div className="mb-4 h-px bg-line" />
          <CleValeur
            largeur={90}
            lignes={[
              ['N°', <span key="n" className="font-mono">{e.numero}</span>],
              ['Date', dateHeure(e.date)],
              ['Action', ACTIONS_AUDIT[e.action] ?? e.action],
            ]}
          />
        </>
      }
    >
      <SectionFenetre titre="Événement">
        <CleValeur
          largeur={130}
          lignes={[
            ['Libellé', e.libelle],
            ...(e.evenement ? ([['Code', <span key="c" className="font-mono text-[12.5px]">{e.evenement}</span>]] as [string, ReactNode][]) : []),
            ['Horodatage', dateComplete(e.date)],
          ]}
        />
      </SectionFenetre>
      <SectionFenetre titre="Objet concerné">
        <CleValeur
          largeur={130}
          lignes={[
            ['Type', e.objetType],
            ['Identifiant', <span key="i" className="break-all font-mono text-[12.5px]">{e.objetId}</span>],
          ]}
        />
      </SectionFenetre>
      <SectionFenetre titre="Auteur" className="mb-3">
        <CleValeur
          largeur={130}
          lignes={[
            ['Compte', e.acteur ? e.acteur.nom : 'Système'],
            ...(e.auNomDe ? ([['Par intérim', `au nom de ${e.auNomDe.nom}`]] as [string, string][]) : []),
          ]}
        />
      </SectionFenetre>
      <p className="text-[12.5px] text-text-muted">Le journal ne montre jamais le contenu des éléments : seulement l’action, l’objet, l’auteur et la date.</p>
    </FenetreDetail>
  );
}
