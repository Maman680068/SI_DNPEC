// Refonte de l'interface (étape 9) — GET api/v1/profil : page « Mon profil ». Chacun ne lit que SON
// profil (aucun paramètre ne permet d'en lire un autre), en intérim comme en nom propre ; aucune
// donnée du niveau 2 du dossier ; téléphone masqué ; complétude = règle de la synthèse du DRH.
// Et « À traiter » de l'administrateur : un élément par point de supervision à traiter, jamais pour
// les autres rôles.
const { call, ids, check, expect, bilan } = require('../lib');
(async () => {
  console.log('— Lecture de son propre profil');
  const r401 = await fetch('http://localhost:3000/api/v1/profil');
  check('sans session : 401', r401.status === 401);
  for (const k of ['agent1', 'chefssr', 'chefdpe', 'dn', 'drh', 'admin', 'assdn']) {
    const r = await call(k, 'GET', '/api/v1/profil');
    const moi = (await call(k, 'GET', '/auth/me')).body;
    const b = r.body;
    check(`${k} : 200, son propre profil (${b.prenom} ${b.nom})`, r.status === 200 && b.email === moi.email && b.prenom === moi.firstName && b.nom === moi.lastName, JSON.stringify(b).slice(0, 160));
    check(`${k} : complétude entre 0 et 100, éléments manquants listés`, Number.isInteger(b.completude.pourcentage) && b.completude.pourcentage >= 0 && b.completude.pourcentage <= 100 && Array.isArray(b.completude.manquants) && (b.completude.pourcentage === 100) === (b.completude.manquants.length === 0));
    const cles = Object.keys(b).sort().join(',');
    check(`${k} : liste fermée des champs (aucun champ du niveau 2, ni mot de passe)`, cles === 'chefDirect,completude,deuxFacteurs,email,fonction,matricule,nom,prenom,role,telephone,unite', cles);
  }
  const ag = (await call('agent1', 'GET', '/api/v1/profil')).body;
  check('agent1 : chef direct = cheffe de section (même règle que l’avis de congé)', !!ag.chefDirect, ag.chefDirect);
  check('téléphone masqué quand il est renseigné', ag.telephone === null || /••/.test(ag.telephone), String(ag.telephone));
  const syn = (await call('drh', 'GET', '/api/v1/rh/dossiers')).body;
  const ligne = syn.lignes.find((l) => l.userId === ids.agent1);
  check('complétude identique à la synthèse des dossiers du DRH', !ligne || ligne.completude === ag.completude.pourcentage, `${ligne?.completude} / ${ag.completude.pourcentage}`);
  console.log('— Intérim : jamais le profil du titulaire');
  const sup = (await call('chefssr', 'GET', '/suppleances/mine')).body;
  const titulaire = Array.isArray(sup) ? sup.find((x) => x.suppleantId === ids.chefssr && !x.revokedAt) : null;
  if (titulaire) {
    const enInterim = (await call('chefssr', 'GET', '/api/v1/profil', undefined, { 'X-Interim-For': titulaire.titulaireId })).body;
    check('en intérim : toujours son propre profil', enInterim.email === (await call('chefssr', 'GET', '/auth/me')).body.email);
  } else console.log('   (pas de suppléance en cours dans le jeu de données : cas non joué)');
  console.log('— « À traiter » de l’administrateur : points de la supervision');
  // Les points sont mis en cache une minute : en cas d'écart (un service a changé d'état entre-temps),
  // une seconde lecture après l'expiration du cache.
  const lire = async () => {
    const nav = (await call('admin', 'GET', '/api/v1/navigation')).body;
    const sup2 = (await call('admin', 'GET', '/api/v1/supervision')).body;
    return [nav.aTraiter.filter((x) => x.cle.startsWith('supervision-')), sup2.services.filter((s) => s.etat !== 'NOMINAL')];
  };
  let [pointsNav, pointsSup] = await lire();
  if (pointsNav.length !== pointsSup.length) {
    await new Promise((r) => setTimeout(r, 61000));
    [pointsNav, pointsSup] = await lire();
  }
  check(`administrateur : un élément par service à traiter (${pointsNav.length} / ${pointsSup.length})`, pointsNav.length === pointsSup.length && pointsNav.every((x) => x.lien === '/parametrage?onglet=supervision' && x.detail && ['DEGRADE', 'INDISPONIBLE'].includes(x.gravite)));
  for (const k of ['agent1', 'chefdpe', 'dn', 'drh']) {
    check(`${k} : aucun point de supervision dans « À traiter »`, !(await call(k, 'GET', '/api/v1/navigation')).body.aTraiter.some((x) => x.cle.startsWith('supervision-')));
    // Droits inchangés : le DN lit la supervision (lot N2), les autres non.
    expect(`${k} : supervision ${k === 'dn' ? 'lisible (200)' : 'fermée (403)'}`, await call(k, 'GET', '/api/v1/supervision'), k === 'dn' ? 200 : 403);
  }
  process.exitCode = bilan() ? 1 : 0;
})();
