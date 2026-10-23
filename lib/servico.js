// Rotas do Fight Eleitoral (as mesmas no PC e na Vercel):
//   GET  /api/estado               tudo que o jogo precisa para começar (+ número do último evento)
//   GET  /api/eventos?desde=N      Pix e fins de round depois do evento N (o jogo consulta a cada ~0,7 s)
//   POST /api/simular?token=ADMIN  Painel do Pix: { lado, valor, nome }
//   POST /api/zerar?token=ADMIN    zera vitórias, rounds e totais
//   POST /webhook/pix?token=WEBHOOK aviso automático do banco/intermediador

const crypto = require('crypto');
const N = require('./nucleo');
const { MAX_EVENTOS } = require('./armazens');

async function transacao(store, cfg, mudar) {
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const { estado: bruto, versao } = await store.ler();
    let estado = N.normalizar(bruto);
    const agora = Date.now();
    let eventos = N.atualizarRounds(cfg, estado, agora);
    let resultado;
    if (mudar) {
      const r = mudar(estado, agora) || {};
      if (r.substituir) { estado = r.substituir; eventos = []; }
      eventos.push(...(r.eventos || []));
      resultado = r.resultado;
    }
    const seq = await store.gravar(versao, estado, eventos);
    if (seq !== null) return { seq, estado, resultado, eventos };
    await new Promise(ok => setTimeout(ok, 25 + Math.random() * 75)); // alguém gravou junto: tenta de novo
  }
  throw new Error('servidor ocupado, tente de novo');
}

async function obterEstado(store, cfg) {
  let { estado } = await store.ler();
  if (!estado || !estado.rodada || Date.now() >= estado.rodada.fim) estado = (await transacao(store, cfg)).estado;
  const { seq } = await store.cabecalho();
  return { ...N.estadoPublico(cfg, N.normalizar(estado), Date.now()), seq };
}

async function eventosDesde(store, cfg, desde) {
  let { seq, fim } = await store.cabecalho();
  if (!fim || Date.now() >= fim) seq = (await transacao(store, cfg)).seq; // fecha o round que acabou
  const resposta = { seq, agora: Date.now(), eventos: [] };
  if (!Number.isFinite(desde) || desde < 0 || desde > seq || seq - desde > MAX_EVENTOS) {
    // perdeu eventos (ou o servidor foi zerado): manda o estado completo de novo
    const { estado } = await store.ler();
    resposta.eventos.push({ id: seq, ...N.estadoPublico(cfg, N.normalizar(estado), resposta.agora) });
  } else if (seq > desde) {
    resposta.eventos = await store.eventosDepois(desde, seq);
  }
  return resposta;
}

function tokenDe(query, headers) {
  const auth = headers.authorization || '';
  return query.token || headers['x-webhook-token'] || (auth.startsWith('Bearer ') ? auth.slice(7) : '');
}
function tokenConfere(recebido, esperado) {
  if (!esperado) return false;
  const a = Buffer.from(String(recebido)), b = Buffer.from(String(esperado));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function lancar(store, cfg, pagamentos, origem) {
  return transacao(store, cfg, estado => {
    const resultados = [], eventos = [];
    for (const pg of pagamentos) {
      const r = N.registrarPagamento(cfg, estado, pg);
      resultados.push(r.resultado); eventos.push(...r.eventos);
      if (r.resultado.ok) console.log(`Pix ${origem}: R$ ${pg.valor.toFixed(2)} → ${cfg.times[pg.lado].nome} (${r.resultado.socos} soco(s)${r.resultado.especial ? ' + ' + r.resultado.especial : ''})`);
      else if (r.resultado.motivo !== 'repetido') console.log('Pix ignorado:', r.resultado.motivo);
    }
    return { resultado: resultados, eventos };
  });
}

// pedido = { metodo, rota, query, corpo (objeto já lido), headers }; devolve { status, json }
async function tratar(pedido, { store, cfg }) {
  const { metodo, rota, query = {}, headers = {} } = pedido;
  const corpo = pedido.corpo && typeof pedido.corpo === 'object' ? pedido.corpo : {};
  try {
    if (rota === '/api/estado') return { status: 200, json: await obterEstado(store, cfg) };
    if (rota === '/api/eventos') return { status: 200, json: await eventosDesde(store, cfg, Number(query.desde)) };

    if (rota.startsWith('/webhook') || rota === '/api/webhook') {
      if (metodo !== 'POST') return { status: 200, json: { ok: true } };
      if (!cfg.tokenWebhook) return { status: 503, json: { ok: false, erro: 'TOKEN_WEBHOOK não configurado' } };
      if (!tokenConfere(tokenDe(query, headers), cfg.tokenWebhook)) return { status: 401, json: { ok: false, erro: 'token inválido' } };
      if (corpo.evento === 'teste_webhook' || corpo.event === 'teste_webhook') return { status: 200, json: { ok: true, teste: true } };
      const pagamentos = N.extrairPagamentos(cfg, corpo);
      if (!pagamentos.length) { console.log('Webhook sem Pix reconhecível:', JSON.stringify(corpo).slice(0, 300)); return { status: 200, json: { ok: true, resultados: [] } }; }
      const t = await lancar(store, cfg, pagamentos, 'webhook');
      return { status: 200, json: { ok: true, resultados: t.resultado } };
    }

    if (rota === '/api/simular' || rota === '/api/zerar') {
      if (!cfg.tokenAdmin) return { status: 503, json: { ok: false, erro: 'TOKEN_ADMIN não configurado' } };
      if (!tokenConfere(tokenDe(query, headers), cfg.tokenAdmin)) return { status: 401, json: { ok: false, erro: 'token inválido' } };
      if (metodo !== 'POST') return { status: 405, json: { ok: false } };
      if (rota === '/api/simular') {
        const pg = { lado: N.ladoPorTexto(cfg, corpo.lado), valor: N.reaisDe(corpo.valor), nome: corpo.nome || '' };
        const t = await lancar(store, cfg, [pg], 'painel');
        return { status: 200, json: t.resultado[0] };
      }
      await transacao(store, cfg, (_, agora) => {
        const novo = N.estadoVazio(); N.novaRodada(cfg, novo, 1, agora);
        return { substituir: novo, eventos: [N.estadoPublico(cfg, novo, agora)] };
      });
      console.log('Placar, rounds e totais zerados.');
      return { status: 200, json: { ok: true } };
    }
    return { status: 404, json: { ok: false, erro: 'não encontrado' } };
  } catch (e) {
    console.error(e);
    return { status: 500, json: { ok: false, erro: e.message } };
  }
}

module.exports = { tratar, transacao };
