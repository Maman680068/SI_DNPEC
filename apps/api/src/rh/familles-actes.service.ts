import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, RegistreNature, RegistrePortee, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { estDrh } from '../socle/roles-fonctionnels';
import { RegistresService } from '../courrier/registres.service';
import { NumerotationService } from '../courrier/numerotation.service';
import { UNITE_DIRECTION } from '../courrier/unites';

/** Code de registre attendu pour chaque famille d'actes RH (S7). */
export const CODE_ATTENDU: Record<string, string> = {
  ARRETE_AFFECTATION: 'AFF',
  DECISION_NOMINATION: 'NOM',
  DECISION_AVANCEMENT: 'AVA',
  DECISION_FIN_CONTRAT: 'FDC',
  ATTESTATION_STAGE: 'ATS',
  ATTESTATION_TRAVAIL: 'ATT',
};
/** Format des registres créés depuis cet écran. */
export const GABARIT_FAMILLE = '{seq:4}/MEFB/DNPEC/{code}/{annee}';

export type EtatFamille = 'PRETE' | 'A_CORRIGER' | 'BLOQUEE';

/**
 * Familles d'actes et registres (S7, docs/conception_S7_familles_actes.md) : état de chaque famille (prête :
 * registre d'actes actif de la Direction au bon code ; à corriger : code qui ne correspond pas ; bloquée :
 * sans registre — l'acte ne peut être ni préparé ni signé), aperçu du prochain numéro sans consommer la
 * séquence, nombre d'actes de l'année ; « Créer le registre XXX » / « Passer au registre XXX » / « Lui donner
 * XXX » (création par le service des registres du Courrier et rattachement en une fois, audités).
 * Droits inchangés : DRH et administrateur configurent ; DN et DNA lisent.
 */
@Injectable()
export class FamillesActesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly registres: RegistresService,
    private readonly numerotation: NumerotationService,
  ) {}

  private gere(actor: AuthenticatedUser) {
    return estDrh(actor) || actor.role === SystemRole.ADMIN_SYSTEME;
  }

  async etat(actor: AuthenticatedUser, maintenant = new Date()) {
    const gerer = this.gere(actor);
    if (!gerer && actor.role !== SystemRole.DN && actor.role !== SystemRole.DNA) throw new ForbiddenException('Réservé au DRH, à l’administrateur, au DN et à la DNA.');
    const familles = await this.prisma.familleActeRh.findMany({
      orderBy: { libelle: 'asc' },
      select: { code: true, libelle: true, registre: { select: { id: true, code: true, libelle: true, isActive: true, nature: true, portee: true, gabaritNumero: true } } },
    });
    const parCode = new Map((await this.prisma.registreCourrier.findMany({ where: { code: { in: Object.values(CODE_ATTENDU) } }, select: { id: true, code: true } })).map((r) => [r.code, r]));
    const annee = maintenant.getFullYear();
    const lignes = [];
    for (const f of familles) {
      const attendu = CODE_ATTENDU[f.code] ?? null;
      const r = f.registre;
      const utilisable = !!r && r.isActive && r.nature === RegistreNature.ACTE && r.portee === RegistrePortee.DIRECTION;
      const etat: EtatFamille = !utilisable ? 'BLOQUEE' : attendu && r!.code !== attendu ? 'A_CORRIGER' : 'PRETE';
      const apercu = utilisable ? await this.numerotation.apercu(r!, UNITE_DIRECTION, 'DNPEC', maintenant) : null;
      const actes = r ? await this.prisma.acteCourrier.count({ where: { registreId: r.id, annee, numero: { not: null } } }) : 0;
      // Qui tient aujourd'hui le registre attendu (une autre famille) ?
      const detenteur = attendu ? familles.find((x) => x.code !== f.code && x.registre?.code === attendu) : undefined;
      const action =
        etat === 'PRETE' || !attendu
          ? null
          : detenteur
            ? { libelle: `Lui donner ${attendu}`, effet: `Le registre ${attendu} quitte « ${detenteur.libelle} », qui devra recevoir le sien.` }
            : etat === 'A_CORRIGER'
              ? { libelle: `Passer au registre ${attendu}`, effet: parCode.has(attendu) ? `Le registre ${attendu} existant lui est rattaché.` : `Le registre ${attendu} est créé (${GABARIT_FAMILLE}) puis rattaché.` }
              : { libelle: parCode.has(attendu) ? `Rattacher le registre ${attendu}` : `Créer le registre ${attendu}`, effet: parCode.has(attendu) ? `Le registre ${attendu} existant lui est rattaché.` : `Registre d’actes de la Direction, format ${GABARIT_FAMILLE}.` };
      lignes.push({
        code: f.code,
        libelle: f.libelle,
        etat,
        codeAttendu: attendu,
        registre: r ? { id: r.id, code: r.code, libelle: r.libelle, actif: r.isActive } : null,
        alerte: etat === 'A_CORRIGER' ? `Le registre ${r!.code} ne correspond pas à « ${f.libelle} » (code attendu : ${attendu}).` : etat === 'BLOQUEE' ? 'Sans registre, l’acte ne peut être ni préparé ni signé.' : null,
        prochainNumero: apercu?.numero ?? null,
        actesAnnee: actes,
        signataire: 'DN ou DNA',
        action: gerer ? action : null,
      });
    }
    const pretes = lignes.filter((l) => l.etat === 'PRETE').length;
    const plan = lignes.filter((l) => l.etat !== 'PRETE' && l.codeAttendu).map((l) => ({ famille: l.libelle, code: l.codeAttendu!, creation: !parCode.has(l.codeAttendu!) }));
    return {
      pretes,
      total: lignes.length,
      familles: lignes,
      // « Configurer les N registres manquants » : ce qui sera créé ou rattaché.
      configuration: gerer ? plan : [],
      registresPossibles: gerer ? await this.prisma.registreCourrier.findMany({ where: { nature: RegistreNature.ACTE, portee: RegistrePortee.DIRECTION, isActive: true }, select: { id: true, code: true, libelle: true }, orderBy: { code: 'asc' } }) : [],
      droits: { gerer },
    };
  }

  /** Donne à la famille son registre au code attendu (créé s'il n'existe pas), retiré à toute autre famille. */
  async registreAttendu(actor: AuthenticatedUser, code: string) {
    if (!this.gere(actor)) throw new ForbiddenException('Réservé au DRH et à l’administrateur.');
    await this.appliquer(actor, code);
    return this.etat(actor);
  }

  private async appliquer(actor: AuthenticatedUser, code: string) {
    const famille = await this.prisma.familleActeRh.findUnique({ where: { code } });
    if (!famille) throw new NotFoundException('Famille d’actes introuvable.');
    const attendu = CODE_ATTENDU[code];
    if (!attendu) throw new BadRequestException('Aucun code de registre n’est prévu pour cette famille.');
    let r = await this.prisma.registreCourrier.findUnique({ where: { code: attendu } });
    let cree = false;
    if (!r) {
      // Création par le service des registres du Courrier (même contrôle du gabarit, même audit).
      r = await this.registres.create(actor, { code: attendu, libelle: famille.libelle, nature: RegistreNature.ACTE, portee: RegistrePortee.DIRECTION, gabaritNumero: GABARIT_FAMILLE } as never);
      cree = true;
    } else if (r.nature !== RegistreNature.ACTE || r.portee !== RegistrePortee.DIRECTION || !r.isActive) {
      throw new ConflictException(`Le registre ${attendu} existe mais n’est pas un registre d’actes actif de la Direction : corrigez-le dans Courrier (administration).`);
    }
    const ancien = famille.registreId;
    await this.prisma.$transaction([
      this.prisma.familleActeRh.updateMany({ where: { registreId: r.id, code: { not: code } }, data: { registreId: null } }),
      this.prisma.familleActeRh.update({ where: { code }, data: { registreId: r.id } }),
    ]);
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'FamilleActeRh', entityId: code, metadata: { event: 'registre_attendu', registre: attendu, cree, ancienRegistreId: ancien } });
  }

  /** « Configurer les N registres manquants » : chaque famille non prête reçoit son registre attendu. */
  async configurerTout(actor: AuthenticatedUser) {
    if (!this.gere(actor)) throw new ForbiddenException('Réservé au DRH et à l’administrateur.');
    const e = await this.etat(actor);
    for (const f of e.familles.filter((x) => x.etat !== 'PRETE' && x.codeAttendu)) await this.appliquer(actor, f.code);
    return this.etat(actor);
  }
}
