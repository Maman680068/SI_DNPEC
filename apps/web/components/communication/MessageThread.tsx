'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { Archive, ArrowLeft, Download, FolderOpen, Info, Laptop, Lock, Paperclip, X } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { envoyerFichierMessage, EVENEMENT_MESSAGES_LUS, getMessagesWith, lirePieceJointe, markMessageRead, sendMessage, telechargerPieceJointe } from '../../lib/api/communication';
import type { ContexteConversation, DirectMessage } from '../../lib/communication/types';
import { decouperCorps, heure, libelleJour, ligneDocument, memeJour } from '../../lib/communication/affichage';
import { Chargement, messageChargement } from '../ui/ErreurChargement';
import { IconeFichier, Initiales } from '../ui/Charte';
import { ChoixDocument, type DocumentChoisi } from './ChoixDocument';
import { messageErreur, useToast } from '../ui/Toast';
import { UploadDocumentModal } from '../documents/UploadDocumentModal';

/** Fichiers permis depuis l'ordinateur (l'API vérifie aussi le contenu). */
const TYPES_PERMIS = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp';
const TAILLE_MAX = 10 * 1024 * 1024;
const taille = (o: number) => (o < 1024 * 1024 ? `${Math.max(1, Math.round(o / 1024))} Ko` : `${(o / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`);

/** Carte d'un document des Archives cité : cliquable si le lecteur peut l'ouvrir (l'API le dit), sinon muette. */
function CarteDocument({ id, contexte, sortant }: { id: string; contexte: ContexteConversation | null; sortant: boolean }) {
  const d = contexte?.documents.find((x) => x.id === id);
  const place = sortant ? 'self-end' : 'self-start';
  if (!d)
    return (
      <span data-testid="document-cite" className={`${place} flex max-w-[85%] items-center gap-2.5 rounded-[10px] border border-line bg-surface px-2.5 py-2 text-[13px] text-text-muted`}>
        <Lock aria-hidden size={16} className="flex-none" />
        {contexte ? 'Document des Archives — vous n’y avez pas accès.' : 'Document des Archives'}
      </span>
    );
  return (
    <Link href={d.lien} data-testid="document-cite" className={`${place} flex max-w-[85%] items-center gap-2.5 rounded-[10px] border border-line bg-surface px-2.5 py-2 text-[13px] hover:border-ink`}>
      <IconeFichier nom={d.nomFichier ?? ''} />
      <span className="min-w-0">
        <b className="block truncate font-bold text-ink-900">{d.titre}</b>
        <span className="block truncate text-[12.5px] text-text-muted">
          {d.chemin}
          {d.version ? ` · v${d.version}` : ''}
        </span>
      </span>
    </Link>
  );
}

/** Échange avec une personne (maquette : séparateurs par jour, bulles, « Lu à », trombone, « Envoyer »). */
export function MessageThread({
  otherUserId,
  onSent,
  onBack,
  contexte,
  onContexteChange,
  peutJoindre,
  onFiche,
}: {
  otherUserId: string;
  onSent: () => void;
  onBack?: () => void;
  /** Fiche de l'interlocuteur (documents que le lecteur peut ouvrir), chargée par la page. */
  contexte: ContexteConversation | null;
  onContexteChange: () => void;
  /** Trombone : la recherche dans les Archives (fermée aux stagiaires, comme la GED). */
  peutJoindre: boolean;
  /** Petits écrans : afficher la fiche de l'interlocuteur. */
  onFiche?: () => void;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel, getUserInitials } = useOrg();
  const [messages, setMessages] = useState<DirectMessage[] | null>(null);
  const [body, setBody] = useState('');
  const [piece, setPiece] = useState<DocumentChoisi | null>(null);
  const [choix, setChoix] = useState(false);
  const [menuJoindre, setMenuJoindre] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [aClasser, setAClasser] = useState<File | null>(null);
  const saisieFichier = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fil = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    setMessages(null);
    setError(null);
    setPiece(null);
    setChoix(false);
    setMenuJoindre(false);
    setFichier(null);
    getMessagesWith(otherUserId)
      .then(async (result) => {
        setMessages(result);
        const unread = result.filter((m) => m.recipientId === currentUser?.id && !m.readAt);
        if (unread.length > 0) {
          await Promise.all(unread.map((m) => markMessageRead(m.id)));
          window.dispatchEvent(new Event(EVENEMENT_MESSAGES_LUS));
          onSent();
        }
      })
      .catch((err) => setError(messageChargement(err)));
    // onSent ne doit déclencher un refetch que sur envoi/lecture, pas re-résoudre à chaque rendu.
  }, [otherUserId, currentUser?.id]);

  useEffect(() => {
    if (fil.current) fil.current.scrollTop = fil.current.scrollHeight;
  }, [messages]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const corps = [body.trim(), piece ? ligneDocument(piece.id) : ''].filter(Boolean).join('\n');
    if (!corps && !fichier) return;
    if (fichier && fichier.size > TAILLE_MAX) {
      setError('Fichier trop volumineux : 10 Mo au plus.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const message = fichier ? await envoyerFichierMessage(otherUserId, fichier, corps) : await sendMessage(otherUserId, corps);
      setFichier(null);
      setMessages((prev) => (prev ? [...prev, message] : [message]));
      setBody('');
      if (piece) onContexteChange();
      setPiece(null);
      onSent();
      toast.succes('Message envoyé', { detail: `Notification envoyée à ${i ? `${i.prenom} ${i.nom}` : getUserLabel(otherUserId)}.` });
    } catch (err) {
      setError(messageErreur(err, 'Impossible d’envoyer le message.'));
    } finally {
      setSending(false);
    }
  }

  const lastMine = messages ? [...messages].reverse().find((m) => m.senderId === currentUser?.id) : undefined;
  const i = contexte?.interlocuteur.id === otherUserId ? contexte.interlocuteur : null;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center gap-[11px] border-b border-line px-4 py-3 sm:px-[18px]">
        <button type="button" onClick={onBack} aria-label="Retour à la liste des conversations" className="-ml-1 grid h-8 w-8 flex-none place-items-center rounded-md text-text-muted hover:bg-bg md:hidden">
          <ArrowLeft aria-hidden size={18} />
        </button>
        <Initiales texte={getUserInitials(otherUserId)} taille={36} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-bold text-text">{i ? `${i.prenom} ${i.nom}` : getUserLabel(otherUserId)}</h2>
          {i && <small className="block truncate text-[12px] text-text-muted">{[i.fonction, i.unite].filter(Boolean).join(' · ')}</small>}
        </div>
        {onFiche && (
          <button type="button" onClick={onFiche} aria-label="Fiche de l’interlocuteur" className="grid h-8 w-8 flex-none place-items-center rounded-md border border-line text-text-muted hover:bg-bg xl:hidden">
            <Info aria-hidden size={17} />
          </button>
        )}
      </div>

      <div ref={fil} className="flex flex-1 flex-col gap-2.5 overflow-y-auto bg-fond-doux px-4 py-4 sm:px-[22px]" data-testid="echange">
        {messages === null ? (
          error ? <p className="text-[13px] text-clay">{error}</p> : <Chargement erreur={null} />
        ) : messages.length === 0 ? (
          <p className="m-auto text-[13px] text-text-muted">Aucun message pour l’instant : écrivez le premier ci-dessous.</p>
        ) : (
          messages.map((message, n) => {
            const isMine = message.senderId === currentUser?.id;
            const { texte, documents } = decouperCorps(message.body);
            const nouveauJour = n === 0 || !memeJour(messages[n - 1]!.createdAt, message.createdAt);
            return (
              <Fragment key={message.id}>
                {nouveauJour && (
                  <span data-testid="separateur-jour" className="self-center rounded-[10px] border border-line bg-surface px-2.5 py-0.5 text-[11.5px] font-semibold text-text-muted">
                    {libelleJour(message.createdAt)}
                  </span>
                )}
                {texte && (
                  <div data-testid="message" className={`max-w-[85%] whitespace-pre-wrap break-words rounded-[14px] px-[13px] py-[9px] text-[13.5px] leading-[1.45] sm:max-w-[68%] ${isMine ? 'self-end rounded-br-[4px] bg-ink text-white' : 'self-start rounded-bl-[4px] border border-line bg-surface text-text'}`}>
                    {texte}
                  </div>
                )}
                {documents.map((id) => (
                  <CarteDocument key={id} id={id} contexte={contexte} sortant={isMine} />
                ))}
                {message.attachmentName && (
                  <span data-testid="piece-jointe" className={`${isMine ? 'self-end' : 'self-start'} flex max-w-[85%] flex-wrap items-center gap-2.5 rounded-[10px] border border-line bg-surface px-2.5 py-2 text-[13px]`}>
                    <IconeFichier nom={message.attachmentName} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-bold text-ink-900">{message.attachmentName}</b>
                      <span className="block text-[12.5px] text-text-muted">Pièce jointe</span>
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line px-2.5 text-[12.5px] font-semibold hover:bg-bg"
                      onClick={() => telechargerPieceJointe(message.id, message.attachmentName).catch((e) => toast.erreur('Téléchargement impossible', messageErreur(e)))}
                    >
                      <Download aria-hidden size={14} /> Télécharger
                    </button>
                    {contexte?.droits.classer && (
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line px-2.5 text-[12.5px] font-semibold hover:bg-bg"
                        onClick={() =>
                          lirePieceJointe(message.id, message.attachmentName!)
                            .then(setAClasser)
                            .catch((e) => toast.erreur('Classement impossible', messageErreur(e)))
                        }
                      >
                        <Archive aria-hidden size={14} /> Classer dans les Archives
                      </button>
                    )}
                  </span>
                )}
                <span className={`text-[11px] text-text-muted ${isMine ? 'self-end' : 'self-start'}`}>
                  {heure(message.createdAt)}
                  {isMine && message.id === lastMine?.id && message.readAt && <span data-testid="lu-a"> · Lu à {heure(message.readAt)}</span>}
                </span>
              </Fragment>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative border-t border-line px-3 py-3 sm:px-4">
        {choix && (
          <ChoixDocument
            avec={otherUserId}
            onChoisir={(d) => {
              setPiece(d);
              setChoix(false);
            }}
            onFermer={() => setChoix(false)}
          />
        )}
        {menuJoindre && (
          <div role="menu" aria-label="Joindre" className="absolute bottom-full left-3 z-20 mb-2 w-[240px] rounded-[10px] border border-line bg-surface p-1.5 shadow-[0_12px_30px_rgba(18,28,77,0.18)]" data-testid="menu-joindre">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[13px] font-semibold hover:bg-bg"
              onClick={() => {
                setMenuJoindre(false);
                saisieFichier.current?.click();
              }}
            >
              <Laptop aria-hidden size={16} className="text-text-muted" /> Depuis mon ordinateur
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[13px] font-semibold hover:bg-bg"
              onClick={() => {
                setMenuJoindre(false);
                setChoix(true);
              }}
            >
              <FolderOpen aria-hidden size={16} className="text-text-muted" /> Depuis les Archives
            </button>
          </div>
        )}
        <input
          ref={saisieFichier}
          type="file"
          accept={TYPES_PERMIS}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          data-testid="fichier-message"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = '';
            if (!f) return;
            if (f.size > TAILLE_MAX) {
              setError('Fichier trop volumineux : 10 Mo au plus.');
              return;
            }
            setError(null);
            setFichier(f);
          }}
        />
        {fichier && (
          <div className="mb-2 flex items-center gap-2 text-[12.5px]" data-testid="fichier-joint">
            <Paperclip aria-hidden size={14} className="text-text-muted" />
            <span className="min-w-0 truncate">
              Fichier joint : <b>{fichier.name}</b> ({taille(fichier.size)})
            </span>
            <button type="button" onClick={() => setFichier(null)} aria-label="Retirer le fichier joint" className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-bg">
              <X aria-hidden size={14} />
            </button>
          </div>
        )}
        {piece && (
          <div className="mb-2 flex items-center gap-2 text-[12.5px]" data-testid="document-joint">
            <Paperclip aria-hidden size={14} className="text-text-muted" />
            <span className="min-w-0 truncate">
              Document joint : <b>{piece.libelle}</b>
            </span>
            <button type="button" onClick={() => setPiece(null)} aria-label="Retirer le document joint" className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-bg">
              <X aria-hidden size={14} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          {(contexte?.droits.joindre ?? peutJoindre) && (
            <button
              type="button"
              onClick={() => {
                setChoix(false);
                setMenuJoindre((m) => !m);
              }}
              aria-label="Joindre"
              aria-haspopup="menu"
              aria-expanded={menuJoindre}
              className="grid h-10 w-10 flex-none place-items-center rounded-[10px] border border-line text-text-muted hover:bg-bg">
              <Paperclip aria-hidden size={17} />
            </button>
          )}
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Votre message"
            placeholder="Écrire un message…"
            className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 text-[13.5px] placeholder:text-text-faint focus:border-ink focus:outline focus:outline-2 focus:outline-ink"
          />
          <button type="submit" disabled={sending || (!body.trim() && !piece && !fichier)} className="h-10 flex-none rounded-[10px] bg-ink px-3.5 text-[14px] font-bold text-white hover:bg-ink-800 disabled:opacity-60">
            Envoyer
          </button>
        </div>
        {error && messages !== null && (
          <p role="alert" className="mt-2 text-[12.5px] font-semibold text-clay">
            {error}
          </p>
        )}
      </form>
      {aClasser && (
        <UploadDocumentModal
          divisionId={currentUser?.divisionId ?? null}
          celluleId={currentUser?.divisionId ? null : currentUser?.celluleId ?? null}
          folderId={null}
          fichierInitial={aClasser}
          onClose={() => setAClasser(null)}
          onCreated={() => setAClasser(null)}
        />
      )}
    </div>
  );
}
