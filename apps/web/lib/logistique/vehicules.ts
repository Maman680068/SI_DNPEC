// Véhicules de service et carburant (socle N6) — miroir de api/v1/vehicules.
export type EtatVehicule = 'EN_SERVICE' | 'EN_PANNE' | 'EN_REPARATION' | 'REFORME';
export const LIBELLE_ETAT_VEHICULE: Record<EtatVehicule, string> = {
  EN_SERVICE: 'En service',
  EN_PANNE: 'En panne',
  EN_REPARATION: 'En réparation',
  REFORME: 'Réformé',
};
export interface Vehicule {
  id: string;
  immatriculation: string;
  marque: string;
  modele: string;
  energie: 'ESSENCE' | 'GAZOLE';
  kilometrage: number;
  etat: EtatVehicule;
  actif: boolean;
}
export interface MissionVehicule {
  id: string;
  objet: string;
  destination: string;
  dateDepart: string;
  dateRetour: string;
  transport: string | null;
  vehiculeId: string | null;
  kilometrageDepart: number | null;
  kilometrageRetour: number | null;
  agent: { firstName: string; lastName: string };
}
export interface ParcVehicules {
  vehicules: Vehicule[];
  missions: MissionVehicule[];
  droits: { gerer: boolean };
}
export interface Plein {
  id: string;
  date: string;
  litres: number;
  kilometrage: number;
  ordreMission: { id: string; objet: string } | null;
}
export interface VehiculeDetail extends Vehicule {
  pleins: Plein[];
  missions: Omit<MissionVehicule, 'transport' | 'vehiculeId'>[];
  consommationL100: number | null;
  litresTotal: number;
  droits: { gerer: boolean };
}
