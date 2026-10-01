// Horloge JavaScript avancée d'un an (test local du changement d'année ; jamais en production).
const DECALAGE = 365 * 24 * 60 * 60 * 1000;
const Reelle = Date;
class Decalee extends Reelle {
  constructor(...a) { if (a.length === 0) super(Reelle.now() + DECALAGE); else super(...a); }
  static now() { return Reelle.now() + DECALAGE; }
}
global.Date = Decalee;

// Aucune tâche planifiée dans cette instance : avec son horloge avancée, elle traiterait les données
// de l'instance normale (congés réputés favorables, stages terminés…) au milieu des autres suites.
const { createRequire } = require('module');
const depuisApi = createRequire(require.resolve('@nestjs/schedule', { paths: [process.cwd()] }));
depuisApi('cron').CronJob.prototype.start = function () {};
