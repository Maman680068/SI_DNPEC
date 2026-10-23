'use client';

import type { LeaveRequest } from '../../lib/leaves/types';
import { LIBELLE_AVIS } from '../../lib/leaves/types';
import { BTN_LIGNE, BTN_LIGNE_PRINCIPAL, EtatVide, Initiales, LigneTableau, Pastille, Tableau } from '../ui/Charte';
import { echeanceCourte, initialesNom, jours, pastilleEtape, periode } from './format';

const GRILLE = 'lg:grid-cols-[minmax(0,1fr)_170px_220px_140px]';

/**
 * « À traiter » (avis ou décision attendus de la personne, droits renvoyés par l'API) ou « Suivi de
 * l'équipe » (demandes de son périmètre, en lecture) : tableau compact, action sur la ligne.
 */
export function ValidationQueue({ requests, onSelect, suivi = false }: { requests: LeaveRequest[]; onSelect: (request: LeaveRequest) => void; suivi?: boolean }) {
  return (
    <Tableau
      label={suivi ? 'Demandes de congé de l’équipe' : 'Demandes de congé à traiter'}
      testid={suivi ? 'conges-suivi' : 'conges-a-traiter'}
      colonnes={['Personne', 'Période', suivi ? 'Étape' : 'Attendu de vous', <span key="a" className="sr-only">Action</span>]}
      grille={GRILLE}
      vide={<EtatVide texte={suivi ? 'Aucune demande dans votre périmètre.' : 'Aucune demande en attente de votre avis ou de votre décision.'} />}
    >
      {requests.map((r) => {
        const nom = `${r.user.firstName} ${r.user.lastName}`;
        const avis = r.droits?.peutDonnerAvis;
        const p = pastilleEtape(r);
        const action = suivi ? 'Voir' : avis ? 'Donner mon avis' : 'Décider';
        return (
          <LigneTableau key={r.id} grille={GRILLE} testid="ligne-conge">
            <div className="flex min-w-0 items-center gap-3">
              <Initiales texte={initialesNom(nom)} />
              <div className="min-w-0">
                <b className="block truncate font-semibold">{nom}</b>
                <span className="block truncate text-[12.5px] text-text-muted">
                  {r.leaveType.name} · {jours(r.daysCount)}
                </span>
                {r.soldeInsuffisant && (
                  <span className="mt-1 block">
                    <Pastille ton="rouge" testid="solde-insuffisant">
                      solde insuffisant
                    </Pastille>
                  </span>
                )}
              </div>
            </div>
            <span>{periode(r.startDate, r.endDate)}</span>
            {suivi ? (
              <Pastille ton={p.ton}>{p.texte}</Pastille>
            ) : avis ? (
              <div className="text-[12.5px]">
                <b className="block font-semibold text-ambre">Votre avis est attendu</b>
                {r.avisEcheance && <span className="text-text-muted">avant le {echeanceCourte(r.avisEcheance)}</span>}
              </div>
            ) : (
              <div className="text-[12.5px]">
                <b className="block font-semibold text-ink">Votre décision est attendue</b>
                {r.avisEtat && <span className="text-text-muted">{LIBELLE_AVIS[r.avisEtat]}</span>}
              </div>
            )}
            <div className="lg:text-right">
              <button type="button" className={suivi ? BTN_LIGNE : BTN_LIGNE_PRINCIPAL} aria-label={`${action} — ${nom}`} onClick={() => onSelect(r)}>
                {action}
              </button>
            </div>
          </LigneTableau>
        );
      })}
    </Tableau>
  );
}
