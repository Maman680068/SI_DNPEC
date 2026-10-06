'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { listerParametres, modifierParametre } from '../../lib/api/securite';
import type { ListeParametres, Parametre } from '../../lib/securite/types';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { messageErreur, useToast } from '../ui/Toast';
import { Bandeau, BTN_PRINCIPAL } from '../ui/Charte';

/**
 * Rubriques d'affichage des paramètres (maquette « apres-parametres ») : simple regroupement visuel
 * par préfixe de clé, sans aucun droit ; un paramètre inconnu de cette table va dans « Autres ».
 */
const RUBRIQUES: { nom: string; prefixes: string[] }[] = [
  { nom: 'Congés', prefixes: ['conges.'] },
  { nom: 'Personnel et RH', prefixes: ['rh.', 'finPrevue.'] },
  { nom: 'Sécurité', prefixes: ['motDePasse.', 'session.', 'connexions.'] },
  { nom: 'Modélisation', prefixes: ['calcul.'] },
];
const rubriqueDe = (cle: string) => RUBRIQUES.find((r) => r.prefixes.some((p) => cle.startsWith(p)))?.nom ?? 'Autres';

const jourMois = (d: string) => {
  const x = new Date(d);
  return x.toLocaleDateString('fr-FR', x.getFullYear() === new Date().getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Onglet « Paramètres » de « Paramétrage et supervision » (socle N2, §13.6 ; refonte étape 8) :
 * rubriques à gauche avec leur nombre de paramètres, lignes à droite (libellé, effet, bornes, champ
 * avec unité, « Modifié le … » ou « Valeur par défaut »). L'administrateur saisit les valeurs puis
 * « Enregistrer » (en-tête de page, fourni par `onActions`) : une requête par paramètre changé, les
 * bornes restent contrôlées par le serveur (refus affiché sous la ligne). DN et DNA : lecture seule.
 */
export function Parametres({ onActions }: { onActions: (actions: ReactNode) => void }) {
  const [liste, setListe] = useState<ListeParametres | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rubrique, setRubrique] = useState<string | null>(null);
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [refus, setRefus] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState(false);
  const toast = useToast();

  useEffect(() => {
    listerParametres()
      .then(setListe)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);

  const rubriques = useMemo(() => {
    const noms = [...RUBRIQUES.map((r) => r.nom), 'Autres'];
    return noms.map((nom) => ({ nom, parametres: (liste?.parametres ?? []).filter((p) => rubriqueDe(p.cle) === nom) })).filter((r) => r.parametres.length > 0);
  }, [liste]);
  const active = rubriques.find((r) => r.nom === rubrique) ?? rubriques[0];

  const modifies = (liste?.parametres ?? []).filter((p) => saisies[p.cle] !== undefined && saisies[p.cle] !== String(p.valeur));
  const peutModifier = !!liste?.droits.peutModifier;

  async function enregistrer() {
    if (modifies.length === 0) return;
    setEnCours(true);
    const nouveauxRefus: Record<string, string> = {};
    let derniere: ListeParametres | null = null;
    // Valeurs d'avant, pour « Annuler » (remise en l'état par la même route, même droit).
    const anciennes: { cle: string; valeur: number }[] = [];
    for (const p of modifies) {
      const texte = (saisies[p.cle] ?? '').trim();
      try {
        derniere = await modifierParametre(p.cle, texte === '' ? Number.NaN : Number(texte));
        anciennes.push({ cle: p.cle, valeur: p.valeur });
      } catch (e) {
        nouveauxRefus[p.cle] = messageErreur(e, 'Modification impossible');
      }
    }
    if (derniere) setListe(derniere);
    // Les valeurs refusées restent saisies (à corriger) ; les autres reprennent la valeur enregistrée.
    setSaisies((s) => Object.fromEntries(Object.entries(s).filter(([cle]) => nouveauxRefus[cle])));
    setRefus(nouveauxRefus);
    setEnCours(false);
    const faits = anciennes.length;
    if (faits > 0 && Object.keys(nouveauxRefus).length === 0)
      toast.succes(`${faits} paramètre${faits > 1 ? 's' : ''} enregistré${faits > 1 ? 's' : ''}`, {
        detail: 'La nouvelle valeur s’applique aussitôt.',
        annuler: async () => {
          let l: ListeParametres | null = null;
          try {
            for (const a of anciennes) l = await modifierParametre(a.cle, a.valeur);
            if (l) setListe(l);
            toast.succes('Modification annulée', { detail: 'Les valeurs précédentes sont rétablies.' });
          } catch (e) {
            toast.erreur('Annulation impossible', messageErreur(e));
          }
        },
      });
  }

  // Bouton « Enregistrer » de l'en-tête de page (administrateur seulement, actif dès qu'une valeur change).
  const nbModifies = modifies.length;
  useEffect(() => {
    onActions(
      peutModifier ? (
        <button type="button" className={BTN_PRINCIPAL} disabled={nbModifies === 0 || enCours} onClick={() => void enregistrer()} data-testid="enregistrer-parametres">
          <Check aria-hidden size={17} />
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
          {nbModifies > 0 && !enCours && <span className="sr-only"> ({nbModifies} modification{nbModifies > 1 ? 's' : ''})</span>}
        </button>
      ) : null,
    );
  }, [peutModifier, nbModifies, enCours, saisies]);
  useEffect(() => () => onActions(null), [onActions]);

  if (!liste || !active) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} lignes={6} /></>;

  return (
    <>
      {Object.keys(refus).length > 0 && (
        <Bandeau ton="rouge" testid="parametres-refuses">
          {Object.keys(refus).length} valeur{Object.keys(refus).length > 1 ? 's' : ''} refusée{Object.keys(refus).length > 1 ? 's' : ''} : corrigez la saisie signalée puis « Enregistrer ».
        </Bandeau>
      )}
      <div className="grid items-start gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Rubriques des paramètres" className="rounded-xl border border-line bg-surface p-2">
          <ul className="flex flex-wrap gap-1 md:flex-col">
            {rubriques.map((r) => {
              const on = r.nom === active.nom;
              const enAttente = r.parametres.some((p) => modifies.includes(p) || refus[p.cle]);
              return (
                <li key={r.nom}>
                  <button
                    type="button"
                    aria-current={on ? 'true' : undefined}
                    onClick={() => setRubrique(r.nom)}
                    data-testid="rubrique-parametres"
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-[9px] text-left text-[13.5px] ${on ? 'bg-ink-50 font-semibold text-ink' : 'text-text hover:bg-bg'}`}
                  >
                    <span>
                      {r.nom}
                      {enAttente && <span aria-hidden className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-ambre-vif align-middle" />}
                      {enAttente && <span className="sr-only"> (modification non enregistrée)</span>}
                    </span>
                    <span className="text-[12.5px] font-semibold text-text-muted">{r.parametres.length}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section aria-label={`Paramètres : ${active.nom}`} className="overflow-hidden rounded-xl border border-line bg-surface">
          <h2 className="sr-only">{active.nom}</h2>
          <ul>
            {active.parametres.map((p) => (
              <LigneParametre
                key={p.cle}
                p={p}
                peutModifier={peutModifier}
                saisie={saisies[p.cle]}
                refus={refus[p.cle]}
                onSaisie={(v) => setSaisies((s) => ({ ...s, [p.cle]: v }))}
              />
            ))}
          </ul>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-[18px] py-3 text-[12.5px] text-text-muted">
            <span>Chaque modification est tracée dans le journal d’audit, avec l’ancienne et la nouvelle valeur ; chaque valeur reste dans ses bornes et s’applique aussitôt.</span>
            {peutModifier && modifies.length > 0 && (
              <button type="button" className="font-semibold text-ink underline" onClick={() => (setSaisies({}), setRefus({}))}>
                Annuler les modifications
              </button>
            )}
          </p>
        </section>
      </div>
    </>
  );
}

function LigneParametre({ p, peutModifier, saisie, refus, onSaisie }: { p: Parametre; peutModifier: boolean; saisie: string | undefined; refus?: string; onSaisie: (v: string) => void }) {
  const id = `parametre-${p.cle.replace(/\W/g, '-')}`;
  const change = saisie !== undefined && saisie !== String(p.valeur);
  return (
    <li data-testid="parametre" data-cle={p.cle} className="grid grid-cols-1 items-center gap-x-4 gap-y-2 border-b border-[#F0F1F6] px-[18px] py-3.5 sm:grid-cols-[minmax(0,1fr)_180px] lg:grid-cols-[minmax(0,1fr)_180px_130px]">
      <div className="min-w-0">
        <label htmlFor={peutModifier ? id : undefined} className="block text-[14px] font-semibold text-text">
          {p.libelle}
        </label>
        <span className="block text-[12.5px] text-text-muted">{p.effet}</span>
        <span className="block text-[12px] text-text-muted" data-testid="bornes">
          Bornes : {p.min} à {p.max} {p.unite} · défaut {p.defaut} · {p.reference}
        </span>
      </div>
      {peutModifier ? (
        <div className={`flex h-[38px] items-center gap-2 rounded-[9px] border bg-surface px-[11px] focus-within:border-ink ${refus ? 'border-clay' : change ? 'border-ink' : 'border-line'}`}>
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={p.min}
            max={p.max}
            step={1}
            value={saisie ?? String(p.valeur)}
            onChange={(e) => onSaisie(e.target.value)}
            aria-invalid={refus ? true : undefined}
            aria-describedby={refus ? `${id}-refus` : undefined}
            data-testid="champ-valeur"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-text focus:outline-none"
          />
          <span className="flex-none text-[12.5px] font-semibold text-text-muted">{p.unite}</span>
        </div>
      ) : (
        <div className="flex h-[38px] items-center justify-between gap-2 rounded-[9px] border border-line px-[11px]" data-testid="valeur">
          <span className="text-[14px] font-semibold text-text">{p.valeur}</span>
          <span className="text-[12.5px] font-semibold text-text-muted">{p.unite}</span>
        </div>
      )}
      <span className="text-[12.5px]" data-testid="etat-parametre">
        {change ? (
          <span className="font-semibold text-ink">Non enregistré</span>
        ) : p.modifie && p.modifieLe ? (
          <>
            <span className="block font-semibold text-ambre">Modifié le {jourMois(p.modifieLe)}</span>
            {p.modifiePar && <span className="block text-[12px] text-text-muted">par {p.modifiePar}</span>}
          </>
        ) : (
          <span className="text-text-muted">Valeur par défaut</span>
        )}
      </span>
      {refus && (
        <p id={`${id}-refus`} role="alert" className="text-[12.5px] font-semibold text-clay sm:col-span-2 lg:col-span-3">
          {refus}
        </p>
      )}
    </li>
  );
}
