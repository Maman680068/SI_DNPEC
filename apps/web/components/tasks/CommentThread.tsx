'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { useAuth } from '../../lib/auth/AuthProvider';
import { addComment } from '../../lib/api/tasks';
import type { TaskComment } from '../../lib/tasks/types';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return isToday ? `Aujourd'hui, ${time}` : `${date.toLocaleDateString('fr-FR')}, ${time}`;
}

export function CommentThread({
  taskId,
  comments,
  onPosted,
}: {
  taskId: string;
  comments: TaskComment[];
  onPosted: (comment: TaskComment) => void;
}) {
  const { users, getUserLabel, getUserInitials } = useOrg();
  const { user: currentUser } = useAuth();
  const [body, setBody] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mentionQuery = useMemo(() => {
    const at = body.lastIndexOf('@');
    if (at === -1) return null;
    const after = body.slice(at + 1);
    if (/\s/.test(after)) return null; // mention déjà refermée par un espace
    return after;
  }, [body]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return users
      .filter((u) => u.id !== currentUser?.id)
      .filter((u) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(q))
      .slice(0, 5);
  }, [mentionQuery, users, currentUser?.id]);

  function pickMention(userId: string, label: string) {
    const at = body.lastIndexOf('@');
    setBody(`${body.slice(0, at)}@${label} `);
    setMentionedUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const comment = await addComment(taskId, body.trim(), mentionedUserIds);
      onPosted(comment);
      setBody('');
      setMentionedUserIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de publier le commentaire');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {comments.map((comment) => (
        <div key={comment.id} className="mb-4 flex gap-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-accent-soft text-[11px] font-bold text-accent">
            {getUserInitials(comment.authorId)}
          </div>
          <div className="min-w-0">
            <div className="mb-0.5 text-xs font-bold">
              {getUserLabel(comment.authorId)}{' '}
              <span className="ml-1 text-[10.5px] font-medium text-text-faint">{formatWhen(comment.createdAt)}</span>
            </div>
            <div className="rounded-lg bg-bg px-3 py-2 text-[13px] leading-relaxed">
              {renderBodyWithMentions(comment.body)}
            </div>
          </div>
        </div>
      ))}
      {comments.length === 0 && <p className="mb-4 text-[13px] text-text-faint">Aucun commentaire pour l&apos;instant.</p>}

      <form onSubmit={handleSubmit} className="relative mt-4">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Écrire un commentaire… (@ pour mentionner)"
          className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
        />
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 z-10 mb-1 w-full rounded-md border border-line bg-surface py-1 shadow-lg">
            {suggestions.map((u) => (
              <button
                type="button"
                key={u.id}
                onClick={() => pickMention(u.id, `${u.firstName} ${u.lastName}`)}
                className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-bg"
              >
                {u.firstName} {u.lastName}
              </button>
            ))}
          </div>
        )}
        {error && <p className="mt-1.5 text-[12px] text-clay">{error}</p>}
        <button type="submit" disabled={submitting || !body.trim()} className="sr-only">
          Publier
        </button>
      </form>
    </div>
  );
}

function renderBodyWithMentions(body: string) {
  const parts = body.split(/(@[\p{L}]+(?:\s[\p{L}]+)?)/gu);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-bold text-accent">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
