'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useInterim } from '../../../lib/interim/InterimProvider';
import { getManageableTitulaires, getMySuppleances, revokeSuppleance } from '../../../lib/api/suppleances';
import { suppleanceStatus, type Suppleance, type SuppleanceParty } from '../../../lib/suppleances/types';
import { SuppleanceCard } from '../../../components/suppleances/SuppleanceCard';
import { DesignateSuppleanceModal } from '../../../components/suppleances/DesignateSuppleanceModal';
import { Plus } from 'lucide-react';
import { BTN_PRINCIPAL, EnTetePage, EtatVide, Panneau } from '../../../components/ui/Charte';

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
    setError(null);
    try {
      await revokeSuppleance(s.id);
      load();
      await refreshInterim();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de révoquer cette suppléance');
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
          titulaires.length > 0 && (
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

      {error && <div role="alert" className="mb-4 rounded-[10px] bg-clay-50 px-4 py-3 text-[13px] text-clay">{error}</div>}

      {suppleances === null ? (
        <p className="text-sm text-text-muted">Chargement…</p>
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
          onCreated={() => {
            setShowModal(false);
            load();
            void refreshInterim();
          }}
        />
      )}
    </div>
  );
}
