'use client';

import { useState, type FormEvent } from 'react';
import { resetTwoFa, sendPasswordResetEmail, setUserPassword, setUserStatus } from '../../lib/api/users';
import type { AdminUser, UserStatus } from '../../lib/users/types';
import { BTN_DANGER_CONTOUR, BTN_SECONDAIRE, Pastille, type TonPastille } from '../ui/Charte';
import { FenetreFormulaire, Saisie } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';

const STATUS_PASTILLE: Record<UserStatus, TonPastille> = {
  EN_ATTENTE: 'gris',
  ACTIF: 'vert',
  SUSPENDU: 'rouge',
  SUPPRIME: 'gris',
};

const STATUS_BADGE_LABEL: Record<UserStatus, string> = {
  EN_ATTENTE: 'En attente',
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
  SUPPRIME: 'Désactivé',
};

const CONFIRMATION_STATUT: Record<UserStatus, string> = {
  ACTIF: 'Compte réactivé',
  SUSPENDU: 'Compte suspendu',
  SUPPRIME: 'Compte désactivé',
  EN_ATTENTE: 'Compte mis à jour',
};

const SECTION = 'mb-2 text-[12px] font-bold uppercase tracking-wide text-text-muted';

/**
 * Fiche de gestion d'un compte (ADMIN_SYSTEME uniquement, voir canManage dans
 * UsersTable) : changement de statut (suspendre/réactiver/supprimer — la
 * suppression est LOGIQUE, voir schema.prisma UserStatus.SUPPRIME : rien de
 * ce qui est lié au compte n'est touché ni réattribué) et réinitialisation
 * de mot de passe (email de réinitialisation, ou mot de passe temporaire
 * défini directement — les deux révoquent les sessions actives côté API).
 * Chaque action réussie est confirmée par un message en bas de l'écran ; un
 * refus reste affiché en bas de la fenêtre.
 */
export function ManageAccountModal({
  user,
  onClose,
  onChanged,
}: {
  user: AdminUser;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const nom = `${user.firstName} ${user.lastName}`;

  async function changeStatus(next: UserStatus, confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return;
    const avant = user.status;
    setBusy(next);
    setError(null);
    try {
      await setUserStatus(user.id, next);
      onChanged();
      // Suspension et réactivation se défont par la même route (même droit) ; la désactivation, non.
      const reversible = (avant === 'ACTIF' && next === 'SUSPENDU') || (avant === 'SUSPENDU' && next === 'ACTIF');
      toast.succes(CONFIRMATION_STATUT[next], {
        detail: nom,
        ...(reversible
          ? {
              annuler: () =>
                void setUserStatus(user.id, avant)
                  .then(onChanged)
                  .catch((err) => toast.erreur('Action impossible', messageErreur(err))),
            }
          : {}),
      });
    } catch (err) {
      setError(messageErreur(err, 'Impossible de mettre à jour ce compte'));
    } finally {
      setBusy(null);
    }
  }

  async function handleSendResetEmail() {
    setBusy('reset-email');
    setError(null);
    try {
      const result = await sendPasswordResetEmail(user.id);
      toast.succes('Lien de réinitialisation envoyé', { detail: result.message });
    } catch (err) {
      setError(messageErreur(err, "Impossible d'envoyer l'email de réinitialisation"));
    } finally {
      setBusy(null);
    }
  }

  async function handleResetTwoFa() {
    if (!window.confirm('Confirmer : réinitialiser la double authentification de ce compte ? La personne devra se reconnecter avec son seul mot de passe.')) {
      return;
    }
    setBusy('reset-2fa');
    setError(null);
    try {
      const result = await resetTwoFa(user.id);
      toast.succes(result.message);
    } catch (err) {
      setError(messageErreur(err, 'Impossible de réinitialiser la double authentification'));
    } finally {
      setBusy(null);
    }
  }

  async function handleSetPassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) return;
    if (!window.confirm('Confirmer : définir ce mot de passe temporaire ? Les sessions actives de ce compte seront révoquées.')) {
      return;
    }
    setBusy('set-password');
    setError(null);
    try {
      const result = await setUserPassword(user.id, newPassword);
      toast.succes('Mot de passe temporaire défini', { detail: result.message });
      setNewPassword('');
    } catch (err) {
      setError(messageErreur(err, 'Impossible de définir ce mot de passe'));
    } finally {
      setBusy(null);
    }
  }

  const desactiver = () =>
    changeStatus(
      'SUPPRIME',
      `Confirmer : désactiver le compte de ${nom} ? Le compte ne pourra plus se connecter, mais rien de ce qui lui est lié (tâches, messages, historique) ne sera supprimé ni réattribué.`,
    );

  return (
    <FenetreFormulaire
      titre="Gérer ce compte"
      sousTitre={
        <span className="flex flex-wrap items-center gap-2">
          {nom} · {user.email} <Pastille ton={STATUS_PASTILLE[user.status]}>{STATUS_BADGE_LABEL[user.status]}</Pastille>
        </span>
      }
      onClose={onClose}
      largeur={560}
      pied="Chaque action est inscrite au journal d’audit."
    >
      {error && (
        <div role="alert" className="mb-4 rounded-[9px] border border-[#F0C5CC] bg-clay-50 px-3 py-2.5 text-[13px] font-semibold text-clay">
          {error}
        </div>
      )}

      <section className="mb-5" aria-label="Statut du compte">
        <h3 className={SECTION}>Statut du compte</h3>
        <div className="flex flex-wrap gap-2">
          {user.status === 'ACTIF' && (
            <>
              <button type="button" className={BTN_SECONDAIRE} disabled={!!busy} onClick={() => changeStatus('SUSPENDU', `Confirmer : suspendre le compte de ${nom} ?`)}>
                Suspendre
              </button>
              <button type="button" className={BTN_DANGER_CONTOUR} disabled={!!busy} onClick={desactiver}>
                Désactiver
              </button>
            </>
          )}
          {user.status === 'SUSPENDU' && (
            <>
              <button type="button" className={BTN_SECONDAIRE} disabled={!!busy} onClick={() => changeStatus('ACTIF', `Confirmer : réactiver le compte de ${nom} ?`)}>
                Réactiver
              </button>
              <button type="button" className={BTN_DANGER_CONTOUR} disabled={!!busy} onClick={desactiver}>
                Désactiver
              </button>
            </>
          )}
          {user.status === 'SUPPRIME' && (
            <button type="button" className={BTN_SECONDAIRE} disabled={!!busy} onClick={() => changeStatus('ACTIF', `Confirmer : réactiver le compte de ${nom} ?`)}>
              Réactiver
            </button>
          )}
          {user.status === 'EN_ATTENTE' && <p className="text-[12.5px] text-text-muted">Inscription en attente d’approbation — voir l’onglet « Inscriptions en attente ».</p>}
        </div>
      </section>

      <section className="mb-5" aria-label="Mot de passe">
        <h3 className={SECTION}>Mot de passe</h3>
        <button type="button" className={`${BTN_SECONDAIRE} mb-1 w-full`} disabled={!!busy || user.status !== 'ACTIF'} onClick={handleSendResetEmail}>
          {busy === 'reset-email' ? 'Envoi…' : 'Envoyer un lien de réinitialisation par email'}
        </button>
        {user.status !== 'ACTIF' && <p className="mb-2 text-[12px] text-text-muted">Le compte doit être actif pour recevoir ce lien.</p>}
        <form onSubmit={handleSetPassword} className="mt-3">
          <Saisie
            id="ma-mdp"
            label="Définir un mot de passe temporaire"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            aide="8 caractères minimum. À communiquer vous-même à la personne concernée."
          />
          <button type="submit" className={`${BTN_SECONDAIRE} w-full`} disabled={!!busy || newPassword.length < 8}>
            {busy === 'set-password' ? 'Application…' : 'Définir ce mot de passe'}
          </button>
        </form>
      </section>

      <section aria-label="Double authentification">
        <h3 className={SECTION}>Double authentification</h3>
        <button type="button" className={`${BTN_SECONDAIRE} w-full`} disabled={!!busy} onClick={handleResetTwoFa}>
          {busy === 'reset-2fa' ? 'Réinitialisation…' : 'Réinitialiser la double authentification'}
        </button>
        <p className="mt-1.5 text-[12px] text-text-muted">Si la personne a perdu ou changé de téléphone. Ses sessions sont fermées ; elle pourra la réactiver ensuite.</p>
      </section>
    </FenetreFormulaire>
  );
}
