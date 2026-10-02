import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActeStatut, AuditAction, EtatBien, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { GestionnairesLogistiqueService } from './gestionnaires.service';
import { AffecterVehiculeDto, ModifierVehiculeDto, PleinDto, RetourMissionDto, VehiculeDto } from './dto/vehicules.dto';

const J = 864e5;
const jour = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00.000Z`);
const VEHICULE = { id: true, immatriculation: true, marque: true, modele: true, energie: true, kilometrage: true, etat: true, actif: true } satisfies Prisma.VehiculeSelect;

/**
 * Véhicules de service, missions et carburant (socle N6, SIG-RF-LOG-03).
 * - Parc tenu par les gestionnaires logistiques ; lu par tous (rien de personnel).
 * - Un véhicule en service est affecté à un ordre de mission par la logistique, jamais à deux missions
 *   qui se chevauchent (409) ; kilométrage au départ et au retour (retour ≥ départ, contrôlé en base).
 * - Pleins de carburant : le kilométrage du compteur ne recule jamais (409) ; consommation calculée
 *   en litres aux 100 km entre le premier et le dernier plein.
 */
@Injectable()
export class VehiculesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly gestionnaires: GestionnairesLogistiqueService,
  ) {}

  async liste(actor: AuthenticatedUser) {
    const gerer = await this.gestionnaires.estGestionnaire(actor);
    const vehicules = await this.prisma.vehicule.findMany({ where: gerer ? {} : { actif: true }, select: VEHICULE, orderBy: { immatriculation: 'asc' } });
    const aujourdhui = jour(new Date().toISOString());
    const missions = gerer
      ? await this.prisma.ordreMission.findMany({
          where: { dateRetour: { gte: new Date(aujourdhui.getTime() - 30 * J) }, OR: [{ acteId: null }, { acte: { statut: { not: ActeStatut.ANNULE } } }] },
          select: { id: true, objet: true, destination: true, dateDepart: true, dateRetour: true, transport: true, vehiculeId: true, kilometrageDepart: true, kilometrageRetour: true, agent: { select: { firstName: true, lastName: true } } },
          orderBy: { dateDepart: 'asc' },
        })
      : [];
    return { vehicules, missions, droits: { gerer } };
  }

  async detail(actor: AuthenticatedUser, id: string) {
    const v = await this.prisma.vehicule.findUnique({
      where: { id },
      select: {
        ...VEHICULE,
        pleins: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], select: { id: true, date: true, litres: true, montant: true, kilometrage: true, ordreMissionId: true } },
        missions: { orderBy: { dateDepart: 'desc' }, take: 20, select: { id: true, objet: true, destination: true, dateDepart: true, dateRetour: true, kilometrageDepart: true, kilometrageRetour: true, agent: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!v || (!v.actif && !(await this.gestionnaires.estGestionnaire(actor)))) throw new NotFoundException('Véhicule introuvable.');
    const pleins = [...v.pleins].sort((a, b) => a.kilometrage - b.kilometrage);
    let consommation: number | null = null;
    if (pleins.length >= 2) {
      const distance = pleins[pleins.length - 1]!.kilometrage - pleins[0]!.kilometrage;
      const litres = pleins.slice(1).reduce((s, p) => s + Number(p.litres), 0);
      if (distance > 0) consommation = Math.round((litres / distance) * 1000) / 10;
    }
    const montantTotal = v.pleins.reduce((s, p) => s + p.montant, 0);
    const litresTotal = Math.round(v.pleins.reduce((s, p) => s + Number(p.litres), 0) * 100) / 100;
    return { ...v, pleins: v.pleins.map((p) => ({ ...p, litres: Number(p.litres) })), consommationL100: consommation, montantTotal, litresTotal, droits: { gerer: await this.gestionnaires.estGestionnaire(actor) } };
  }

  async creer(actor: AuthenticatedUser, dto: VehiculeDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    try {
      const v = await this.prisma.vehicule.create({ data: { immatriculation: dto.immatriculation.trim(), marque: dto.marque.trim(), modele: dto.modele.trim(), energie: dto.energie, kilometrage: dto.kilometrage }, select: VEHICULE });
      await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'Vehicule', entityId: v.id, metadata: { immatriculation: v.immatriculation } });
      return v;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Un véhicule porte déjà cette immatriculation.');
      throw e;
    }
  }

  async modifier(actor: AuthenticatedUser, id: string, dto: ModifierVehiculeDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    if (!(await this.prisma.vehicule.findUnique({ where: { id } }))) throw new NotFoundException('Véhicule introuvable.');
    const v = await this.prisma.vehicule.update({ where: { id }, data: { marque: dto.marque?.trim(), modele: dto.modele?.trim(), energie: dto.energie, etat: dto.etat, actif: dto.actif }, select: VEHICULE });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Vehicule', entityId: id, metadata: { ...dto } });
    return v;
  }

  async ajouterPlein(actor: AuthenticatedUser, id: string, dto: PleinDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    if (jour(dto.date) > new Date()) throw new BadRequestException('La date du plein ne peut pas être dans le futur.');
    if (dto.ordreMissionId) {
      const o = await this.prisma.ordreMission.findUnique({ where: { id: dto.ordreMissionId }, select: { vehiculeId: true } });
      if (!o || o.vehiculeId !== id) throw new BadRequestException('Cet ordre de mission n’utilise pas ce véhicule.');
    }
    const plein = await this.prisma.$transaction(async (tx) => {
      // Verrou sur le véhicule : deux pleins simultanés ne font pas reculer le compteur.
      const [v] = await tx.$queryRaw<{ kilometrage: number; actif: boolean }[]>`SELECT "kilometrage", "actif" FROM "vehicules" WHERE "id" = ${id} FOR UPDATE`;
      if (!v || !v.actif) throw new NotFoundException('Véhicule introuvable ou retiré du parc.');
      if (dto.kilometrage < v.kilometrage) throw new ConflictException(`Le compteur ne recule pas : ${v.kilometrage} km déjà enregistrés pour ce véhicule.`);
      const p = await tx.pleinCarburant.create({ data: { vehiculeId: id, date: jour(dto.date), litres: new Prisma.Decimal(dto.litres), montant: dto.montant, kilometrage: dto.kilometrage, ordreMissionId: dto.ordreMissionId ?? null, saisiParId: actor.id } });
      await tx.vehicule.update({ where: { id }, data: { kilometrage: dto.kilometrage } });
      return p;
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'PleinCarburant', entityId: plein.id, metadata: { vehiculeId: id, litres: dto.litres, montant: dto.montant, kilometrage: dto.kilometrage } });
    return { ...plein, litres: Number(plein.litres) };
  }

  /** Affecte (ou retire) un véhicule à un ordre de mission. */
  async affecter(actor: AuthenticatedUser, ordreId: string, dto: AffecterVehiculeDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    const o = await this.prisma.ordreMission.findUnique({ where: { id: ordreId }, select: { id: true, dateDepart: true, dateRetour: true, kilometrageRetour: true, acte: { select: { statut: true } } } });
    if (!o) throw new NotFoundException('Ordre de mission introuvable.');
    if (o.acte?.statut === ActeStatut.ANNULE) throw new ConflictException('Cet ordre de mission est annulé.');
    if (o.kilometrageRetour !== null) throw new ConflictException('Le retour de cette mission est déjà enregistré.');
    if (!dto.vehiculeId) {
      await this.prisma.ordreMission.update({ where: { id: ordreId }, data: { vehiculeId: null, kilometrageDepart: null } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'OrdreMission', entityId: ordreId, metadata: { event: 'vehicule_retire' } });
      return { ok: true };
    }
    const v = await this.prisma.vehicule.findUnique({ where: { id: dto.vehiculeId } });
    if (!v || !v.actif) throw new NotFoundException('Véhicule introuvable ou retiré du parc.');
    if (v.etat !== EtatBien.EN_SERVICE) throw new ConflictException('Ce véhicule n’est pas en service (panne, réparation ou réforme).');
    const chevauchement = await this.prisma.ordreMission.findFirst({
      where: { id: { not: ordreId }, vehiculeId: v.id, kilometrageRetour: null, dateDepart: { lte: o.dateRetour }, dateRetour: { gte: o.dateDepart }, OR: [{ acteId: null }, { acte: { statut: { not: ActeStatut.ANNULE } } }] },
      select: { objet: true, dateDepart: true, dateRetour: true },
    });
    if (chevauchement) throw new ConflictException(`Ce véhicule est déjà affecté à la mission « ${chevauchement.objet} » sur ces dates.`);
    const depart = dto.kilometrageDepart ?? v.kilometrage;
    if (depart < v.kilometrage) throw new ConflictException(`Le compteur ne recule pas : ${v.kilometrage} km déjà enregistrés pour ce véhicule.`);
    await this.prisma.ordreMission.update({ where: { id: ordreId }, data: { vehiculeId: v.id, kilometrageDepart: depart } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'OrdreMission', entityId: ordreId, metadata: { event: 'vehicule_affecte', vehiculeId: v.id, kilometrageDepart: depart } });
    return { ok: true };
  }

  async retour(actor: AuthenticatedUser, ordreId: string, dto: RetourMissionDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    const o = await this.prisma.ordreMission.findUnique({ where: { id: ordreId }, select: { vehiculeId: true, kilometrageDepart: true, kilometrageRetour: true } });
    if (!o) throw new NotFoundException('Ordre de mission introuvable.');
    if (!o.vehiculeId || o.kilometrageDepart === null) throw new ConflictException('Aucun véhicule n’est affecté à cette mission.');
    if (o.kilometrageRetour !== null) throw new ConflictException('Le retour de cette mission est déjà enregistré.');
    if (dto.kilometrageRetour < o.kilometrageDepart) throw new BadRequestException(`Le kilométrage au retour ne peut pas être inférieur à celui du départ (${o.kilometrageDepart} km).`);
    await this.prisma.$transaction(async (tx) => {
      await tx.ordreMission.update({ where: { id: ordreId }, data: { kilometrageRetour: dto.kilometrageRetour } });
      await tx.vehicule.updateMany({ where: { id: o.vehiculeId!, kilometrage: { lt: dto.kilometrageRetour } }, data: { kilometrage: dto.kilometrageRetour } });
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'OrdreMission', entityId: ordreId, metadata: { event: 'retour_mission', kilometrageRetour: dto.kilometrageRetour, distance: dto.kilometrageRetour - o.kilometrageDepart } });
    return { ok: true, distance: dto.kilometrageRetour - o.kilometrageDepart };
  }
}
