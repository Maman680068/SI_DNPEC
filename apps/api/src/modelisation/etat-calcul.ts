import { StatutTravailCalcul, TypeTravailCalcul } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CLE_DERNIER_CONTACT, DernierContact } from './calcul.client';

type Etat = 'NOMINAL' | 'DEGRADE' | 'INDISPONIBLE';
/** Le service gratuit s'endort après 15 minutes sans appel (Render). */
const ENDORMI_APRES_MS = 15 * 60_000;
const ATTENTE_ANORMALE_MS = 10 * 60_000;

const heure = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const secondes = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`);

/**
 * État du service de calcul pour la supervision : éveillé, endormi ou injoignable, dernier appel,
 * durée moyenne des calculs, file d'attente. Aucune sonde active (elle empêcherait le service gratuit
 * de s'endormir) : tout se lit dans les derniers appels notés par CalculClient. Aucun chiffre économique.
 */
export async function etatServiceCalcul(prisma: PrismaService, maintenant = Date.now()): Promise<{ etat: Etat; detail: string }> {
  if (!process.env.CALCUL_URL || (process.env.CALCUL_SECRET ?? '').length < 16) {
    return { etat: 'DEGRADE', detail: 'Service de calcul non configuré (CALCUL_URL, CALCUL_SECRET) : aucun paquet ne peut être vérifié.' };
  }
  const ligne = await prisma.parametre.findUnique({ where: { cle: CLE_DERNIER_CONTACT } });
  const dernier = (ligne?.valeur ?? null) as DernierContact | null;
  const moyennes: string[] = [];
  for (const [type, libelle] of [[TypeTravailCalcul.VERIFICATION, 'vérification'], [TypeTravailCalcul.EXECUTION, 'exécution']] as const) {
    const d = await prisma.travailCalcul.findMany({ where: { type, statut: StatutTravailCalcul.TERMINE, dureeMs: { not: null } }, orderBy: { termineLe: 'desc' }, take: 20, select: { dureeMs: true } });
    if (d.length) moyennes.push(`${libelle} ${secondes(Math.round(d.reduce((s, x) => s + (x.dureeMs ?? 0), 0) / d.length))}`);
  }
  const plusAncien = await prisma.travailCalcul.findFirst({ where: { statut: StatutTravailCalcul.EN_FILE }, orderBy: { enFileLe: 'asc' }, select: { enFileLe: true } });
  const enFile = await prisma.travailCalcul.count({ where: { statut: { in: [StatutTravailCalcul.EN_FILE, StatutTravailCalcul.EN_COURS] } } });
  const moyenne = moyennes.length ? ` ; durée moyenne : ${moyennes.join(', ')}` : '';
  const file = enFile ? ` ; ${enFile} travail(aux) en file` : '';
  if (!dernier) return { etat: 'NOMINAL', detail: `Aucun appel encore : le service s’éveille au premier calcul${file}` };
  const date = new Date(dernier.date);
  if (!dernier.succes) return { etat: 'INDISPONIBLE', detail: `Injoignable au dernier appel (${heure(date)}) : ${dernier.message ?? 'sans réponse'}${file}` };
  if (plusAncien && maintenant - +plusAncien.enFileLe > ATTENTE_ANORMALE_MS) {
    return { etat: 'DEGRADE', detail: `Travail en attente depuis ${heure(plusAncien.enFileLe)} (plus de 10 minutes)${file}${moyenne}` };
  }
  const eveille = maintenant - +date < ENDORMI_APRES_MS;
  return {
    etat: 'NOMINAL',
    detail: `${eveille ? 'Éveillé' : 'Endormi (il se réveille au prochain calcul, en une minute environ)'} — dernier appel le ${heure(date)} (${secondes(dernier.dureeMs)})${moyenne}${file}`,
  };
}

/** Espace occupé par les paquets de modèles déposés (toutes versions, immuables). */
export async function espacePaquets(prisma: PrismaService): Promise<{ etat: Etat; detail: string }> {
  const a = await prisma.versionModele.aggregate({ _sum: { tailleOctets: true }, _count: { _all: true } });
  const octets = a._sum.tailleOctets ?? 0;
  const mo = (octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return { etat: 'NOMINAL', detail: `${mo} Mo occupés par ${a._count._all} paquet(s) de modèle déposé(s) (versions conservées, jamais supprimées)` };
}
