'use client';

import { useState, type FormEvent } from 'react';
import { sendPasswordResetEmail, setUserPassword, setUserStatus } from '../../lib/api/users';
import type { AdminUser, UserStatus } from '../../lib/users/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field } from '../ui/Input';

const STATUS_BADGE_TONE: Record<UserStatus, 'sage' | 'clay' | 'muted'> = {
  EN_ATTENTE: 'muted',
  ACTIF: 'sage',
  SUSPENDU: 'clay',
  SUPPRIME: 'muted',
};

const STATUS_BADGE_LABEL: Record<UserStatus, string> = {
  EN_ATTENTE: 'En attente',
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
  SUPPRIME: 'Supprimé',
};

/**
 * Fiche de gestion d'un compte (ADMIN_SYSTEME uniquement, voir canManage dans
 * UsersTable) : changement de statut (suspendre/réactiver/supprimer — la
 * suppression est LOGIQUE, voir schema.prisma UserStatus.SUPPRIME : rien de
 * ce qui est lié au compte n'est touché ni réattribué) et réinitialisation
 * de mot de passe (email de réinitialisation, ou mot de passe temporaire
 * défini directement — les deux révoquent les sessions actives côté API).
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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  async function changeStatus(next: UserStatus, confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return;
    setBusy(next);
    setError(null);
    setNotice(null);
    try {
      await setUserStatus(user.id, next);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de mettre à jour ce compte');
    } finally {
      setBusy(null);
    }
  }

  async function handleSendResetEmail() {
    setBusy('reset-email');
    setError(null);
    setNotice(null);
    try {
      const result = await sendPasswordResetEmail(user.id);
      setNotice(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer l'email de réinitialisation");
    } finally {
      setBusy(null);
    }
  }

  async function handleSetPassword(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm('Confirmer : définir ce mot de passe temporaire ? Les sessions actives de ce compte seront révoquées.')) {
      return;
    }
    setBusy('set-password');
    setError(null);
    setNotice(null);
    try {
      const result = await setUserPassword(user.id, newPassword);
      setNotice(result.message);
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de définir ce mot de passe');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-lg bg-surface p-6"
      >
        <div className="mb-1.5 flex items-center gap-2">
          <h2 className="text-[19px] font-semibold">Gérer ce compte</h2>
          <Badge tone={STATUS_BADGE_TONE[user.status]}>{STATUS_BADGE_LABEL[user.status]}</Badge>
        </div>
        <p className="mb-5 text-[13px] text-text-muted">
          {user.firstName} {user.lastName} · {user.email}
        </p>

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}
        {notice && <div className="mb-4 rounded-md bg-sage-soft px-3 py-2.5 text-[13px] text-sage">{notice}</div>}

        <div className="mb-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Statut du compte</div>
          <div className="flex flex-wrap gap-2">
            {user.status === 'ACTIF' && (
              <>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => changeStatus('SUSPENDU', `Confirmer : suspendre le compte de ${user.firstName} ${user.lastName} ?`)}
                >
                  Suspendre
                </Button>
                <Button
                  variant="outline"
                  className="!border-clay !text-clay"
                  disabled={!!busy}
                  onClick={() =>
                    changeStatus(
                      'SUPPRIME',
                      `Confirmer : supprimer le compte de ${user.firstName} ${user.lastName} ? Le compte ne pourra plus se connecter, mais rien de ce qui lui est lié (tâches, messages, historique) ne sera supprimé ni réattribué.`,
                    )
                  }
                >
                  Supprimer
                </Button>
              </>
            )}
            {user.status === 'SUSPENDU' && (
              <>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => changeStatus('ACTIF', `Confirmer : réactiver le compte de ${user.firstName} ${user.lastName} ?`)}
                >
                  Réactiver
                </Button>
                <Button
                  variant="outline"
                  className="!border-clay !text-clay"
                  disabled={!!busy}
                  onClick={() =>
                    changeStatus(
                      'SUPPRIME',
                      `Confirmer : supprimer le compte de ${user.firstName} ${user.lastName} ? Le compte ne pourra plus se connecter, mais rien de ce qui lui est lié (tâches, messages, historique) ne sera supprimé ni réattribué.`,
                    )
                  }
                >
                  Supprimer
                </Button>
              </>
            )}
            {user.status === 'SUPPRIME' && (
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() => changeStatus('ACTIF', `Confirmer : réactiver le compte de ${user.firstName} ${user.lastName} ?`)}
              >
                Réactiver
              </Button>
            )}
            {user.status === 'EN_ATTENTE' && (
              <p className="text-[12.5px] text-text-faint">
                Inscription en attente d'approbation — voir l'écran « Inscriptions en attente ».
              </p>
            )}
          </div>
        </div>

        <div className="mb-2">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Mot de passe</div>

          <Button
            variant="outline"
            className="mb-3 w-full"
            disabled={!!busy || user.status !== 'ACTIF'}
            onClick={handleSendResetEmail}
          >
            {busy === 'reset-email' ? 'Envoi…' : 'Envoyer un lien de réinitialisation par email'}
          </Button>
          {user.status !== 'ACTIF' && (
            <p className="-mt-2 mb-3 text-[11.5px] text-text-faint">Le compte doit être actif pour recevoir ce lien.</p>
          )}

          <form onSubmit={handleSetPassword}>
            <Field
              label="Définir un mot de passe temporaire"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
            <p className="-mt-3 mb-3 text-[11.5px] text-text-faint">
              8 caractères minimum. À communiquer vous-même à la personne concernée.
            </p>
            <Button type="submit" variant="outline" className="w-full" disabled={!!busy || newPassword.length < 8}>
              {busy === 'set-password' ? 'Application…' : 'Définir ce mot de passe'}
            </Button>
          </form>
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
