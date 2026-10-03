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
  const hier = new Date(today.getTime() - 86_400_000).toDateString() === date.toDateString();
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return isToday ? `aujourd’hui, ${time}` : hier ? `hier, ${time}` : `${date.toLocaleDateString('fr-FR')}, ${time}`;
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
        <div key={comment.id} className="mb-2.5 flex gap-2.5">
          <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-ink-50 text-[10.5px] font-bold text-ink">
            {getUserInitials(comment.authorId)}
          </div>
          <div className="min-w-0 flex-1 rounded-[10px] bg-[#F4F5F9] px-[11px] py-2 text-[13px] leading-[1.45]">
            <div>
              <b className="text-[12.5px]">{getUserLabel(comment.authorId)}</b>
              <small className="ml-1.5 text-[11.5px] text-text-faint">{formatWhen(comment.createdAt)}</small>
            </div>
            {renderBodyWithMentions(comment.body)}
          </div>
        </div>
      ))}
      {comments.length === 0 && <p className="mb-3 text-[13px] text-text-faint">Aucun commentaire pour l&apos;instant.</p>}

      <form onSubmit={handleSubmit} className="relative mt-2.5">
        <input
          aria-label="Écrire un commentaire"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Écrire un commentaire… (@ pour mentionner)"
          className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[13.5px] focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
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
