'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createHabilitation,
  createRegistre,
  getCompteurs,
  getParametrageCourrier,
  getRegistres,
  getUnites,
  initialiserCompteur,
  revoquerHabilitation,
  updateRegistre,
  type LigneHabilitation,
  type ParametrageCourrier,
} from '../../lib/api/courrier';
import { listAllUsers } from '../../lib/api/users';
import type { AdminUser } from '../../lib/users/types';
import type { Compteur, Registre, RegistreNature, RegistrePortee, Unite } from '../../lib/courrier/types';
import { REGISTRE_NATURE_LABEL, REGISTRE_PORTEE_LABEL, formatDate } from '../../lib/courrier/types';
import { AlertTriangle, Plus } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Bandeau, BarreOutils, BTN_PRINCIPAL, EtatVide, Interrupteur, LigneTableau, Onglets, Pastille, Tableau, usePreference } from '../ui/Charte';
import { MenuActions } from '../ui/MenuActions';
import Link from 'next/link';
import { Fenetre } from '../ui/Fenetre';
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

type OngletParametrage = 'registres' | 'habilitations';

/**
 * Paramétrage du courrier (S9c) : alertes en tête, puis deux onglets — « Registres et numérotation »
 * (registres groupés par nature, prochain numéro sans consommer la séquence, numéros de l'année, personnes
 * habilitées, famille d'actes liée ; reprise d'un compteur dans le menu de la ligne) et « Habilitations du
 * secrétariat » (groupées par registre, compte inactif signalé). Tout est calculé par l'API
 * (`GET courrier/parametrage`).
 */
export function ParametrageCourrierVue() {
  const toast = useToast();
  const [vue, setVue] = useState<ParametrageCourrier | null>(null);
  const [registres, setRegistres] = useState<Registre[]>([]);
  const [unites, setUnites] = useState<Unite[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<OngletParametrage>('registres');
  const [masquerDemo, setMasquerDemo] = usePreference('courrier.masquerDemo', true);
  const [edition, setEdition] = useState<Registre | 'nouveau' | null>(null);
  const [reprise, setReprise] = useState<Registre | null>(null);
  const [compteursDe, setCompteursDe] = useState<Registre | null>(null);
  const [accorder, setAccorder] = useState<string | null>(null);
  const charger = useCallback(() => {
    Promise.all([getParametrageCourrier(), getRegistres(), getUnites()])
      .then(([v, r, u]) => {
        setVue(v);
        setRegistres(r);
        setUnites(u);
      })
      .catch((e) => setErreur(messageErreur(e, 'Le paramétrage du courrier n’a pas pu être lu.')));
  }, []);
  useEffect(() => charger(), [charger]);
  const registre = (id: string) => registres.find((r) => r.id === id);

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
  async function revoquer(h: LigneHabilitation, code: string) {
    if (!window.confirm(`Révoquer l’habilitation de ${h.nom} sur ${code} ?`)) return;
    try {
      await revoquerHabilitation(h.id);
      toast.succes('Habilitation révoquée', { detail: `${h.nom} n’enregistre plus le courrier de ${code}.` });
      charger();
    } catch (e) {
      toast.erreur('Révocation impossible', messageErreur(e));
    }
  }

  if (!vue) return <>{erreur ? <ErreurChargement message={erreur} /> : <SqueletteListe lignes={5} colonnes={4} />}</>;
  const sansPersonne = vue.alertes.registresSansPersonne.filter((r) => !masquerDemo || !r.demonstration);
  return (
    <div>
      <ErreurChargement message={erreur} />
      {sansPersonne.length > 0 && (
        <Bandeau ton="rouge" icone={<AlertTriangle aria-hidden size={18} />} testid="alerte-sans-personne">
          <b>{sansPersonne.length === 1 ? 'Un registre actif n’a' : `${sansPersonne.length} registres actifs n’ont`} aucune personne habilitée</b> : {sansPersonne.map((r) => r.code).join(', ')}. Personne ne peut y enregistrer le courrier.
        </Bandeau>
      )}
      {vue.alertes.famillesSansRegistre.length > 0 && (
        <Bandeau
          ton="ambre"
          icone={<AlertTriangle aria-hidden size={18} />}
          testid="alerte-familles"
          action={
            <Link href={vue.alertes.lienFamilles} className="text-[13px] font-semibold text-ink underline">
              Ouvrir Carrière et actes
            </Link>
          }
        >
          <b>{vue.alertes.famillesSansRegistre.length} famille(s) d’actes RH sans registre</b> : {vue.alertes.famillesSansRegistre.map((f) => f.libelle).join(', ')}. Ces actes ne peuvent être ni préparés ni signés.
        </Bandeau>
      )}
      <Onglets
        label="Paramétrage du courrier"
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { cle: 'registres', label: 'Registres et numérotation' },
          { cle: 'habilitations', label: 'Habilitations du secrétariat', n: vue.comptesInactifsHabilites || null, chaud: vue.comptesInactifsHabilites > 0 },
        ]}
      />
      <BarreOutils
        droite={
          onglet === 'registres' ? (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setEdition('nouveau')}>
              <Plus aria-hidden size={16} />
              Nouveau registre
            </button>
          ) : (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setAccorder('')}>
              <Plus aria-hidden size={16} />
              Accorder une habilitation
            </button>
          )
        }
      >
        <Interrupteur label="Masquer les registres de démonstration" actif={masquerDemo} onChange={setMasquerDemo} testid="masquer-demo" />
      </BarreOutils>

      {onglet === 'registres' ? (
        <div className="space-y-5">
          {vue.groupes.map((g) => {
            const lignes = g.registres.filter((r) => !masquerDemo || !r.demonstration);
            return (
              <section key={g.nature} aria-labelledby={`nature-${g.nature}`} data-testid={`groupe-${g.nature}`}>
                <h2 id={`nature-${g.nature}`} className="mb-2 text-[15px] font-bold text-ink-900">
                  {g.libelle} <span className="text-text-muted">· {lignes.length}</span>
                </h2>
                <Tableau
                  label={`Registres — ${g.libelle}`}
                  grille={GRILLE_REGISTRES}
                  colonnes={['Registre', 'Portée', 'Prochain numéro', 'Cette année', 'Personnes habilitées', 'Famille d’actes', '']}
                  vide={<EtatVide texte="Aucun registre de cette nature." />}
                >
                  {lignes.map((l) => {
                    const r = registre(l.id);
                    return (
                      <LigneTableau key={l.id} grille={GRILLE_REGISTRES} testid="registre">
                        <span className={l.actif ? '' : 'opacity-60'}>
                          <b className="font-heading text-[14px] font-bold text-ink">{l.code}</b> {!l.actif && <Pastille ton="gris">Inactif</Pastille>}
                          <span className="block text-[13px]">{l.libelle}</span>
                        </span>
                        <span className="text-text-muted">{l.porteeLibelle}</span>
                        <span>
                          <b className="block break-all font-heading text-[13px]" data-testid="prochain-numero">{l.prochainNumero ?? '—'}</b>
                          <span className="block break-all font-mono text-[11.5px] text-text-muted">{l.gabarit}</span>
                          {l.prochainNumeroUnite && <span className="block text-[11.5px] text-text-muted">pour {l.prochainNumeroUnite}</span>}
                        </span>
                        <span data-testid="numeros-annee">
                          <b className="block">{l.utilisesAnnee} numéro(s)</b>
                          <span className="block text-[12px] text-text-muted">{l.dernierLe ? `dernier le ${formatDate(l.dernierLe)}` : 'aucun cette année'}</span>
                        </span>
                        <span data-testid="habilites">
                          {l.habilites.length === 0 ? (
                            <b className={l.actif ? 'text-clay' : 'text-text-muted'}>Personne</b>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {l.habilites.map((h) => (
                                <Pastille key={`${h.id}-${h.unite}`} ton={h.actif ? 'encre' : 'rouge'}>
                                  {h.nom}
                                  {h.unite && l.portee === 'UNITE' ? ` · ${h.unite}` : ''}
                                  {h.actif ? '' : ' · compte inactif'}
                                </Pastille>
                              ))}
                            </span>
                          )}
                        </span>
                        <span data-testid="famille-liee">
                          {l.familles.length === 0 ? (
                            <span className="text-text-muted">—</span>
                          ) : (
                            l.familles.map((f) => (
                              <span key={f.code} className="block">
                                {f.libelle} {f.etat !== 'PRETE' && <Pastille ton="ambre">à corriger</Pastille>}
                              </span>
                            ))
                          )}
                        </span>
                        <span className="flex justify-end">
                          {r && (
                            <MenuActions
                              actions={[
                                { label: 'Modifier', onSelect: () => setEdition(r) },
                                { label: 'Voir les compteurs', onSelect: () => setCompteursDe(r) },
                                { label: 'Reprise d’un compteur', onSelect: () => setReprise(r) },
                                { label: r.isActive ? 'Désactiver' : 'Réactiver', onSelect: () => void basculer(r, !r.isActive), danger: r.isActive },
                              ]}
                            />
                          )}
                        </span>
                      </LigneTableau>
                    );
                  })}
                </Tableau>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="max-w-[680px] text-[12.5px] text-text-muted">
            Une habilitation permet d’enregistrer le courrier d’un registre (et d’expédier ses actes signés) pour une unité. Elle ne donne aucune autorité d’imputation ni de signature.
          </p>
          {vue.habilitations
            .filter((g) => !masquerDemo || !g.registre.demonstration)
            .map((g) => (
              <section key={g.registre.id} className="rounded-xl border border-line bg-surface" data-testid="habilitations-registre" aria-labelledby={`hab-${g.registre.id}`}>
                <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
                  <h2 id={`hab-${g.registre.id}`} className="text-[14px] font-bold text-ink-900">
                    {g.registre.code} <span className="font-normal text-text-muted">— {g.registre.libelle}</span>
                  </h2>
                  {!g.registre.actif && <Pastille ton="gris">Inactif</Pastille>}
                  {g.registre.actif && g.actives.filter((h) => h.compteActif).length === 0 && <Pastille ton="rouge">Personne</Pastille>}
                  <button type="button" className="ml-auto text-[12.5px] font-semibold text-ink hover:underline" onClick={() => setAccorder(g.registre.id)} disabled={!g.registre.actif}>
                    Habiliter quelqu’un
                  </button>
                </header>
                {g.actives.length === 0 ? (
                  <p className="px-4 py-2.5 text-[13px] text-text-muted">Aucune habilitation active.</p>
                ) : (
                  <ul>
                    {g.actives.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line-doux px-4 py-2 text-[13px] last:border-b-0" data-testid="habilitation">
                        <span className="font-semibold">{h.nom}</span>
                        {!h.compteActif && <Pastille ton="rouge">Compte inactif</Pastille>}
                        <span className="text-text-muted">{h.unite}</span>
                        <span className="text-[12px] text-text-muted">depuis le {formatDate(h.depuis)}</span>
                        <span className="sr-only">{g.registre.code}</span>
                        <button type="button" onClick={() => revoquer(h, g.registre.code)} className="ml-auto text-[12.5px] font-semibold text-clay hover:underline">
                          Révoquer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {g.historique.length > 0 && (
                  <details className="border-t border-line-doux px-4 py-2">
                    <summary className="cursor-pointer text-[12.5px] font-semibold text-text-muted">Historique ({g.historique.length})</summary>
                    <ul className="mt-1">
                      {g.historique.map((h) => (
                        <li key={h.id} className="text-[12.5px] text-text-muted" data-testid="habilitation">
                          {h.nom} · {h.unite} · du {formatDate(h.depuis)} au {formatDate(h.revoqueeLe!)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
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
      {accorder !== null && (
        <FenetreHabilitation
          registreInitial={accorder || undefined}
          registres={registres.filter((r) => r.isActive)}
          unites={unites}
          onClose={() => setAccorder(null)}
          onFait={() => {
            setAccorder(null);
            charger();
          }}
        />
      )}
      {reprise && (
        <FenetreReprise
          registre={reprise}
          unites={unites}
          onClose={() => setReprise(null)}
          onFait={() => {
            setReprise(null);
            charger();
          }}
        />
      )}
      {compteursDe && <FenetreCompteurs registre={compteursDe} unites={unites} onClose={() => setCompteursDe(null)} />}
    </div>
  );
}

const GRILLE_REGISTRES = 'lg:grid-cols-[minmax(0,1.3fr)_90px_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,1fr)_44px]';

/** Compteurs d'un registre (par unité et par année), en lecture. */
function FenetreCompteurs({ registre, unites, onClose }: { registre: Registre; unites: Unite[]; onClose: () => void }) {
  const [compteurs, setCompteurs] = useState<Compteur[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    getCompteurs(registre.id).then(setCompteurs).catch((e) => setErreur(messageErreur(e, 'Les compteurs n’ont pas pu être lus.')));
  }, [registre.id]);
  return (
    <Fenetre titre={`Compteurs — ${registre.code}`} onClose={onClose} largeur={560}>
      <ErreurChargement message={erreur} />
      {compteurs === null ? (
        !erreur && <SqueletteListe lignes={3} colonnes={4} />
      ) : compteurs.length === 0 ? (
        <Vide>Aucun numéro encore attribué dans ce registre.</Vide>
      ) : (
        <table className="w-full text-left text-[13px]">
          <thead className="bg-fond-doux text-[12px] text-text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Unité</th>
              <th className="px-3 py-2 font-semibold">Année</th>
              <th className="px-3 py-2 font-semibold">Dernier numéro</th>
              <th className="px-3 py-2 font-semibold">Mis à jour</th>
            </tr>
          </thead>
          <tbody>
            {compteurs.map((c) => (
              <tr key={`${c.uniteKey}-${c.annee}`} className="border-t border-line" data-testid="compteur">
                <td className="px-3 py-2">{libelleUnite(unites, c.uniteKey)}</td>
                <td className="px-3 py-2">{c.annee}</td>
                <td className="px-3 py-2 font-semibold">{c.dernier}</td>
                <td className="px-3 py-2 text-text-muted">{formatDate(c.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Fenetre>
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

function FenetreHabilitation({ registreInitial, registres, unites, onClose, onFait }: { registreInitial?: string; registres: Registre[]; unites: Unite[]; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  useEffect(() => {
    listAllUsers().then((u) => setUsers(u.filter((x) => x.status === 'ACTIF'))).catch(() => setUsers([]));
  }, []);
  const [userId, setUserId] = useState('');
  const [registreId, setRegistreId] = useState(registreInitial ?? registres[0]?.id ?? '');
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
