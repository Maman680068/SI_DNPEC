import { createHash } from 'crypto';
import { inflateRawSync } from 'zlib';

/**
 * Paquet de modèle (format « dnpec-modele/1 ») : contrôle du zip AVANT tout stockage, et validation
 * de modele.json par le serveur. Lecture du répertoire central du zip, sans dépendance ni extraction
 * sur le disque : seul modele.json est décompressé, en mémoire et borné.
 * Les mêmes contrôles sont refaits par le service de calcul avant son extraction.
 */
export const TAILLE_MAX_PAQUET = 50 * 1024 * 1024;
const DECOMPRESSE_MAX = 300 * 1024 * 1024;
const ENTREES_MAX = 2000;
const FICHE_MAX = 1024 * 1024;
export const FORMAT_PAQUET = 'dnpec-modele/1';

export class PaquetRefuse extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

export const empreinteSha256 = (contenu: Buffer) => createHash('sha256').update(contenu).digest('hex');

type Entree = { nom: string; methode: number; tailleCompressee: number; taille: number; offsetLocal: number; dossier: boolean };

function cheminSur(nom: string): void {
  if (!nom || nom.includes('\0')) throw new PaquetRefuse('Nom de fichier vide ou invalide dans le paquet.');
  const brut = nom.replace(/\\/g, '/');
  if (brut.startsWith('/') || /^[A-Za-z]:/.test(brut)) throw new PaquetRefuse(`Chemin absolu refusé dans le paquet : « ${nom} ».`);
  if (brut.split('/').some((p) => p === '..')) throw new PaquetRefuse(`Chemin remontant (« .. ») refusé dans le paquet : « ${nom} ».`);
}

/** Répertoire central du zip, contrôlé entrée par entrée (aucun fichier n'est extrait). */
function lireRepertoire(zip: Buffer): Entree[] {
  if (zip.length > TAILLE_MAX_PAQUET) throw new PaquetRefuse('Le paquet dépasse 50 Mo.');
  let fin = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65535); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new PaquetRefuse('Le fichier n’est pas un zip lisible.');
  const nombre = zip.readUInt16LE(fin + 10);
  const taille = zip.readUInt32LE(fin + 12);
  let pos = zip.readUInt32LE(fin + 16);
  if (nombre === 0xffff || taille === 0xffffffff || pos === 0xffffffff) throw new PaquetRefuse('Le format zip64 n’est pas accepté.');
  if (nombre > ENTREES_MAX) throw new PaquetRefuse(`Le paquet contient plus de ${ENTREES_MAX} fichiers.`);
  if (pos + taille > zip.length) throw new PaquetRefuse('Le fichier n’est pas un zip lisible.');
  const entrees: Entree[] = [];
  let total = 0;
  for (let k = 0; k < nombre; k++) {
    if (pos + 46 > zip.length || zip.readUInt32LE(pos) !== 0x02014b50) throw new PaquetRefuse('Le fichier n’est pas un zip lisible.');
    const drapeaux = zip.readUInt16LE(pos + 8);
    const methode = zip.readUInt16LE(pos + 10);
    const tailleCompressee = zip.readUInt32LE(pos + 20);
    const tailleFichier = zip.readUInt32LE(pos + 24);
    const lnom = zip.readUInt16LE(pos + 28);
    const lextra = zip.readUInt16LE(pos + 30);
    const lcomm = zip.readUInt16LE(pos + 32);
    const attributs = zip.readUInt32LE(pos + 38);
    const offsetLocal = zip.readUInt32LE(pos + 42);
    const nom = zip.subarray(pos + 46, pos + 46 + lnom).toString('utf8');
    cheminSur(nom);
    if (((attributs >>> 16) & 0o170000) === 0o120000) throw new PaquetRefuse(`Lien symbolique refusé dans le paquet : « ${nom} ».`);
    if (drapeaux & 0x1) throw new PaquetRefuse('Les paquets chiffrés ne sont pas acceptés.');
    total += tailleFichier;
    if (total > DECOMPRESSE_MAX) throw new PaquetRefuse('Le paquet décompressé dépasse 300 Mo.');
    entrees.push({ nom: nom.replace(/\\/g, '/'), methode, tailleCompressee, taille: tailleFichier, offsetLocal, dossier: nom.endsWith('/') });
    pos += 46 + lnom + lextra + lcomm;
  }
  return entrees;
}

function extraire(zip: Buffer, e: Entree): Buffer {
  const p = e.offsetLocal;
  if (p + 30 > zip.length || zip.readUInt32LE(p) !== 0x04034b50) throw new PaquetRefuse('Le fichier n’est pas un zip lisible.');
  const debut = p + 30 + zip.readUInt16LE(p + 26) + zip.readUInt16LE(p + 28);
  const donnees = zip.subarray(debut, debut + e.tailleCompressee);
  if (e.methode === 0) return Buffer.from(donnees);
  if (e.methode === 8) {
    try {
      return inflateRawSync(donnees, { maxOutputLength: FICHE_MAX });
    } catch {
      throw new PaquetRefuse('modele.json est illisible ou dépasse 1 Mo.');
    }
  }
  throw new PaquetRefuse('Méthode de compression non prise en charge dans le paquet.');
}

// ---------------------------------------------------------------------------------------------
// modele.json
// ---------------------------------------------------------------------------------------------

export type ManetteFiche = {
  id: string;
  libelle: string;
  detail?: string;
  type: 'choc' | 'hypothese';
  unite?: string;
  indices?: { code: string; libelle: string }[] | null;
  min: number;
  max: number;
  defaut?: number | null;
  actif?: boolean;
};
export type CompteurFiche = { id: string; libelle: string; unite?: string; indices?: unknown };
export type ControleFiche = { id: string; libelle: string; moment?: string; type: 'bloquant' | 'alerte'; seuil?: string };
export type FicheModele = {
  format: string;
  code: string;
  nom: string;
  description?: string;
  famille: string;
  famille_libelle?: string;
  base?: string;
  horizon?: { debut: number; fin: number };
  modes?: string[];
  taille?: Record<string, number>;
  moteur?: { langage?: string; point_entree?: string; solveur?: string; dependances?: string[] };
  fichiers?: { chemin: string; role?: string }[];
  reference?: { fichier?: string; logiciel?: string; date?: string };
  manettes: ManetteFiche[];
  compteurs: CompteurFiche[];
  controles: ControleFiche[];
  a_confirmer?: string[];
  [cle: string]: unknown;
};

const ID = /^[a-z][a-z0-9_]{0,63}$/;
const texte = (v: unknown, max = 500) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const nombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validation serveur de modele.json : renvoie la liste des erreurs (vide si conforme). */
export function validerFiche(f: unknown): string[] {
  const e: string[] = [];
  if (!f || typeof f !== 'object' || Array.isArray(f)) return ['modele.json doit contenir un objet JSON.'];
  const d = f as Record<string, unknown>;
  if (d.format !== FORMAT_PAQUET) e.push(`format : « ${FORMAT_PAQUET} » attendu.`);
  if (typeof d.code !== 'string' || !/^[A-Z][A-Z0-9_]{1,40}$/.test(d.code)) e.push('code : majuscules, chiffres et « _ » seulement (2 à 41 caractères).');
  if (!texte(d.nom, 200)) e.push('nom : texte obligatoire (200 caractères au plus).');
  if (!texte(d.famille, 20)) e.push('famille : texte obligatoire.');
  if (d.horizon !== undefined) {
    const h = d.horizon as Record<string, unknown>;
    if (!h || !Number.isInteger(h.debut) || !Number.isInteger(h.fin) || (h.debut as number) > (h.fin as number)) e.push('horizon : années de début et de fin entières, début ≤ fin.');
  }
  const moteur = (d.moteur ?? {}) as Record<string, unknown>;
  if (moteur.point_entree !== undefined && moteur.point_entree !== 'modele.py') e.push('moteur.point_entree : « modele.py » attendu.');
  if (moteur.langage !== undefined && moteur.langage !== 'python') e.push('moteur.langage : « python » attendu.');

  const liste = (cle: string): Record<string, unknown>[] | null => {
    const v = d[cle];
    if (!Array.isArray(v)) {
      e.push(`${cle} : liste obligatoire.`);
      return null;
    }
    return v as Record<string, unknown>[];
  };
  const uniques = (nom: string, ids: unknown[]) => {
    const vus = new Set<string>();
    for (const id of ids) {
      if (typeof id !== 'string' || !ID.test(id)) e.push(`${nom} : identifiant invalide « ${String(id)} » (minuscules, chiffres, « _ »).`);
      else if (vus.has(id)) e.push(`${nom} : identifiant en double « ${id} ».`);
      else vus.add(id);
    }
  };

  const manettes = liste('manettes');
  if (manettes) {
    uniques('manettes', manettes.map((m) => m?.id));
    for (const m of manettes) {
      const id = String(m?.id);
      if (!texte(m?.libelle, 200)) e.push(`manette ${id} : libellé obligatoire.`);
      if (m?.type !== 'choc' && m?.type !== 'hypothese') e.push(`manette ${id} : type « choc » ou « hypothese ».`);
      if (!nombre(m?.min) || !nombre(m?.max) || !(m.min < m.max)) e.push(`manette ${id} : bornes numériques avec min < max.`);
      else if (m.defaut !== undefined && m.defaut !== null && (!nombre(m.defaut) || m.defaut < m.min || m.defaut > m.max)) e.push(`manette ${id} : valeur par défaut hors des bornes.`);
      if (m?.indices !== undefined && m?.indices !== null) {
        if (!Array.isArray(m.indices) || m.indices.length === 0) e.push(`manette ${id} : indices en liste non vide.`);
        else {
          const codes = (m.indices as Record<string, unknown>[]).map((x) => x?.code);
          if (codes.some((c) => typeof c !== 'string' || !c)) e.push(`manette ${id} : chaque indice a un code.`);
          else if (new Set(codes).size !== codes.length) e.push(`manette ${id} : code d’indice en double.`);
        }
      }
    }
  }
  const compteurs = liste('compteurs');
  if (compteurs) {
    uniques('compteurs', compteurs.map((c) => c?.id));
    for (const c of compteurs) if (!texte(c?.libelle, 200)) e.push(`compteur ${String(c?.id)} : libellé obligatoire.`);
  }
  const controles = liste('controles');
  if (controles) {
    uniques('controles', controles.map((c) => c?.id));
    for (const c of controles) {
      if (!texte(c?.libelle, 300)) e.push(`contrôle ${String(c?.id)} : libellé obligatoire.`);
      if (c?.type !== 'bloquant' && c?.type !== 'alerte') e.push(`contrôle ${String(c?.id)} : type « bloquant » ou « alerte ».`);
    }
  }
  return e;
}

export type PaquetLu = { empreinte: string; fiche: FicheModele; fichiers: string[] };

/** Contrôle complet du zip et de sa fiche ; lève PaquetRefuse (message et détails en français). */
export function lirePaquet(zip: Buffer): PaquetLu {
  const entrees = lireRepertoire(zip);
  const fichiers = entrees.filter((x) => !x.dossier).map((x) => x.nom);
  let racine = '';
  if (!fichiers.includes('modele.json')) {
    const tetes = new Set(fichiers.filter((f) => f.includes('/')).map((f) => f.split('/')[0]));
    if (tetes.size === 1 && fichiers.every((f) => f.includes('/'))) racine = `${[...tetes][0]}/`;
  }
  const manquants = ['modele.json', 'modele.py'].filter((f) => !fichiers.includes(racine + f));
  if (manquants.length) throw new PaquetRefuse(`Fichier obligatoire absent du paquet : ${manquants.join(', ')}.`);
  const e = entrees.find((x) => x.nom === `${racine}modele.json`)!;
  if (e.taille > FICHE_MAX) throw new PaquetRefuse('modele.json dépasse 1 Mo.');
  let fiche: unknown;
  try {
    fiche = JSON.parse(extraire(zip, e).toString('utf8'));
  } catch (err) {
    if (err instanceof PaquetRefuse) throw err;
    throw new PaquetRefuse('modele.json n’est pas un JSON valide.');
  }
  const erreurs = validerFiche(fiche);
  if (erreurs.length) throw new PaquetRefuse('modele.json n’est pas conforme au format « dnpec-modele/1 ».', erreurs);
  return { empreinte: empreinteSha256(zip), fiche: fiche as FicheModele, fichiers: fichiers.map((f) => f.slice(racine.length)) };
}
