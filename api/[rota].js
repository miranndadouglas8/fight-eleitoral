// Vercel: uma função só atende /api/estado, /api/eventos, /api/simular, /api/zerar e /api/webhook.
// O estado fica no Upstash Redis (Vercel → Storage → Upstash, plano grátis); as variáveis
// KV_REST_API_URL/KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN) entram sozinhas.
// TOKEN_ADMIN (senha do Painel do Pix) e TOKEN_WEBHOOK são definidos em Settings → Environment Variables.

const { montarConfig } = require('../lib/nucleo');
const { criarArmazemRedis } = require('../lib/armazens');
const { tratar } = require('../lib/servico');
const configJson = require('../config.json');

const cfg = montarConfig(configJson);
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const store = url && token ? criarArmazemRedis(url, token) : null;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!store) {
    return res.status(503).json({ ok: false, erro: 'Banco não configurado: na Vercel, abra Storage e conecte um Upstash Redis (grátis) a este projeto.' });
  }
  let corpo = req.body;
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch { corpo = {}; } }
  const { rota, ...query } = req.query;
  const r = await tratar({ metodo: req.method, rota: `/api/${rota}`, query, corpo, headers: req.headers }, { store, cfg });
  res.status(r.status).json(r.json);
};
