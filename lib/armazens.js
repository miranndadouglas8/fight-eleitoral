// Onde o estado do jogo fica guardado.
//  - memória (+ arquivo dados/estado.json): servidor rodando no PC
//  - Upstash Redis (API REST, plano grátis): Vercel, onde cada pedido roda numa função separada
// Os dois têm a mesma cara: cabecalho(), ler(), gravar(versao, estado, eventos), eventosDepois(desde, seq).
// gravar() só aceita se ninguém gravou no meio do caminho (versão igual) e devolve o número do último evento.

const fs = require('fs');
const path = require('path');

const MAX_EVENTOS = 60;

function criarArmazemMemoria(arquivo) {
  let estado = null, versao = 0, seq = 0, eventos = [], timer = null;
  try { const d = JSON.parse(fs.readFileSync(arquivo, 'utf8')); estado = d.estado || null; seq = d.seq || 0; } catch {}
  const salvar = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { fs.mkdirSync(path.dirname(arquivo), { recursive: true }); fs.writeFileSync(arquivo, JSON.stringify({ estado, seq })); }
      catch (e) { console.warn('Não consegui salvar o estado:', e.message); }
    }, 300);
  };
  return {
    async cabecalho() { return { seq, fim: estado?.rodada?.fim || 0 }; },
    async ler() { return { estado: estado && JSON.parse(JSON.stringify(estado)), versao }; },
    async gravar(v, novo, evts) {
      if (v !== versao) return null;
      estado = novo; versao++;
      for (const e of evts) eventos.unshift({ id: ++seq, ...e });
      eventos.length = Math.min(eventos.length, MAX_EVENTOS);
      salvar();
      return seq;
    },
    async eventosDepois(desde) { return eventos.filter(e => e.id > desde).reverse(); },
  };
}

// grava estado + versão + fim do round e enfileira os eventos de uma vez só (atômico no Redis)
const LUA_GRAVAR = `
local atual = redis.call('GET', KEYS[2]) or '0'
if atual ~= ARGV[1] then return -1 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], tostring(tonumber(atual) + 1))
redis.call('SET', KEYS[3], ARGV[3])
local n = tonumber(ARGV[4])
for i = 1, n do
  local id = redis.call('INCR', KEYS[4])
  redis.call('LPUSH', KEYS[5], '{"id":' .. id .. ',' .. string.sub(ARGV[4 + i], 2))
end
redis.call('LTRIM', KEYS[5], 0, ${MAX_EVENTOS - 1})
return tonumber(redis.call('GET', KEYS[4]) or '0')
`;

function criarArmazemRedis(url, token, prefixo = 'fight') {
  const K = { estado: `${prefixo}:estado`, versao: `${prefixo}:versao`, fim: `${prefixo}:fim`, seq: `${prefixo}:seq`, eventos: `${prefixo}:eventos` };
  const cmd = async (...args) => {
    const r = await fetch(url.replace(/\/$/, ''), { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(args.map(String)) });
    const j = await r.json().catch(() => ({ error: `resposta inválida (${r.status})` }));
    if (j.error) throw new Error('Upstash: ' + j.error);
    return j.result;
  };
  return {
    async cabecalho() { const [seq, fim] = await cmd('MGET', K.seq, K.fim); return { seq: Number(seq || 0), fim: Number(fim || 0) }; },
    async ler() { const [e, v] = await cmd('MGET', K.estado, K.versao); return { estado: e ? JSON.parse(e) : null, versao: v || '0' }; },
    async gravar(v, estado, evts) {
      const r = await cmd('EVAL', LUA_GRAVAR, 5, K.estado, K.versao, K.fim, K.seq, K.eventos,
        v, JSON.stringify(estado), estado.rodada.fim, evts.length, ...evts.map(e => JSON.stringify(e)));
      return Number(r) < 0 ? null : Number(r);
    },
    async eventosDepois(desde, seq) {
      const n = Math.min(MAX_EVENTOS, seq - desde);
      if (n <= 0) return [];
      const lista = await cmd('LRANGE', K.eventos, 0, n - 1);
      return lista.map(s => JSON.parse(s)).filter(e => e.id > desde).reverse();
    },
  };
}

module.exports = { criarArmazemMemoria, criarArmazemRedis, MAX_EVENTOS };
