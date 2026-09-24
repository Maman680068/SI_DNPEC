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
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field } from '../ui/Input';
import { Vide } from './Lignes';
import { Erreur, Fenetre, Libelle, SELECT_CLASS, messageErreur } from './ui';

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
      .catch((e) => setErreur(messageErreur(e, 'Impossible de charger les registres')));
  }, []);
  useEffect(() => charger(), [charger]);

  async function basculer(r: Registre) {
    setErreur(null);
    try {
      await updateRegistre(r.id, { isActive: !r.isActive });
      charger();
    } catch (e) {
      setErreur(messageErreur(e, 'Modification impossible'));
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="gold" onClick={() => setEdition('nouveau')}>
          + Nouveau registre
        </Button>
      </div>
      <Erreur message={erreur} />
      {registres === null ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : registres.length === 0 ? (
        <Vide>Aucun registre.</Vide>
      ) : (
        <div className="space-y-2">
          {registres.map((r) => (
            <div key={r.id} className={`rounded-lg border border-line bg-surface px-4 py-3 ${r.isActive ? '' : 'opacity-60'}`} data-testid="registre">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-[14px] font-bold text-ink">{r.code}</span>
                <span className="text-[13.5px]">{r.libelle}</span>
                <Badge tone="accent">{REGISTRE_NATURE_LABEL[r.nature].toUpperCase()}</Badge>
                <Badge tone="muted">{r.portee === 'DIRECTION' ? 'DIRECTION' : 'UNITÉ'}</Badge>
                {!r.isActive && <Badge tone="clay">INACTIF</Badge>}
              </div>
              <div className="mt-1 break-all font-mono text-[12px] text-text-muted">{r.gabaritNumero}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button className="!px-3 !py-1.5 !text-[12.5px]" onClick={() => setEdition(r)}>
                  Modifier
                </Button>
                <Button className="!px-3 !py-1.5 !text-[12.5px]" onClick={() => basculer(r)}>
                  {r.isActive ? 'Désactiver' : 'Réactiver'}
                </Button>
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
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
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
    <Fenetre
      titre={registre ? `Modifier le registre ${registre.code}` : 'Nouveau registre'}
      sousTitre="Changer le gabarit ne réécrit jamais un numéro déjà attribué. Nature et portée sont figées dès la première entrée."
      valider="Enregistrer"
      large
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          if (registre) {
            await updateRegistre(registre.id, {
              libelle: v.libelle.trim(),
              gabaritNumero: v.gabaritNumero.trim(),
              ...(v.nature !== registre.nature ? { nature: v.nature } : {}),
              ...(v.portee !== registre.portee ? { portee: v.portee } : {}),
            });
          } else {
            await createRegistre({ ...v, code: v.code.trim(), libelle: v.libelle.trim(), gabaritNumero: v.gabaritNumero.trim() });
          }
          onFait();
        } catch (e) {
          setErreur(messageErreur(e, 'Enregistrement impossible'));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <Erreur message={erreur} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Code" id="r-code" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} disabled={!!registre} required pattern="[A-Z0-9_\-]{2,20}" />
        <Field label="Libellé" id="r-libelle" value={v.libelle} onChange={(e) => setV({ ...v, libelle: e.target.value })} required minLength={2} maxLength={200} />
        <div className="mb-4">
          <Libelle htmlFor="r-nature">Nature</Libelle>
          <select id="r-nature" className={SELECT_CLASS} value={v.nature} onChange={(e) => setV({ ...v, nature: e.target.value as RegistreNature })}>
            {(Object.keys(REGISTRE_NATURE_LABEL) as RegistreNature[]).map((n) => (
              <option key={n} value={n}>
                {REGISTRE_NATURE_LABEL[n]}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <Libelle htmlFor="r-portee">Portée</Libelle>
          <select id="r-portee" className={SELECT_CLASS} value={v.portee} onChange={(e) => setV({ ...v, portee: e.target.value as RegistrePortee })}>
            {(Object.keys(REGISTRE_PORTEE_LABEL) as RegistrePortee[]).map((n) => (
              <option key={n} value={n}>
                {REGISTRE_PORTEE_LABEL[n]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Field label="Gabarit du numéro" id="r-gabarit" value={v.gabaritNumero} onChange={(e) => setV({ ...v, gabaritNumero: e.target.value })} required minLength={3} maxLength={120} className="font-mono" />
      <p className="-mt-2 mb-3 text-[12px] text-text-muted">
        Variables : <code>{'{seq}'}</code> ou <code>{'{seq:4}'}</code> (obligatoire, sur 4 chiffres), <code>{'{code}'}</code>, <code>{'{annee}'}</code>, <code>{'{unite}'}</code>.
      </p>
      {v.portee === 'UNITE' && unitesPortee.length > 0 && (
        <div className="mb-3">
          <Libelle htmlFor="r-unite-apercu">Aperçu pour l’unité</Libelle>
          <select id="r-unite-apercu" className={SELECT_CLASS} value={unite} onChange={(e) => setUniteApercu(e.target.value)}>
            {unitesPortee.map((u) => (
              <option key={u.key} value={u.key}>
                {u.code} — {u.libelle}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="mb-4 rounded-md bg-bg px-3.5 py-3" data-testid="apercu-numero">
        <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Prochain numéro ({annee})</div>
        {sansSeq || inconnues.length > 0 ? (
          <div className="text-[13px] text-clay">
            {sansSeq ? 'Le gabarit doit contenir {seq} ou {seq:n}. ' : ''}
            {inconnues.length > 0 ? `Variables inconnues : ${inconnues.join(', ')}.` : ''}
          </div>
        ) : (
          <div className="font-heading text-[16px] font-bold text-ink">{dernier === null ? '…' : numero}</div>
        )}
      </div>
    </Fenetre>
  );
}

// ---------------------------------------------------------------------------
// Habilitations
// ---------------------------------------------------------------------------

export function PanneauHabilitations() {
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
      .catch((e) => setErreur(messageErreur(e, 'Impossible de charger les habilitations')));
  }, []);
  useEffect(() => charger(), [charger]);

  const nom = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : id;
  };
  async function revoquer(h: Habilitation) {
    if (!window.confirm(`Révoquer l’habilitation de ${nom(h.userId)} sur ${h.registre.code} ?`)) return;
    setErreur(null);
    try {
      await revoquerHabilitation(h.id);
      charger();
    } catch (e) {
      setErreur(messageErreur(e, 'Révocation impossible'));
    }
  }
  const ligne = (h: Habilitation) => (
    <div key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line bg-surface px-4 py-2.5 text-[13px]" data-testid="habilitation">
      <span className="font-semibold">{nom(h.userId)}</span>
      <Badge tone="accent">{h.registre.code}</Badge>
      <span className="text-text-muted">{libelleUnite(unites, h.uniteKey)}</span>
      <span className="text-[12px] text-text-faint">
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
        <Button variant="gold" onClick={() => setAccorder(true)}>
          + Accorder une habilitation
        </Button>
      </div>
      <Erreur message={erreur} />
      {habs === null ? (
        <p className="text-sm text-text-muted">Chargement…</p>
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
  const [userId, setUserId] = useState('');
  const [registreId, setRegistreId] = useState(registres[0]?.id ?? '');
  const [uniteKey, setUniteKey] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const registre = registres.find((r) => r.id === registreId);
  const unitesUnite = unites.filter((u) => u.key !== 'DNPEC');
  return (
    <Fenetre
      titre="Accorder une habilitation"
      valider="Accorder"
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await createHabilitation({ userId, registreId, uniteKey: registre?.portee === 'UNITE' ? uniteKey : undefined });
          onFait();
        } catch (e) {
          setErreur(messageErreur(e, 'Habilitation impossible'));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <Erreur message={erreur} />
      <div className="mb-4">
        <Libelle htmlFor="h-user">Personne</Libelle>
        <select id="h-user" className={SELECT_CLASS} value={userId} onChange={(e) => setUserId(e.target.value)} required>
          <option value="">Choisir…</option>
          {[...users]
            .sort((a, b) => a.lastName.localeCompare(b.lastName))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
                {u.jobTitle ? ` — ${u.jobTitle}` : ''}
              </option>
            ))}
        </select>
      </div>
      <div className="mb-4">
        <Libelle htmlFor="h-registre">Registre</Libelle>
        <select id="h-registre" className={SELECT_CLASS} value={registreId} onChange={(e) => setRegistreId(e.target.value)} required>
          {registres.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} — {r.libelle}
            </option>
          ))}
        </select>
      </div>
      {registre?.portee === 'UNITE' && (
        <div className="mb-4">
          <Libelle htmlFor="h-unite">Unité</Libelle>
          <select id="h-unite" className={SELECT_CLASS} value={uniteKey} onChange={(e) => setUniteKey(e.target.value)} required>
            <option value="">Choisir…</option>
            {unitesUnite.map((u) => (
              <option key={u.key} value={u.key}>
                {u.code} — {u.libelle}
              </option>
            ))}
          </select>
        </div>
      )}
    </Fenetre>
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
      .catch((e) => setErreur(messageErreur(e, 'Impossible de charger les registres')));
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
      .catch((e) => actuel && setErreur(messageErreur(e, 'Impossible de charger les compteurs')));
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
        <Button variant="gold" onClick={() => setReprise(true)} disabled={!registre}>
          Reprise d’un compteur
        </Button>
      </div>
      <Erreur message={erreur} />
      {compteurs === null ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : compteurs.length === 0 ? (
        <Vide>Aucun numéro encore attribué dans ce registre.</Vide>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-bg text-[11px] uppercase tracking-wide text-text-faint">
              <tr>
                <th className="px-4 py-2">Unité</th>
                <th className="px-4 py-2">Année</th>
                <th className="px-4 py-2">Dernier numéro</th>
                <th className="px-4 py-2">Mis à jour</th>
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
  const [uniteKey, setUniteKey] = useState('');
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [dernier, setDernier] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const unite = registre.portee === 'DIRECTION' ? 'DNPEC' : uniteKey;
  const { numero } = apercu(registre.gabaritNumero, {
    sequence: (Number(dernier) || 0) + 1,
    code: registre.code,
    annee: Number(annee) || new Date().getFullYear(),
    unite: unites.find((u) => u.key === unite)?.code ?? 'UNITE',
  });
  return (
    <Fenetre
      titre={`Reprise du compteur — ${registre.code}`}
      sousTitre={
        <span className="block rounded-md border border-clay bg-clay-soft px-3 py-2 text-clay">
          À n’utiliser qu’au démarrage, pour reprendre la numérotation papier : indiquez le dernier numéro déjà attribué à la main. Refusé dès qu’une
          entrée a été numérotée par le système pour ce registre, cette unité et cette année.
        </span>
      }
      valider="Enregistrer la reprise"
      danger
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await initialiserCompteur(registre.id, { uniteKey: registre.portee === 'UNITE' ? uniteKey : undefined, annee: Number(annee), dernier: Number(dernier) });
          onFait();
        } catch (e) {
          setErreur(messageErreur(e, 'Reprise impossible'));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <Erreur message={erreur} />
      {registre.portee === 'UNITE' && (
        <div className="mb-4">
          <Libelle htmlFor="rp-unite">Unité</Libelle>
          <select id="rp-unite" className={SELECT_CLASS} value={uniteKey} onChange={(e) => setUniteKey(e.target.value)} required>
            <option value="">Choisir…</option>
            {unites
              .filter((u) => u.key !== 'DNPEC')
              .map((u) => (
                <option key={u.key} value={u.key}>
                  {u.code} — {u.libelle}
                </option>
              ))}
          </select>
        </div>
      )}
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Année" id="rp-annee" type="number" min={2000} max={2100} value={annee} onChange={(e) => setAnnee(e.target.value)} required />
        <Field label="Dernier numéro attribué" id="rp-dernier" type="number" min={0} value={dernier} onChange={(e) => setDernier(e.target.value)} required />
      </div>
      <div className="mb-4 rounded-md bg-bg px-3.5 py-2.5 text-[12.5px]" data-testid="apercu-reprise">
        Le prochain numéro sera : <strong className="font-heading">{numero}</strong>
      </div>
    </Fenetre>
  );
}
