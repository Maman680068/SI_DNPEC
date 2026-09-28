// K — accueil public compact (maquette validée par la Direction) : sur 4 écrans d'ordinateur,
// aucune barre de défilement, tout le contenu entièrement visible, rien ne se chevauche ni
// n'est coupé, blocs répartis régulièrement, pied de page sur une ligne ; téléphone (390px) et
// tablette (768px) : défilement autorisé, cartes sur 1 puis 2 colonnes, pied de page empilé.
const { browser, check, bilan, WEB } = require('./helpers');
const E = require('../config');

const ORDINATEURS = [[1366, 768], [1440, 900], [1536, 864], [1920, 1080]];
const TEXTES = [
  'RÉPUBLIQUE DE GUINÉE', 'DNPEC · Système Interne', 'Se connecter →', 'La coordination de la Direction,', 'en un seul endroit.',
  'Le système d’information interne de la DNPEC réunit la gestion des tâches', 'Modules', 'Tâches', 'Communication', 'Congés',
  'Archives', 'Annuaire', 'Suivi de bout en bout, avec validation hiérarchique.', 'Tout le personnel, relié à l’organigramme.',
  'Cellule des Systèmes d’Informations et de la Digitalisation — CSID', '« Ce qui se conçoit bien s’énonce clairement — et se suit encore mieux. »',
];

/** Mesures prises dans la page : boîtes des blocs, débordements de texte, défilement. */
function mesurer() {
  const boite = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right }; };
  const q = (s) => document.querySelector(s);
  const main = q('[data-testid=accueil-centre]');
  const blocs = [...main.children].map(boite);
  const elements = [q('header'), q('h1'), q('h1 + p'), ...main.children, ...document.querySelectorAll('[data-testid=accueil-module]'), q('footer'), ...q('footer').children];
  return {
    scrollH: document.documentElement.scrollHeight, scrollW: document.documentElement.scrollWidth, innerH: innerHeight, innerW: innerWidth,
    main: boite(main), blocs,
    cartes: [...document.querySelectorAll('[data-testid=accueil-module]')].map(boite),
    boutons: [...document.querySelectorAll('main a')].map(boite),
    footer: boite(q('footer')), csid: boite(q('footer').children[0]), citation: boite(q('footer').children[1]),
    // Texte coupé : contenu plus grand que sa boîte.
    coupes: elements.filter((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.slice(0, 40)),
    policeTitre: parseFloat(getComputedStyle(q('h1')).fontSize), lignesTitre: Math.round(q('h1').getBoundingClientRect().height / parseFloat(getComputedStyle(q('h1')).lineHeight)),
  };
}
const dedans = (bx, m) => bx.x >= 0 && bx.y >= 0 && bx.r <= m.innerW + 0.5 && bx.b <= m.innerH + 0.5;
const chevauche = (a, b) => a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;
/** Texte de la page comparable aux libellés attendus : espaces réduits, apostrophes unifiées, casse ignorée (« MODULES » en capitales par le CSS). */
const normaliser = (t) => t.replace(/\s+/g, ' ').replace(/[’']/g, "'").toLowerCase();
const absents = (texte) => TEXTES.filter((t) => !normaliser(texte).includes(normaliser(t)));
const colonnes = (cartes) => new Set(cartes.map((c) => Math.round(c.x))).size;

(async () => {
  const b = await browser();
  for (const [w, h] of ORDINATEURS) {
    console.log(`— Ordinateur ${w}×${h}`);
    const p = await (await b.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR' })).newPage();
    await p.goto(`${WEB}/`);
    await p.getByRole('heading', { name: /La coordination de la Direction/ }).waitFor();
    await p.evaluate(() => document.fonts.ready);
    const texte = await p.locator('body').innerText();
    const manquants = absents(texte);
    check('tout le contenu est présent', manquants.length === 0, manquants.join(' | '));
    const m = await p.evaluate(mesurer);
    check(`aucun défilement : scrollHeight ${m.scrollH} ≤ innerHeight ${m.innerH}`, m.scrollH <= m.innerH);
    check('aucun défilement horizontal', m.scrollW <= m.innerW);
    check('les 5 cartes entièrement visibles, sur une ligne', m.cartes.length === 5 && m.cartes.every((c) => dedans(c, m)) && colonnes(m.cartes) === 5 && new Set(m.cartes.map((c) => Math.round(c.y))).size === 1);
    check('les 2 boutons entièrement visibles (+ « Se connecter → » de l’en-tête)', m.boutons.length === 2 && m.boutons.every((x) => dedans(x, m)) && dedans(await p.getByRole('link', { name: 'Se connecter →' }).evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom }; }), m));
    check('pied de page entièrement visible, collé en bas', dedans(m.footer, m) && Math.abs(m.footer.b - m.innerH) <= 1);
    check('pied de page sur une ligne : CSID à gauche, citation à droite', Math.abs((m.csid.y + m.csid.h / 2) - (m.citation.y + m.citation.h / 2)) <= 2 && m.csid.r < m.citation.x);
    const paires = [];
    for (let i = 0; i < m.blocs.length; i++) for (let j = i + 1; j < m.blocs.length; j++) if (chevauche(m.blocs[i], m.blocs[j])) paires.push(`${i}/${j}`);
    for (let i = 0; i < m.cartes.length - 1; i++) if (chevauche(m.cartes[i], m.cartes[i + 1])) paires.push(`carte ${i}`);
    check('aucun chevauchement (titre, boutons, modules, cartes)', paires.length === 0, paires.join(' '));
    check('aucun texte coupé', m.coupes.length === 0, m.coupes.join(' | '));
    const espaces = [m.blocs[0].y - m.main.y, ...m.blocs.slice(1).map((x, i) => x.y - m.blocs[i].b), m.main.b - m.blocs[m.blocs.length - 1].b];
    check(`blocs répartis régulièrement (espaces ${espaces.map((e) => Math.round(e)).join(' / ')} px)`, Math.max(...espaces) - Math.min(...espaces) <= 2 && Math.min(...espaces) > 0);
    check(`titre sur 2 lignes (${m.policeTitre.toFixed(1)} px)`, m.lignesTitre === 2 && (w === 1920 ? Math.abs(m.policeTitre - 66) < 0.5 : m.policeTitre > 40));
    await p.screenshot({ path: `${E.SHOTS}/k_accueil_${w}x${h}.png` });
    await p.context().close();
  }

  for (const [w, h, nom, attendues] of [[390, 844, 'téléphone', 1], [768, 1024, 'tablette', 2]]) {
    console.log(`— ${nom} ${w}px`);
    const p = await (await b.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', isMobile: w < 500, hasTouch: w < 500 })).newPage();
    await p.goto(`${WEB}/`);
    await p.getByRole('heading', { name: /La coordination de la Direction/ }).waitFor();
    await p.evaluate(() => document.fonts.ready);
    const texte = await p.locator('body').innerText();
    check(`${nom} : tout le contenu est présent`, absents(texte).length === 0, absents(texte).join(' | '));
    const m = await p.evaluate(mesurer);
    check(`${nom} : aucun défilement horizontal (${m.scrollW} ≤ ${m.innerW})`, m.scrollW <= m.innerW);
    check(`${nom} : cartes sur ${attendues} colonne(s)`, colonnes(m.cartes) === attendues);
    check(`${nom} : pied de page empilé, citation au-dessus de la mention CSID`, m.citation.b <= m.csid.y);
    check(`${nom} : aucun texte coupé`, m.coupes.length === 0, m.coupes.join(' | '));
    await p.screenshot({ path: `${E.SHOTS}/k_accueil_${w}.png`, fullPage: true });
    await p.context().close();
  }

  await b.close(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
