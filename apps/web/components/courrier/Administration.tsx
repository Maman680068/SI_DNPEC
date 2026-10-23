'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createHabilitation,
  createRegistre,
  getCompteurs,
  getHabilitations,
  getRegistres,
  getUnites,
  initialiserCompteur,
  revoquerHabilitation,
  updateRegistre,
} from '../../lib/api/courrier';
import { listAllUsers } from '../../lib/api/users';
import type { AdminUser } from '../../lib/users/types';
import type { Compteur, Habilitation, Registre, RegistreNature, RegistrePortee, Unite } from '../../lib/courrier/types';
import { REGISTRE_NATURE_LABEL, REGISTRE_PORTEE_LABEL, formatDate } from '../../lib/courrier/types';
import { Plus } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { BTN_LIGNE, BTN_PRINCIPAL } from '../ui/Charte';
import { ErreurChargement } from '../ui/ErreurChargement';
import { ChoixSegment, FenetreFormulaire, Grille2, Liste, Saisie, SelecteurPersonnes } from '../ui/Formulaire';
import { SqueletteListe } from '../ui/Squelette';
import { messageErreur, useToast } from '../ui/Toast';
import { Vide } from './Lignes';
import { Libelle, SELECT_CLASS } from './ui';
import { nomDe, useEnvoi, versPersonne } from './formulaire';

// ---------------------------------------------------------------------------
// Aperçu d'un numéro — même syntaxe que NumerotationService.formater (API) ;
// aperçu seulement : le serveur valide le gabarit et attribue les numéros.
// ---------------------------------------------------------------------------

const TOKEN = /\{(seq(?::(\d))?|code|annee|unite)\}/g;
function apercu(gabarit: string, v: { sequence: number; code: string; annee: number; unite: string }): { numero: string; inconnues: string[] } {
  const inconnues = (gabarit.match(/\{[^}]*\}/g) ?? []).filter((t) => !/^\{(seq(?::\d)?|code|annee|unite)\}$/.test(t));
  const numero = gabarit.replace(TOKEN, (_all, name: string, pad?: string) => {
    if (name.startsWith('seq')) return String(v.sequence).padStart(pad ? Number(pad) : 1, '0');
    if (name === 'code') return v.code;
    if (name === 'annee') return String(v.annee);
    return v.unite;
  });
  return { numero, inconnues };
}

function libelleUnite(unites: Unite[], key: string): string {
  const u = unites.find((x) => x.key === key);
  return u ? `${u.code} — ${u.libelle}` : key;
}

// ---------------------------------------------------------------------------
// Registres
// ---------------------------------------------------------------------------

export function PanneauRegistres() {
  const toast = useToast();
  const [registres, setRegistres] = useState<Registre[] | null>(null);
  const [unites, setUnites] = useState<Unite[]>([]);
  const [edition, setEdition] = useState<Registre | 'nouveau' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => {
    Promise.all([getRegistres(), getUnites()])
      .then(([r, u]) => {
        setRegistres(r);
        setUnites(u);
      })
      .catch((e) => setErreur(messageErreur(e, 'Les registres n’ont pas pu être lus.')));
  }, []);
  useEffect(() => charger(), [charger]);

  async function basculer(r: Registre, isActive: boolean, annulable = true) {
    try {
      await updateRegistre(r.id, { isActive });
      charger();
      toast.succes(isActive ? `Registre ${r.code} réactivé` : `Registre ${r.code} désactivé`, {
        detail: isActive ? 'Il est de nouveau proposé.' : 'Il n’est plus proposé pour de nouvelles entrées.',
        annuler: annulable ? () => basculer(r, !isActive, false) : undefined,
      });
    } catch (e) {
      toast.erreur('Modification impossible', messageErreur(e));
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button type="button" className={BTN_PRINCIPAL} onClick={() => setEdition('nouveau')}>
          <Plus aria-hidden size={16} />
          Nouveau registre
        </button>
      </div>
      <ErreurChargement message={erreur} />
      {registres === null ? (
        !erreur && <SqueletteListe lignes={4} colonnes={2} />
      ) : registres.length === 0 ? (
        <Vide>Aucun registre.</Vide>
      ) : (
        <div className="space-y-2">
          {registres.map((r) => (
            <div key={r.id} className={`rounded-xl border border-line bg-surface px-4 py-3 ${r.isActive ? '' : 'opacity-60'}`} data-testid="registre">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-[14px] font-bold text-ink">{r.code}</span>
                <span className="text-[13.5px]">{r.libelle}</span>
                <Badge tone="accent">{REGISTRE_NATURE_LABEL[r.nature].toUpperCase()}</Badge>
                <Badge tone="muted">{r.portee === 'DIRECTION' ? 'DIRECTION' : 'UNITÉ'}</Badge>
                {!r.isActive && <Badge tone="clay">INACTIF</Badge>}
              </div>
              <div className="mt-1 break-all font-mono text-[12px] text-text-muted">{r.gabaritNumero}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={BTN_LIGNE} onClick={() => setEdition(r)}>
                  Modifier
                </button>
                <button type="button" className={BTN_LIGNE} onClick={() => basculer(r, !r.isActive)}>
                  {r.isActive ? 'Désactiver' : 'Réactiver'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edition && (
        <FenetreRegistre
          registre={edition === 'nouveau' ? null : edition}
          unites={unites}
          onClose={() => setEdition(null)}
          onFait={() => {
            setEdition(null);
            charger();
          }}
        />
      )}
    </div>
  );
}

function FenetreRegistre({ registre, unites, onClose, onFait }: { registre: Registre | null; unites: Unite[]; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({
    code: registre?.code ?? '',
    libelle: registre?.libelle ?? '',
    nature: (registre?.nature ?? 'DEPART') as RegistreNature,
    portee: (registre?.portee ?? 'DIRECTION') as RegistrePortee,
    gabaritNumero: registre?.gabaritNumero ?? '{seq:4}/{code}/{annee}',
  });
  const unitesPortee = unites.filter((u) => (v.portee === 'DIRECTION' ? u.key === 'DNPEC' : u.key !== 'DNPEC'));
  const [uniteApercu, setUniteApercu] = useState(unitesPortee[0]?.key ?? 'DNPEC');
  const [dernier, setDernier] = useState<number | null>(null);
  const { enCours, erreur, envoyer } = useEnvoi();
  const annee = new Date().getFullYear();
  const unite = v.portee === 'DIRECTION' ? 'DNPEC' : unitesPortee.some((u) => u.key === uniteApercu) ? uniteApercu : unitesPortee[0]?.key ?? '';

  // Prochain numéro réel : dernier numéro consommé cette année pour cette unité, + 1.
  useEffect(() => {
    if (!registre) return setDernier(0);
    let actuel = true;
    getCompteurs(registre.id)
      .then((c) => actuel && setDernier(c.find((x) => x.annee === annee && x.uniteKey === unite)?.dernier ?? 0))
      .catch(() => actuel && setDernier(null));
    return () => {
      actuel = false;
    };
  }, [registre, unite, annee]);

  const { numero, inconnues } = apercu(v.gabaritNumero, {
    sequence: (dernier ?? 0) + 1,
    code: v.code || 'CODE',
    annee,
    unite: unites.find((u) => u.key === unite)?.code ?? 'UNITE',
  });
  const sansSeq = !/\{seq(?::\d)?\}/.test(v.gabaritNumero);

  return (
    <FenetreFormulaire
      titre={registre ? `Modifier le registre ${registre.code}` : 'Nouveau registre'}
      sousTitre="Changer le gabarit ne réécrit jamais un numéro déjà attribué. Nature et portée sont figées dès la première entrée."
      libelleValider={registre ? 'Enregistrer' : 'Créer le registre'}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Le registre est proposé dès sa création ; les habilitations du secrétariat s’accordent ensuite."
      valider={() => ({
        ...(!registre && v.code && !/^[A-Z0-9_-]{2,20}$/.test(v.code) ? { 'r-code': 'De 2 à 20 caractères : lettres majuscules, chiffres, « _ » ou « - ».' } : {}),
        ...(v.libelle.trim().length === 1 ? { 'r-libelle': 'Indiquez au moins 2 caractères.' } : {}),
        ...(v.gabaritNumero && (sansSeq || inconnues.length > 0) ? { 'r-gabarit': sansSeq ? 'Le gabarit doit contenir {seq} ou {seq:n}.' : `Variables inconnues : ${inconnues.join(', ')}.` } : {}),
      })}
      onSubmit={async () => {
        const r = await envoyer(() =>
          registre
            ? updateRegistre(registre.id, {
                libelle: v.libelle.trim(),
                gabaritNumero: v.gabaritNumero.trim(),
                ...(v.nature !== registre.nature ? { nature: v.nature } : {}),
                ...(v.portee !== registre.portee ? { portee: v.portee } : {}),
              })
            : createRegistre({ ...v, code: v.code.trim(), libelle: v.libelle.trim(), gabaritNumero: v.gabaritNumero.trim() }),
        );
        if (!r.ok) return;
        toast.succes(registre ? `Registre ${registre.code} modifié` : `Registre ${v.code.trim()} créé`);
        onFait();
      }}
    >
      <Grille2>
        {registre ? (
          <div className="mb-3.5 text-[13px]">
            <span className="mb-1.5 block font-semibold text-text">Code</span>
            <span className="block h-10 rounded-[10px] border border-line bg-bg px-3 py-2.5 font-mono">{registre.code}</span>
          </div>
        ) : (
          <Saisie id="r-code" label="Code" value={v.code} onChange={(code) => setV({ ...v, code: code.toUpperCase() })} required maxLength={20} placeholder="DEP, ACTES…" />
        )}
        <Saisie id="r-libelle" label="Libellé" value={v.libelle} onChange={(libelle) => setV({ ...v, libelle })} required maxLength={200} />
      </Grille2>
      <ChoixSegment<RegistreNature> id="r-nature" label="Nature" value={v.nature} onChange={(nature) => setV({ ...v, nature })} options={(Object.keys(REGISTRE_NATURE_LABEL) as RegistreNature[]).map((n) => ({ value: n, label: REGISTRE_NATURE_LABEL[n] }))} />
      <Liste id="r-portee" label="Portée" value={v.portee} onChange={(portee) => setV({ ...v, portee: portee as RegistrePortee })} options={(Object.keys(REGISTRE_PORTEE_LABEL) as RegistrePortee[]).map((n) => ({ value: n, label: REGISTRE_PORTEE_LABEL[n] }))} />
      <Saisie
        id="r-gabarit"
        label="Gabarit du numéro"
        value={v.gabaritNumero}
        onChange={(gabaritNumero) => setV({ ...v, gabaritNumero })}
        required
        maxLength={120}
        aide={
          <>
            Variables : <code>{'{seq}'}</code> ou <code>{'{seq:4}'}</code> (obligatoire, sur 4 chiffres), <code>{'{code}'}</code>, <code>{'{annee}'}</code>, <code>{'{unite}'}</code>.
          </>
        }
      />
      {v.portee === 'UNITE' && unitesPortee.length > 0 && (
        <Liste id="r-unite-apercu" label="Aperçu pour l’unité" value={unite} onChange={setUniteApercu} options={unitesPortee.map((u) => ({ value: u.key, label: `${u.code} — ${u.libelle}` }))} />
      )}
      <div className="mb-3.5 rounded-[10px] bg-bg px-3.5 py-3" data-testid="apercu-numero">
        <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Prochain numéro ({annee})</div>
        {sansSeq || inconnues.length > 0 ? (
          <div className="text-[13px] text-clay">
            {sansSeq ? 'Le gabarit doit contenir {seq} ou {seq:n}. ' : ''}
            {inconnues.length > 0 ? `Variables inconnues : ${inconnues.join(', ')}.` : ''}
          </div>
        ) : (
          <div className="font-heading text-[16px] font-bold text-ink">{dernier === null ? '…' : numero}</div>
        )}
      </div>
    </FenetreFormulaire>
  );
}

// ---------------------------------------------------------------------------
// Habilitations
// ---------------------------------------------------------------------------

export function PanneauHabilitations() {
  const toast = useToast();
  const [habs, setHabs] = useState<Habilitation[] | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [registres, setRegistres] = useState<Registre[]>([]);
  const [unites, setUnites] = useState<Unite[]>([]);
  const [accorder, setAccorder] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => {
    Promise.all([getHabilitations(), listAllUsers(), getRegistres(), getUnites()])
      .then(([h, u, r, un]) => {
        setHabs(h);
        setUsers(u);
        setRegistres(r);
        setUnites(un);
      })
      .catch((e) => setErreur(messageErreur(e, 'Les habilitations n’ont pas pu être lues.')));
  }, []);
  useEffect(() => charger(), [charger]);

  const nom = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : id;
  };
  async function revoquer(h: Habilitation) {
    if (!window.confirm(`Révoquer l’habilitation de ${nom(h.userId)} sur ${h.registre.code} ?`)) return;
    try {
      await revoquerHabilitation(h.id);
      toast.succes('Habilitation révoquée', { detail: `${nom(h.userId)} n’enregistre plus le courrier de ${h.registre.code}.` });
      charger();
    } catch (e) {
      toast.erreur('Révocation impossible', messageErreur(e));
    }
  }
  const ligne = (h: Habilitation) => (
    <div key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-[13px]" data-testid="habilitation">
      <span className="font-semibold">{nom(h.userId)}</span>
      <Badge tone="accent">{h.registre.code}</Badge>
      <span className="text-text-muted">{libelleUnite(unites, h.uniteKey)}</span>
      <span className="text-[12px] text-text-muted">
        depuis le {formatDate(h.createdAt)}
        {h.revoqueeAt ? ` · révoquée le ${formatDate(h.revoqueeAt)}` : ''}
      </span>
      {!h.revoqueeAt && (
        <button type="button" onClick={() => revoquer(h)} className="ml-auto text-[12.5px] font-semibold text-clay hover:underline">
          Révoquer
        </button>
      )}
    </div>
  );
  const actives = habs?.filter((h) => !h.revoqueeAt) ?? [];
  const revoquees = habs?.filter((h) => h.revoqueeAt) ?? [];

  return (
    <div>
      <p className="mb-3 max-w-[680px] text-[12.5px] text-text-muted">
        Une habilitation permet d’enregistrer le courrier d’un registre (et d’expédier ses actes signés) pour une unité. Elle ne donne aucune autorité
        d’imputation ni de signature.
      </p>
      <div className="mb-3 flex justify-end">
        <button type="button" className={BTN_PRINCIPAL} onClick={() => setAccorder(true)}>
          <Plus aria-hidden size={16} />
          Accorder une habilitation
        </button>
      </div>
      <ErreurChargement message={erreur} />
      {habs === null ? (
        !erreur && <SqueletteListe lignes={4} colonnes={3} />
      ) : actives.length === 0 ? (
        <Vide>Aucune habilitation active.</Vide>
      ) : (
        <div className="space-y-2">{actives.map(ligne)}</div>
      )}
      {revoquees.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-text-muted">Historique ({revoquees.length})</summary>
          <div className="mt-2 space-y-2">{revoquees.map(ligne)}</div>
        </details>
      )}
      {accorder && (
        <FenetreHabilitation
          users={users.filter((u) => u.status === 'ACTIF')}
          registres={registres.filter((r) => r.isActive)}
          unites={unites}
          onClose={() => setAccorder(false)}
          onFait={() => {
            setAccorder(false);
            charger();
          }}
        />
      )}
    </div>
  );
}

function FenetreHabilitation({ users, registres, unites, onClose, onFait }: { users: AdminUser[]; registres: Registre[]; unites: Unite[]; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [userId, setUserId] = useState('');
  const [registreId, setRegistreId] = useState(registres[0]?.id ?? '');
  const [uniteKey, setUniteKey] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  const registre = registres.find((r) => r.id === registreId);
  const unitesUnite = unites.filter((u) => u.key !== 'DNPEC');
  const personnes = [...users].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((u) => versPersonne(u));
  return (
    <FenetreFormulaire
      titre="Accorder une habilitation"
      libelleValider="Accorder"
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="L’habilitation est personnelle : elle ne se transmet pas en intérim."
      onSubmit={async () => {
        const r = await envoyer(() => createHabilitation({ userId, registreId, uniteKey: registre?.portee === 'UNITE' ? uniteKey : undefined }));
        if (!r.ok) return;
        toast.succes('Habilitation accordée', { detail: `${nomDe(personnes, userId)} peut enregistrer le courrier de ${registre?.code ?? 'ce registre'}.` });
        onFait();
      }}
    >
      <SelecteurPersonnes id="h-user" label="Personne" options={personnes} valeurs={userId ? [userId] : []} onChange={(ids) => setUserId(ids[0] ?? '')} multiple={false} required messageObligatoire="Choisissez la personne à habiliter." />
      <Liste id="h-registre" label="Registre" value={registreId} onChange={setRegistreId} options={registres.map((r) => ({ value: r.id, label: `${r.code} — ${r.libelle}` }))} required messageObligatoire="Choisissez le registre." />
      {registre?.portee === 'UNITE' && (
        <Liste id="h-unite" label="Unité" value={uniteKey} onChange={setUniteKey} vide="Choisir…" options={unitesUnite.map((u) => ({ value: u.key, label: `${u.code} — ${u.libelle}` }))} required messageObligatoire="Choisissez l’unité." />
      )}
    </FenetreFormulaire>
  );
}

// ---------------------------------------------------------------------------
// Compteurs (lecture et reprise de l'existant papier)
// ---------------------------------------------------------------------------

export function PanneauCompteurs() {
  const [registres, setRegistres] = useState<Registre[]>([]);
  const [unites, setUnites] = useState<Unite[]>([]);
  const [registreId, setRegistreId] = useState('');
  const [compteurs, setCompteurs] = useState<Compteur[] | null>(null);
  const [reprise, setReprise] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([getRegistres(), getUnites()])
      .then(([r, u]) => {
        setRegistres(r);
        setUnites(u);
        setRegistreId(r[0]?.id ?? '');
      })
      .catch((e) => setErreur(messageErreur(e, 'Les registres n’ont pas pu être lus.')));
  }, []);
  const [version, setVersion] = useState(0);
  const charger = () => setVersion((v) => v + 1);
  // Une réponse arrivée après un changement de registre est ignorée : elle
  // afficherait les compteurs d'un autre registre.
  useEffect(() => {
    if (!registreId) return;
    let actuel = true;
    setCompteurs(null);
    getCompteurs(registreId)
      .then((c) => actuel && setCompteurs(c))
      .catch((e) => actuel && setErreur(messageErreur(e, 'Les compteurs n’ont pas pu être lus.')));
    return () => {
      actuel = false;
    };
  }, [registreId, version]);
  const registre = registres.find((r) => r.id === registreId);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1 sm:max-w-[360px]">
          <Libelle htmlFor="c-registre">Registre</Libelle>
          <select id="c-registre" className={SELECT_CLASS} value={registreId} onChange={(e) => setRegistreId(e.target.value)}>
            {registres.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.libelle}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className={BTN_PRINCIPAL} onClick={() => setReprise(true)} disabled={!registre}>
          Reprise d’un compteur
        </button>
      </div>
      <ErreurChargement message={erreur} />
      {compteurs === null ? (
        !erreur && <SqueletteListe lignes={3} colonnes={4} />
      ) : compteurs.length === 0 ? (
        <Vide>Aucun numéro encore attribué dans ce registre.</Vide>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-fond-doux text-[12px] text-text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Unité</th>
                <th className="px-4 py-2 font-semibold">Année</th>
                <th className="px-4 py-2 font-semibold">Dernier numéro</th>
                <th className="px-4 py-2 font-semibold">Mis à jour</th>
              </tr>
            </thead>
            <tbody>
              {compteurs.map((c) => (
                <tr key={`${c.uniteKey}-${c.annee}`} className="border-t border-line" data-testid="compteur">
                  <td className="px-4 py-2">{libelleUnite(unites, c.uniteKey)}</td>
                  <td className="px-4 py-2">{c.annee}</td>
                  <td className="px-4 py-2 font-semibold">{c.dernier}</td>
                  <td className="px-4 py-2 text-text-muted">{formatDate(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {reprise && registre && (
        <FenetreReprise
          registre={registre}
          unites={unites}
          onClose={() => setReprise(false)}
          onFait={() => {
            setReprise(false);
            charger();
          }}
        />
      )}
    </div>
  );
}

function FenetreReprise({ registre, unites, onClose, onFait }: { registre: Registre; unites: Unite[]; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [uniteKey, setUniteKey] = useState('');
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [dernier, setDernier] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  const unite = registre.portee === 'DIRECTION' ? 'DNPEC' : uniteKey;
  const { numero } = apercu(registre.gabaritNumero, {
    sequence: (Number(dernier) || 0) + 1,
    code: registre.code,
    annee: Number(annee) || new Date().getFullYear(),
    unite: unites.find((u) => u.key === unite)?.code ?? 'UNITE',
  });
  return (
    <FenetreFormulaire
      titre={`Reprise du compteur — ${registre.code}`}
      libelleValider="Enregistrer la reprise"
      danger
      largeur={620}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="La reprise est refusée dès qu’une entrée a été numérotée par le système."
      onSubmit={async () => {
        const r = await envoyer(() => initialiserCompteur(registre.id, { uniteKey: registre.portee === 'UNITE' ? uniteKey : undefined, annee: Number(annee), dernier: Number(dernier) }));
        if (!r.ok) return;
        toast.succes('Reprise enregistrée', { detail: `Prochain numéro : ${numero}.` });
        onFait();
      }}
    >
      <p className="mb-3.5 rounded-[10px] border border-clay-bord bg-clay-50 px-3 py-2 text-[12.5px] text-clay">
        À n’utiliser qu’au démarrage, pour reprendre la numérotation papier : indiquez le dernier numéro déjà attribué à la main. Refusé dès qu’une entrée a
        été numérotée par le système pour ce registre, cette unité et cette année.
      </p>
      {registre.portee === 'UNITE' && (
        <Liste
          id="rp-unite"
          label="Unité"
          value={uniteKey}
          onChange={setUniteKey}
          vide="Choisir…"
          options={unites.filter((u) => u.key !== 'DNPEC').map((u) => ({ value: u.key, label: `${u.code} — ${u.libelle}` }))}
          required
          messageObligatoire="Choisissez l’unité."
        />
      )}
      <Grille2>
        <Saisie id="rp-annee" label="Année" type="number" min={2000} max={2100} value={annee} onChange={setAnnee} required />
        <Saisie id="rp-dernier" label="Dernier numéro attribué" type="number" min={0} value={dernier} onChange={setDernier} required messageObligatoire="Indiquez le dernier numéro attribué à la main." />
      </Grille2>
      <div className="mb-3.5 rounded-[10px] bg-bg px-3.5 py-2.5 text-[12.5px]" data-testid="apercu-reprise">
        Le prochain numéro sera : <strong className="font-heading">{numero}</strong>
      </div>
    </FenetreFormulaire>
  );
}
