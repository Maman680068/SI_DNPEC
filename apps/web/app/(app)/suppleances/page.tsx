'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useInterim } from '../../../lib/interim/InterimProvider';
import { getDroitsSuppleances, getManageableTitulaires, getMySuppleances, getSuppleancesEnCours, revokeSuppleance, type SuppleanceEnCours } from '../../../lib/api/suppleances';
import { SUPPLEANCE_STATUS_LABEL, suppleanceStatus, type Suppleance, type SuppleanceParty } from '../../../lib/suppleances/types';
import { SuppleanceCard } from '../../../components/suppleances/SuppleanceCard';
import { DesignateSuppleanceModal } from '../../../components/suppleances/DesignateSuppleanceModal';
import { Plus } from 'lucide-react';
import { BTN_PRINCIPAL, EnTetePage, EtatVide, LigneTableau, Onglets, Panneau, Pastille, Tableau } from '../../../components/ui/Charte';
import { ErreurChargement } from '../../../components/ui/ErreurChargement';
import { SqueletteCartes } from '../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../components/ui/Toast';

/** Une suppléance terminée ou révoquée n'a plus d'action possible. */
function isOpen(s: Suppleance): boolean {
  const status = suppleanceStatus(s);
  return status !== 'TERMINEE' && status !== 'REVOQUEE';
}

/** Suppléances ouvertes (en cours, à venir, non conformes) en tête ; terminées
 * et révoquées repliées dans un historique, pour que l'essentiel reste visible. */
function Section({
  title,
  hint,
  items,
  render,
  empty,
}: {
  title: string;
  hint: string;
  items: Suppleance[];
  render: (s: Suppleance) => React.ReactNode;
  empty: string;
}) {
  const open = items.filter(isOpen);
  const history = items.filter((s) => !isOpen(s));
  return (
    <Panneau titre={title} compteur={<span className="text-[12.5px] font-semibold text-text-faint">{open.length}</span>} className="mb-4 overflow-hidden">
      <p className="border-b border-line px-[18px] py-2 text-[12.5px] text-text-muted">{hint}</p>
      {open.length === 0 ? <EtatVide texte={empty} /> : <div>{open.map(render)}</div>}
      {history.length > 0 && (
        <details className="border-t border-line">
          <summary className="cursor-pointer px-[18px] py-2.5 text-[12.5px] font-semibold text-text-muted">Historique ({history.length})</summary>
          <div className="border-t border-line">{history.map(render)}</div>
        </details>
      )}
    </Panneau>
  );
}

export default function SuppleancesPage() {
  const { user } = useAuth();
  const { interim, startInterim, refresh: refreshInterim } = useInterim();
  const [suppleances, setSuppleances] = useState<Suppleance[] | null>(null);
  const [titulaires, setTitulaires] = useState<SuppleanceParty[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voirToutes, setVoirToutes] = useState(false);
  const [onglet, setOnglet] = useState<'miennes' | 'toutes'>('miennes');
  const toast = useToast();

  // Onglet « Toutes les suppléances en cours » : droit donné par l'API (DN, DNA, administrateur) ; ?onglet=toutes.
  useEffect(() => {
    getDroitsSuppleances()
      .then((d) => {
        setVoirToutes(d.voirToutes);
        if (d.voirToutes && new URLSearchParams(window.location.search).get('onglet') === 'toutes') setOnglet('toutes');
      })
      .catch(() => setVoirToutes(false));
  }, []);

  const load = useCallback(() => {
    Promise.all([getMySuppleances(), getManageableTitulaires()])
      .then(([mine, manageable]) => {
        setSuppleances(mine);
        setTitulaires(manageable);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les suppléances'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRevoke(s: Suppleance) {
    const who = `${s.suppleant.firstName} ${s.suppleant.lastName}`;
    if (!window.confirm(`Révoquer la suppléance de ${who} ? Elle cessera immédiatement.`)) return;
    setPendingId(s.id);
    try {
      await revokeSuppleance(s.id);
      load();
      await refreshInterim();
      toast.succes('Suppléance révoquée', { detail: `${who} ne peut plus agir au nom de ${s.titulaire.firstName} ${s.titulaire.lastName}.` });
    } catch (err) {
      toast.erreur('Révocation impossible', messageErreur(err, 'Impossible de révoquer cette suppléance'));
    } finally {
      setPendingId(null);
    }
  }

  if (!user) return null;
  const all = suppleances ?? [];
  const asSuppleant = all.filter((s) => s.suppleantId === user.id);
  const asTitulaire = all.filter((s) => s.titulaireId === user.id);
  const forOthers = all.filter((s) => s.createdById === user.id && s.titulaireId !== user.id && s.suppleantId !== user.id);

  const card = (s: Suppleance, opts: { act?: boolean; revoke?: boolean }) => (
    <SuppleanceCard
      key={s.id}
      suppleance={s}
      isCurrentInterim={interim?.suppleanceId === s.id}
      canAct={!!opts.act && suppleanceStatus(s) === 'EN_COURS'}
      canRevoke={!!opts.revoke && isOpen(s)}
      pending={pendingId === s.id}
      onAct={() => startInterim(s)}
      onRevoke={() => handleRevoke(s)}
    />
  );

  return (
    <div>
      <EnTetePage
        titre="Suppléances"
        actions={
          titulaires.length > 0 &&
          onglet === 'miennes' && (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setShowModal(true)}>
              <Plus aria-hidden size={17} /> Désigner un suppléant
            </button>
          )
        }
      />
      <p className="-mt-1.5 mb-4 max-w-[760px] text-[13px] text-text-muted">
        Pendant une absence, un responsable de rang comparable peut agir au nom du titulaire, sur choix explicite
        (« Agir en intérim »). Chaque action est journalisée « par intérim, au nom de ».
      </p>

      <ErreurChargement message={error} />

      {voirToutes && (
        <Onglets
          label="Suppléances"
          actif={onglet}
          onChange={setOnglet}
          onglets={[
            { cle: 'miennes', label: 'Mes suppléances' },
            { cle: 'toutes', label: 'Toutes les suppléances en cours' },
          ]}
        />
      )}

      {onglet === 'toutes' && voirToutes ? (
        <ToutesEnCours />
      ) : suppleances === null ? (
        !error && <SqueletteCartes cartes={3} />
      ) : (
        <>
          <Section
            title="Mes intérims"
            hint="Vous êtes le suppléant : vous pouvez agir au nom du titulaire pendant la période."
            items={asSuppleant}
            render={(s) => card(s, { act: true })}
            empty="Aucune suppléance en cours ou à venir ne vous est confiée."
          />
          <Section
            title="Mes suppléants"
            hint="Les personnes désignées pour agir en votre nom pendant vos absences."
            items={asTitulaire}
            render={(s) => card(s, { revoke: true })}
            empty="Aucun suppléant en cours ou à venir pour vous."
          />
          {forOthers.length > 0 && (
            <Section
              title="Désignées par moi"
              hint="Suppléances que vous avez désignées pour des responsables de votre périmètre."
              items={forOthers}
              render={(s) => card(s, { revoke: true })}
              empty="Aucune suppléance en cours ou à venir."
            />
          )}
        </>
      )}

      {showModal && (
        <DesignateSuppleanceModal
          selfId={user.id}
          titulaires={titulaires}
          onClose={() => setShowModal(false)}
          onCreated={(nom) => {
            setShowModal(false);
            load();
            void refreshInterim();
            toast.succes('Suppléant désigné', { detail: nom ? `${nom} est prévenu(e).` : undefined });
          }}
        />
      )}
    </div>
  );
}

const GRILLE_TOUTES = 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_170px]';
const dateCourte = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** Vue d'ensemble en lecture seule : aucune action, aucun intérim depuis cet onglet. */
function ToutesEnCours() {
  const [l, setL] = useState<SuppleanceEnCours[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    getSuppleancesEnCours()
      .then(setL)
      .catch((e) => setErreur(messageErreur(e, 'Impossible de charger les suppléances en cours')));
  }, []);
  if (erreur) return <ErreurChargement message={erreur} />;
  if (!l) return <SqueletteCartes cartes={2} />;
  return (
    <Tableau
      label="Toutes les suppléances en cours"
      testid="suppleances-en-cours"
      grille={GRILLE_TOUTES}
      colonnes={['Unité', 'Titulaire', 'Suppléant', 'Période', 'Statut']}
      vide={<EtatVide texte="Aucune suppléance en cours." />}
    >
      {l.map((s) => (
        <LigneTableau key={s.id} grille={GRILLE_TOUTES} testid="suppleance-en-cours">
          <span className="block truncate text-text-muted">{s.unite}</span>
          <b className="block truncate font-semibold text-ink-900">{s.titulaire}</b>
          <span className="block truncate">{s.suppleant}</span>
          <span className="text-text-muted">{dateCourte(s.debut)} → {dateCourte(s.fin)}</span>
          <Pastille ton={s.statut === 'EN_COURS' ? 'vert' : 'rouge'}>{SUPPLEANCE_STATUS_LABEL[s.statut]}</Pastille>
        </LigneTableau>
      ))}
    </Tableau>
  );
}
