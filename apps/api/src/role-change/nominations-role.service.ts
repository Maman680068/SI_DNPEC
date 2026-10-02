import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditAction, NotificationType, RoleFonctionnel, StatutChangementRole, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { TachesPlanifieesService } from '../socle/taches-planifiees.service';
import { detenteursWhere } from '../socle/roles-fonctionnels';
import { ecartsFonctionRole } from '../socle/ecarts-fonction-role';
import { RoleChangeService } from './role-change.service';
import { ROLE_LIBELLE } from './roles';
import { POSTES_RESPONSABILITE, UnitePoste, fonctionPourRole, propositionPourAncienTitulaire, titulaireDuPoste } from './postes';
import { ConfirmerNominationDto, RefuserNominationDto } from './dto/nomination.dto';

/** Rôles proposables à l'actuel titulaire d'un poste (jamais assistant ni stagiaire : pas de superviseur à choisir ici). */
const ROLES_ANCIEN_TITULAIRE: SystemRole[] = [SystemRole.AGENT, ...POSTES_RESPONSABILITE, SystemRole.DRH, SystemRole.ADMIN_SYSTEME];
const LIEN_NOMINATIONS = '/users?onglet=nominations';
const nom = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

/**
 * Nomination d'un chef, option A : l'acte de nomination signé porte un changement de rôle pré-rempli
 * (`changements_role_nomination`, créé par CarriereService dans la transaction de signature). Ici,
 * l'administrateur système le confirme (le changement de rôle de l'actuel titulaire du poste, puis du
 * nommé, passe par RoleChangeService : mêmes contrôles, historique, sessions, notifications) ou le
 * refuse avec un motif (le DRH en est informé). Chaque jour, les écarts entre fonction du dossier et
 * rôle du compte sont signalés aux administrateurs.
 */
@Injectable()
export class NominationsRoleService {
  private readonly logger = new Logger(NominationsRoleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly roles: RoleChangeService,
    private readonly taches: TachesPlanifieesService,
  ) {}

  private exigerAdmin(actor: AuthenticatedUser) {
    if (actor.interimForId) throw new ForbiddenException('Une nomination s’applique en votre nom propre, jamais en intérim.');
    if (actor.role !== SystemRole.ADMIN_SYSTEME) throw new ForbiddenException('Seul l’administrateur système applique les droits d’une nomination.');
  }

  private async unites() {
    const [divisions, sections, cellules] = await Promise.all([
      this.prisma.division.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.section.findMany({ select: { id: true, code: true, name: true, divisionId: true }, orderBy: { name: 'asc' } }),
      this.prisma.cellule.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    const n = { d: new Map(divisions.map((x) => [x.id, x.name])), s: new Map(sections.map((x) => [x.id, x.name])), c: new Map(cellules.map((x) => [x.id, x.name])) };
    const libelle = (u: Partial<UnitePoste>) =>
      [u.divisionId && n.d.get(u.divisionId), u.sectionId && n.s.get(u.sectionId), u.celluleId && n.c.get(u.celluleId)].filter(Boolean).join(' — ') || null;
    return { divisions: divisions.map((d) => ({ ...d, sections: sections.filter((s) => s.divisionId === d.id) })), cellules, libelle };
  }

  async liste(actor: AuthenticatedUser) {
    this.exigerAdmin(actor);
    const lignes = await this.prisma.changementRoleNomination.findMany({
      orderBy: [{ statut: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      include: { mouvement: { select: { dateEffet: true, apres: true } } },
    });
    const ids = [...new Set(lignes.flatMap((l) => [l.userId, l.ancienTitulaireId, l.decideParId]).filter((x): x is string => !!x))];
    const comptes = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, role: true, status: true, divisionId: true, sectionId: true, celluleId: true } })).map((u) => [u.id, u]));
    const { divisions, cellules, libelle } = await this.unites();
    const changements = [];
    for (const l of lignes) {
      const cible = comptes.get(l.userId);
      const unite = { divisionId: l.divisionId, sectionId: l.sectionId, celluleId: l.celluleId };
      const enAttente = l.statut === StatutChangementRole.EN_ATTENTE;
      // En attente : titulaire relu à l'instant (le poste a pu changer depuis la signature).
      const titulaire = enAttente ? await titulaireDuPoste(this.prisma, l.roleCible, unite, l.userId) : l.ancienTitulaireId ? comptes.get(l.ancienTitulaireId) ?? null : null;
      const propose = titulaire && enAttente ? propositionPourAncienTitulaire(l.roleCible, unite) : null;
      changements.push({
        id: l.id,
        statut: l.statut,
        acteNumero: l.acteNumero,
        dateEffet: l.mouvement.dateEffet,
        fonction: (l.mouvement.apres as Record<string, string | null>).fonction ?? null,
        creeLe: l.createdAt,
        decideLe: l.decideLe,
        decidePar: l.decideParId && comptes.get(l.decideParId) ? nom(comptes.get(l.decideParId)!) : null,
        motifRefus: l.motifRefus,
        erreur: l.erreur,
        agent: cible ? { id: cible.id, nom: nom(cible), role: cible.role, libelleRole: ROLE_LIBELLE[cible.role], unite: libelle(cible), actif: cible.status === UserStatus.ACTIF } : null,
        poste: { role: l.roleCible, libelleRole: ROLE_LIBELLE[l.roleCible], unite: libelle(unite), ...unite },
        ancienTitulaire: titulaire
          ? {
              id: titulaire.id,
              nom: nom(titulaire),
              role: titulaire.role,
              libelleRole: ROLE_LIBELLE[titulaire.role],
              propose: propose ? { ...propose, libelleRole: ROLE_LIBELLE[propose.role], unite: libelle(propose) } : null,
            }
          : null,
        droits: { confirmer: enAttente, refuser: enAttente },
      });
    }
    return {
      changements,
      ecarts: await ecartsFonctionRole(this.prisma),
      choix: { roles: ROLES_ANCIEN_TITULAIRE.map((r) => ({ role: r, libelle: ROLE_LIBELLE[r] })), divisions, cellules },
    };
  }

  private async charger(id: string) {
    const c = await this.prisma.changementRoleNomination.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Nomination introuvable.');
    if (c.statut !== StatutChangementRole.EN_ATTENTE) throw new ConflictException('Cette nomination a déjà été traitée (droits appliqués ou refusés).');
    return c;
  }

  async confirmer(actor: AuthenticatedUser, id: string, dto: ConfirmerNominationDto) {
    this.exigerAdmin(actor);
    const c = await this.charger(id);
    const unite = { divisionId: c.divisionId, sectionId: c.sectionId, celluleId: c.celluleId };
    const cible = await this.prisma.user.findUnique({ where: { id: c.userId }, select: { id: true, firstName: true, lastName: true, role: true, status: true, divisionId: true, sectionId: true, celluleId: true } });
    if (!cible || cible.status !== UserStatus.ACTIF) throw new ConflictException('Le compte nommé n’est plus actif : refusez la nomination avec un motif.');
    const motif = `Acte de nomination n° ${c.acteNumero}${dto.note?.trim() ? ` — ${dto.note.trim()}` : ''}`;

    const titulaire = await titulaireDuPoste(this.prisma, c.roleCible, unite, c.userId);
    const p = titulaire ? (dto.ancienTitulaire ?? propositionPourAncienTitulaire(c.roleCible, unite)) : null;
    if (titulaire && !p) {
      throw new BadRequestException(`Choisissez le nouveau rôle de ${nom(titulaire)} (${ROLE_LIBELLE[titulaire.role]}) : aucun rôle n’est proposé d’office pour la Direction.`);
    }
    if (p && !ROLES_ANCIEN_TITULAIRE.includes(p.role)) throw new BadRequestException('Rôle de l’actuel titulaire : Chargé d’Études, un poste de responsabilité, DRH ou administrateur.');
    // L'ancien titulaire : l'intitulé de sa fonction suit son nouveau rôle et son unité (même transaction),
    // inscrit à son historique de carrière « suite à l'acte n° … », sans acte supplémentaire du DRH.
    const uniteAncien = p ? { divisionId: p.divisionId ?? null, sectionId: p.sectionId ?? null, celluleId: p.celluleId ?? null } : null;
    const fonctionAncien = titulaire && p ? await fonctionPourRole(this.prisma, p.role, uniteAncien!) : null;
    const dossierAncien = titulaire ? await this.prisma.user.findUnique({ where: { id: titulaire.id }, select: { jobTitle: true, agentId: true, agent: { select: { fonction: true } } } }) : null;
    const deja = cible.role === c.roleCible && cible.divisionId === unite.divisionId && cible.sectionId === unite.sectionId && cible.celluleId === unite.celluleId;
    const demandes = [
      // 1. L'actuel titulaire quitte le poste, 2. le nommé le prend (rien à faire s'il l'a déjà).
      ...(titulaire && p
        ? [
            {
              userId: titulaire.id,
              dto: { role: p.role, roleAttendu: titulaire.role, ...uniteAncien!, motif: `${motif} (poste confié à ${nom(cible)})` },
              historique: {
                avant: dossierAncien?.agent?.fonction ?? dossierAncien?.jobTitle ?? ROLE_LIBELLE[titulaire.role],
                apres: `${fonctionAncien} (suite à l’acte n° ${c.acteNumero})`,
              },
            },
          ]
        : []),
      ...(deja ? [] : [{ userId: cible.id, dto: { role: c.roleCible, roleAttendu: cible.role, ...unite, motif } }]),
    ];
    try {
      // Tout ou rien : les deux changements de rôle, l'état de la nomination et sa trace, dans une transaction.
      await this.roles.changerEnsemble(actor, demandes, {
        dansTransaction: async (tx) => {
          const n = await tx.changementRoleNomination.updateMany({
            where: { id, statut: StatutChangementRole.EN_ATTENTE },
            data: { statut: StatutChangementRole.APPLIQUE, decideParId: actor.id, decideLe: new Date(), erreur: null, ancienTitulaireId: titulaire?.id ?? c.ancienTitulaireId, roleAncienTitulaire: p?.role ?? c.roleAncienTitulaire },
          });
          if (!n.count) throw new ConflictException('Cette nomination vient d’être traitée : rechargez.');
          if (titulaire && fonctionAncien) {
            await tx.user.update({ where: { id: titulaire.id }, data: { jobTitle: fonctionAncien } });
            if (dossierAncien?.agentId) await tx.agent.update({ where: { id: dossierAncien.agentId }, data: { fonction: fonctionAncien } });
          }
          await this.audit.log(
            {
              actorId: actor.id,
              action: AuditAction.VALIDATION,
              entityType: 'ChangementRoleNomination',
              entityId: id,
              metadata: { event: 'confirmation', acteNumero: c.acteNumero, userId: c.userId, role: c.roleCible, ...unite, ancienTitulaire: titulaire ? { id: titulaire.id, role: p!.role, ...uniteAncien!, fonction: fonctionAncien } : null },
            },
            tx,
          );
        },
      });
    } catch (e) {
      // Échec (poste repris entre-temps, assistant à réaffecter…) : rien n'est appliqué, la nomination
      // reste en attente, avec la raison.
      if (e instanceof HttpException) {
        const r = e.getResponse();
        const raison = typeof r === 'object' && r && 'message' in r ? String((r as { message: unknown }).message) : e.message;
        await this.prisma.changementRoleNomination.updateMany({ where: { id, statut: StatutChangementRole.EN_ATTENTE }, data: { erreur: raison.slice(0, 1000) } });
      }
      throw e;
    }
    await this.informerDrh(c.userId, `Droits appliqués — acte n° ${c.acteNumero}`, `${nom(cible)} a désormais le rôle ${ROLE_LIBELLE[c.roleCible]}${titulaire ? ` ; ${nom(titulaire)} devient ${ROLE_LIBELLE[p!.role]}` : ''}.`);
    return { id, statut: StatutChangementRole.APPLIQUE };
  }

  async refuser(actor: AuthenticatedUser, id: string, dto: RefuserNominationDto) {
    this.exigerAdmin(actor);
    const c = await this.charger(id);
    const motif = dto.motif.trim();
    if (motif.length < 5) throw new BadRequestException('Un motif d’au moins 5 caractères est obligatoire.');
    const n = await this.prisma.changementRoleNomination.updateMany({
      where: { id, statut: StatutChangementRole.EN_ATTENTE },
      data: { statut: StatutChangementRole.REFUSE, motifRefus: motif, decideParId: actor.id, decideLe: new Date() },
    });
    if (!n.count) throw new ConflictException('Cette nomination vient d’être traitée : rechargez.');
    await this.audit.log({ actorId: actor.id, action: AuditAction.REJET, entityType: 'ChangementRoleNomination', entityId: id, metadata: { event: 'refus', acteNumero: c.acteNumero, userId: c.userId, role: c.roleCible, motif } });
    const cible = await this.prisma.user.findUnique({ where: { id: c.userId }, select: { firstName: true, lastName: true } });
    await this.informerDrh(c.userId, `Droits refusés — acte n° ${c.acteNumero}`, `L’administrateur n’a pas appliqué le rôle ${ROLE_LIBELLE[c.roleCible]} à ${cible ? nom(cible) : 'l’agent'} : ${motif}`);
    return { id, statut: StatutChangementRole.REFUSE };
  }

  private async informerDrh(userId: string, titre: string, corps: string) {
    try {
      const drh = await this.prisma.user.findMany({ where: detenteursWhere(RoleFonctionnel.DRH), select: { id: true } });
      await this.notifications.notifyMany(drh.map((d) => d.id), NotificationType.ROLE_MODIFIE, titre, corps, `/rh?onglet=carriere&userId=${userId}`, undefined, { libelleBouton: 'Voir le mouvement' });
    } catch (e) {
      this.logger.error(`Notification du DRH (${titre}) : ${(e as Error).message}`);
    }
  }

  // ------------------------------------------------------------------ écarts quotidiens

  @Cron('40 6 * * *')
  async quotidien(): Promise<void> {
    await this.taches.suivre('ecarts-fonction-role', () => this.signalerEcarts()).catch((e) => this.logger.error(`Écarts fonction / rôle : ${e instanceof Error ? e.message : e}`));
  }

  /** Tous les jours : les administrateurs reçoivent la liste des écarts fonction du dossier / rôle du compte. */
  async signalerEcarts(): Promise<{ ecarts: number }> {
    const ecarts = await ecartsFonctionRole(this.prisma);
    if (ecarts.length) {
      const admins = await this.prisma.user.findMany({ where: { role: SystemRole.ADMIN_SYSTEME, status: UserStatus.ACTIF }, select: { id: true } });
      const premiers = ecarts.slice(0, 5).map((e) => `${e.nom} (${ROLE_LIBELLE[e.role]}${e.fonction ? `, fonction « ${e.fonction} »` : ''})`).join(' ; ');
      await this.notifications.notifyMany(
        admins.map((a) => a.id),
        NotificationType.ROLE_MODIFIE,
        `Fonction et rôle : ${ecarts.length} écart(s) à traiter`,
        `${premiers}${ecarts.length > 5 ? ` ; et ${ecarts.length - 5} autre(s)` : ''}.`,
        LIEN_NOMINATIONS,
        undefined,
        { libelleBouton: 'Voir les écarts' },
      );
    }
    return { ecarts: ecarts.length };
  }
}
