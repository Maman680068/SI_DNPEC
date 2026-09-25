// Horloge JavaScript avancée d'un an (test local du changement d'année ; jamais en production).
const DECALAGE = 365 * 24 * 60 * 60 * 1000;
const Reelle = Date;
class Decalee extends Reelle {
  constructor(...a) { if (a.length === 0) super(Reelle.now() + DECALAGE); else super(...a); }
  static now() { return Reelle.now() + DECALAGE; }
}
global.Date = Decalee;
