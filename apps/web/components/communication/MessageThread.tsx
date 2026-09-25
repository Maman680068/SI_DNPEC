'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { EVENEMENT_MESSAGES_LUS, getMessagesWith, markMessageRead, sendMessage } from '../../lib/api/communication';
import type { DirectMessage } from '../../lib/communication/types';
import { Chargement, messageChargement } from '../ui/ErreurChargement';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return isToday ? time : `${date.toLocaleDateString('fr-FR')} ${time}`;
}

export function MessageThread({
  otherUserId,
  onSent,
  onBack,
}: {
  otherUserId: string;
  onSent: () => void;
  onBack?: () => void;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel } = useOrg();
  const [messages, setMessages] = useState<DirectMessage[] | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages(null);
    getMessagesWith(otherUserId).then(async (result) => {
      setMessages(result);
      const unread = result.filter((m) => m.recipientId === currentUser?.id && !m.readAt);
      if (unread.length > 0) {
        await Promise.all(unread.map((m) => markMessageRead(m.id)));
        window.dispatchEvent(new Event(EVENEMENT_MESSAGES_LUS));
        onSent();
      }
    }).catch((err) => setError(messageChargement(err)));
    // onSent ne doit déclencher un refetch que sur envoi/lecture, pas re-résoudre à chaque rendu.
  }, [otherUserId, currentUser?.id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const message = await sendMessage(otherUserId, body.trim());
      setMessages((prev) => (prev ? [...prev, message] : [message]));
      setBody('');
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer le message");
    } finally {
      setSending(false);
    }
  }

  const lastMine = messages ? [...messages].reverse().find((m) => m.senderId === currentUser?.id) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
        <button
          onClick={onBack}
          aria-label="Retour à la liste des conversations"
          className="-ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-text-muted md:hidden"
        >
          ←
        </button>
        <div className="text-[13.5px] font-bold">{getUserLabel(otherUserId)}</div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
        {messages === null ? (
          <Chargement erreur={error} />
        ) : messages.length === 0 ? (
          <p className="text-sm text-text-faint">Aucun message pour l&apos;instant.</p>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === currentUser?.id;
            return (
              <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[70%]">
                  <div
                    className={`rounded-lg px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                      isMine ? 'bg-ink text-white' : 'bg-bg text-text'
                    }`}
                  >
                    {message.body}
                  </div>
                  <div className={`mt-1 text-[10.5px] text-text-faint ${isMine ? 'text-right' : ''}`}>
                    {formatWhen(message.createdAt)}
                    {isMine && message.id === lastMine?.id && message.readAt && (
                      <span className="ml-1.5 text-accent">· Lu à {formatWhen(message.readAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-line px-5 py-3.5">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Écrire un message…"
          className="flex-1 rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="rounded-md bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
        >
          Envoyer
        </button>
      </form>
      {error && <p className="px-5 pb-3 text-[12px] text-clay">{error}</p>}
    </div>
  );
}
