// Relais de TEST entre l'API et le service de calcul local (lot B1) : il transmet tout tel quel, et
// permet aux suites de simuler le service gratuit qui s'endort ou ne répond plus. Jamais en production.
//   node relais_calcul.js <port d'écoute> <port du service>
//   POST /__relais/mode {"mode":"normal"}                        transmission directe
//   POST /__relais/mode {"mode":"endormi","delaiMs":4000}        le prochain appel attend (réveil), puis normal
//   POST /__relais/mode {"mode":"coupe"}                         connexion coupée (service injoignable)
//   GET  /__relais/appels                                         nombre d'appels transmis par chemin
const http = require('http');

const [ecoute, cible] = [Number(process.argv[2] || 3301), Number(process.argv[3] || 3302)];
let mode = 'normal';
let delaiMs = 0;
const appels = {};

function transmettre(req, res, corps) {
  appels[req.url.split('?')[0]] = (appels[req.url.split('?')[0]] || 0) + 1;
  const amont = http.request({ host: '127.0.0.1', port: cible, method: req.method, path: req.url, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  amont.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('relais : service de calcul arrêté');
  });
  amont.end(corps);
}

http
  .createServer((req, res) => {
    const morceaux = [];
    req.on('data', (c) => morceaux.push(c));
    req.on('end', () => {
      const corps = Buffer.concat(morceaux);
      if (req.url === '/__relais/mode' && req.method === 'POST') {
        const d = JSON.parse(corps.toString() || '{}');
        mode = d.mode || 'normal';
        delaiMs = Number(d.delaiMs || 0);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ mode, delaiMs }));
      }
      if (req.url === '/__relais/appels') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(appels));
      }
      if (mode === 'coupe') return req.socket.destroy();
      if (mode === 'endormi') {
        mode = 'normal';
        return setTimeout(() => transmettre(req, res, corps), delaiMs);
      }
      transmettre(req, res, corps);
    });
  })
  .listen(ecoute, '127.0.0.1', () => console.log(`Relais du service de calcul : ${ecoute} → ${cible}`));
