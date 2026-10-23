// Fight Eleitoral — servidor para rodar no próprio PC (Node 18+, sem dependências).
// Na Vercel quem responde é a função api/[rota].js; as regras são as mesmas (lib/).
//
// Rodar:  node server.js        (ou dê dois cliques em iniciar.bat)

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { montarConfig } = require('./lib/nucleo');
const { criarArmazemMemoria } = require('./lib/armazens');
const { tratar, transacao } = require('./lib/servico');

const RAIZ = __dirname;
const PUBLIC = path.join(RAIZ, 'public');
const ARQ_CONFIG = path.join(RAIZ, 'config.json');

// config.json + tokens: na primeira execução gera os tokens e guarda no config.json
function carregarConfig() {
  let lido = {};
  if (fs.existsSync(ARQ_CONFIG)) {
    try { lido = JSON.parse(fs.readFileSync(ARQ_CONFIG, 'utf8')); }
    catch (e) { console.error('config.json inválido:', e.message); process.exit(1); }
  }
  const cfg = montarConfig(lido);
  let mudou = false;
  for (const k of ['tokenWebhook', 'tokenAdmin']) {
    if (!cfg[k] || /^troque/i.test(cfg[k])) { cfg[k] = lido[k] = crypto.randomBytes(12).toString('hex'); mudou = true; }
  }
  if (mudou) {
    try { fs.writeFileSync(ARQ_CONFIG, JSON.stringify(lido, null, 2)); } catch (e) { console.warn('Não consegui salvar o config.json:', e.message); }
  }
  return cfg;
}
const cfg = carregarConfig();
const store = criarArmazemMemoria(path.join(RAIZ, 'dados', 'estado.json'));

// sem ninguém consultando, o round também fecha sozinho (e aparece no terminal)
setInterval(async () => {
  const { fim } = await store.cabecalho();
  if (fim && Date.now() >= fim) {
    const { eventos } = await transacao(store, cfg);
    for (const e of eventos) if (e.tipo === 'fimRound' && e.resultado.vencedor) {
      const r = e.resultado, v = e.vitorias;
      console.log(`Fim do round ${r.numero}: ${r.vencedor === 'empate' ? 'EMPATE' : cfg.times[r.vencedor].nome + ' venceu'} (${r.golpes.vermelho} × ${r.golpes.amarelo} golpes) — vitórias ${v.vermelho} × ${v.amarelo}`);
    }
  }
}, 500);

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.webp': 'image/webp' };

function lerCorpo(req, limite = 1e6) {
  return new Promise((ok, erro) => {
    let dados = '';
    req.on('data', c => { dados += c; if (dados.length > limite) { erro(new Error('corpo grande demais')); req.destroy(); } });
    req.on('end', () => ok(dados));
    req.on('error', erro);
  });
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rota = url.pathname;
  try {
    if (rota.startsWith('/api/') || rota.startsWith('/webhook')) {
      let corpo = {};
      if (req.method === 'POST') {
        const texto = await lerCorpo(req);
        try { corpo = texto ? JSON.parse(texto) : {}; } catch { corpo = {}; }
      }
      const r = await tratar({ metodo: req.method, rota, query: Object.fromEntries(url.searchParams), corpo, headers: req.headers }, { store, cfg });
      res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(r.json));
    }
    // arquivos do jogo
    const nomeArq = rota === '/' ? '/index.html' : rota === '/painel' ? '/painel.html' : rota;
    const arquivo = path.normalize(path.join(PUBLIC, decodeURIComponent(nomeArq)));
    if (!arquivo.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(arquivo, (erro, dados) => {
      if (erro) { res.writeHead(404); return res.end('não encontrado'); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(dados);
    });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.writeHead(500); res.end(); }
  }
});

servidor.listen(cfg.porta, () => {
  const nuvem = (process.env.URL_PUBLICA || '').replace(/\/$/, '');
  const base = nuvem || `http://localhost:${cfg.porta}`;
  const ips = nuvem ? [] : Object.values(os.networkInterfaces()).flat()
    .filter(i => i && (i.family === 'IPv4' || i.family === 4) && !i.internal).map(i => i.address);
  console.log('\n  FIGHT ELEITORAL rodando!\n');
  console.log(`  Jogo (OBS / navegador):   ${base}/?limpo`);
  console.log(`  Painel do Pix (operador): ${base}/painel?token=${cfg.tokenAdmin}`);
  for (const ip of ips) console.log(`     no celular, mesmo Wi-Fi: http://${ip}:${cfg.porta}/painel?token=${cfg.tokenAdmin}`);
  console.log(`  Webhook (banco com API):  ${nuvem || 'https://SEU-ENDERECO-PUBLICO'}/webhook/pix?token=${cfg.tokenWebhook}`);
  console.log(`  Pix de valor aberto: R$ ${cfg.reaisPorSoco} = 1 soco · especiais a partir de R$ ${cfg.niveis.join(' / ')} · round de ${cfg.duracaoRound} s`);
  console.log('');
});
