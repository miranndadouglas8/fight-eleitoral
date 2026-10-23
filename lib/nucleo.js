// Fight Eleitoral — regras do jogo (as mesmas no PC e na Vercel).
// Tudo aqui é "puro": recebe o estado, muda o estado e devolve os eventos que os jogos e o painel precisam ver.

const LADOS = ['vermelho', 'amarelo'];

const PADRAO = {
  porta: 3000,
  tokenWebhook: '',
  tokenAdmin: '',
  // Pix de valor aberto: cada R$ 1 vira 1 soco; o valor de UM Pix escolhe o especial (nível 1 a 5)
  reaisPorSoco: 1,
  maxSocosPorPix: 30,
  niveis: [5, 10, 20, 30, 50],
  duracaoRound: 60,
  mostrarNomeDoPagador: true,
  times: {
    vermelho: { nome: 'PETISTAS', palavra: 'PETISTA', especiais: ['PAI DA MENTIRA', 'VACINA', 'COICE DO JUMENTO', 'CHUVA DE MORTADELA', 'CASA TRIPLEX'] },
    amarelo: { nome: 'BOLSONARISTAS', palavra: 'BOLSONARISTA', especiais: ['MULHERES DE BIQUÍNI', 'É SÓ UMA GRIPEZINHA', 'ARMINHA', 'METRALHADORA DE TINTA', 'BOMBARDEIO DE TINTA'] },
  },
  pix: {
    chave: '',
    mostrarChave: false,
    nomeRecebedor: 'FIGHT ELEITORAL',
    cidade: 'SAO PAULO',
    vermelho: { txid: 'VERMELHO', copiaECola: '' },
    amarelo: { txid: 'AMARELO', copiaECola: '' },
  },
  palavras: {
    vermelho: ['vermelho', 'petista', 'pt', 'red'],
    amarelo: ['amarelo', 'bolsonarista', 'bolso', 'yellow'],
  },
};

function mesclar(base, extra) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? mesclar(base[k], v) : v;
  }
  return out;
}

// config.json + variáveis de ambiente (na Vercel os tokens vêm do painel de Environment Variables)
function montarConfig(lido = {}) {
  const cfg = mesclar(PADRAO, lido);
  if (process.env.PORT) cfg.porta = Number(process.env.PORT);
  if (process.env.TOKEN_ADMIN) cfg.tokenAdmin = process.env.TOKEN_ADMIN;
  if (process.env.TOKEN_WEBHOOK) cfg.tokenWebhook = process.env.TOKEN_WEBHOOK;
  return cfg;
}

// ---------------------------------------------------------------------
// Pix "copia e cola" (BR Code estático, padrão do Banco Central)
// ---------------------------------------------------------------------
const campo = (id, valor) => { const v = String(valor); return id + String(v.length).padStart(2, '0') + v; };
function crc16(texto) {
  let crc = 0xffff;
  for (const byte of Buffer.from(texto, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
function gerarBrCode({ chave, valor, nome, cidade, txid }) {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave);
  let p = campo('00', '01') + campo('26', conta) + campo('52', '0000') + campo('53', '986');
  if (valor) p += campo('54', Number(valor).toFixed(2));
  p += campo('58', 'BR')
    + campo('59', semAcento(nome).replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, 25) || 'PIX')
    + campo('60', semAcento(cidade).replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, 15) || 'BRASIL')
    + campo('62', campo('05', String(txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'))
    + '6304';
  return p + crc16(p);
}
function qrDoLado(cfg, lado) {
  const c = cfg.pix[lado] || {};
  if (c.copiaECola) return c.copiaECola.trim();
  if (!cfg.pix.chave) return '';
  // sem valor fixo: quem paga escolhe quanto manda
  return gerarBrCode({ chave: cfg.pix.chave, nome: cfg.pix.nomeRecebedor, cidade: cfg.pix.cidade, txid: c.txid || lado });
}

// ---------------------------------------------------------------------
// leitura dos webhooks (vários formatos)
// ---------------------------------------------------------------------
const norm = s => semAcento(s).toLowerCase();
const palavrasDo = (cfg, l) => [...(cfg.palavras[l] || []), cfg.times[l]?.palavra, cfg.times[l]?.nome].filter(Boolean);
function ladoPorTexto(cfg, ...textos) {
  const t = norm(textos.filter(Boolean).join(' '));
  if (!t) return null;
  const achados = LADOS.filter(l => palavrasDo(cfg, l).some(p => {
    const w = norm(p);
    return w.length <= 3 ? new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(t) : t.includes(w);
  }));
  return achados.length === 1 ? achados[0] : null;
}
const reaisDe = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

function extrairPagamentos(cfg, body) {
  if (!body || typeof body !== 'object') return [];
  const lado = (...t) => ladoPorTexto(cfg, ...t);

  // 1) Padrão da API Pix do Banco Central (Inter PJ, Efí, Sicoob, Itaú...)
  //    { "pix": [ { "endToEndId", "txid", "valor": "2.00", "infoPagador", "horario" } ] }
  //    O lado vem da mensagem que a pessoa escreveu no Pix (infoPagador) ou do txid do QR.
  if (Array.isArray(body.pix)) {
    return body.pix.map(p => ({
      id: p.endToEndId || p.e2eid || p.txid,
      valor: reaisDe(p.valor),
      lado: lado(p.infoPagador) || lado(p.txid) || lado(JSON.stringify(p)),
      nome: p.pagador?.nome || p.gnExtras?.pagador?.nome || p.nomePagador || '',
    }));
  }

  // 2) Woovi / OpenPix  { "event": "OPENPIX:TRANSACTION_RECEIVED", "pix": {...}, "charge": {...}, "pixQrCode": {...} }
  if (typeof body.event === 'string' && /^OPENPIX:/i.test(body.event)) {
    if (!/TRANSACTION_RECEIVED|CHARGE_COMPLETED/i.test(body.event)) return [];
    const pix = body.pix || {}, charge = body.charge || pix.charge || {}, qr = body.pixQrCode || pix.pixQrCode || {};
    return [{
      id: pix.endToEndId || pix.transactionID || charge.transactionID || charge.correlationID,
      valor: Number(pix.value ?? charge.value) / 100,
      lado: lado(pix.comment, pix.infoPagador) || lado(qr.identifier, qr.correlationID, qr.name, qr.comment) || lado(charge.correlationID, charge.comment),
      nome: pix.payer?.name || charge.customer?.name || pix.customer?.name || '',
    }];
  }

  // 3) Formato simples (Zapier, Make, n8n, script próprio...)
  //    { "lado": "vermelho", "valor": 2, "nome": "Fulano", "id": "opcional" }
  const texto = body.lado ?? body.side ?? body.time ?? body.mensagem ?? body.message;
  if (texto !== undefined) {
    return [{ id: body.id, valor: reaisDe(body.valor ?? body.value ?? body.amount), lado: lado(texto), nome: body.nome || body.name || '' }];
  }
  return [];
}

function primeiroNome(nome) {
  const n = String(nome || '').trim().split(/\s+/)[0] || '';
  return n ? n[0].toUpperCase() + n.slice(1).toLowerCase() : '';
}

// ---------------------------------------------------------------------
// estado, rounds e pagamentos
// ---------------------------------------------------------------------
function estadoVazio() {
  return {
    totais: { vermelho: { valor: 0, pix: 0 }, amarelo: { valor: 0, pix: 0 } },
    sobraCentavos: { vermelho: 0, amarelo: 0 },
    vistos: [],
    rodada: null,
    vitorias: { vermelho: 0, amarelo: 0, empates: 0 },
    historico: [],
  };
}
const normalizar = bruto => mesclar(estadoVazio(), bruto || {});

function novaRodada(cfg, estado, numero, inicio) {
  estado.rodada = {
    numero, inicio, fim: inicio + cfg.duracaoRound * 1000,
    golpes: { vermelho: 0, amarelo: 0 }, pix: { vermelho: 0, amarelo: 0 }, valor: { vermelho: 0, amarelo: 0 }, maior: null,
  };
}

// quem deu mais golpes no round vence (empate → quem mandou mais Pix); round sem Pix não conta
function vencedorDa(r) {
  if (!r.pix.vermelho && !r.pix.amarelo) return null;
  const gv = r.golpes.vermelho, ga = r.golpes.amarelo;
  if (gv !== ga) return gv > ga ? 'vermelho' : 'amarelo';
  if (r.pix.vermelho !== r.pix.amarelo) return r.pix.vermelho > r.pix.amarelo ? 'vermelho' : 'amarelo';
  return 'empate';
}

// fecha o round que já acabou (se houver) e devolve o evento 'fimRound'
function atualizarRounds(cfg, estado, agora) {
  const eventos = [];
  if (!estado.rodada || !estado.rodada.golpes) { novaRodada(cfg, estado, (estado.rodada?.numero || 0) + 1, agora); return eventos; }
  if (agora < estado.rodada.fim) return eventos;
  const r = estado.rodada, vencedor = vencedorDa(r);
  if (vencedor === 'empate') estado.vitorias.empates++;
  else if (vencedor) estado.vitorias[vencedor]++;
  if (vencedor) {
    estado.historico.unshift({ numero: r.numero, vencedor, golpes: r.golpes, pix: r.pix, valor: r.valor, maior: r.maior, fim: r.fim });
    estado.historico.length = Math.min(estado.historico.length, 30);
  }
  // o próximo round começa quando o anterior acabou; se ficou muito tempo sem ninguém, começa agora
  novaRodada(cfg, estado, r.numero + 1, agora - r.fim < cfg.duracaoRound * 1000 ? r.fim : agora);
  eventos.push({
    tipo: 'fimRound',
    resultado: { numero: r.numero, vencedor, golpes: r.golpes, pix: r.pix, valor: r.valor, maior: r.maior },
    vitorias: { ...estado.vitorias }, rodada: estado.rodada,
  });
  return eventos;
}

const nivelDoValor = (cfg, v) => cfg.niveis.reduce((n, minimo, i) => (v >= minimo ? i + 1 : n), 0);
const nomeDoEspecial = (cfg, lado, nivel) => cfg.times[lado]?.especiais?.[nivel - 1] || `ESPECIAL ${nivel}`;

// Valor aberto: cada R$ 1 = 1 soco (centavos acumulam). O valor deste Pix escolhe o especial.
function registrarPagamento(cfg, estado, pg) {
  if (!pg.lado || !(pg.valor > 0)) return { resultado: { ok: false, motivo: !pg.lado ? 'lado não identificado' : 'valor inválido' }, eventos: [] };
  if (pg.id) {
    if (estado.vistos.includes(pg.id)) return { resultado: { ok: false, motivo: 'repetido' }, eventos: [] };
    estado.vistos.push(pg.id); if (estado.vistos.length > 300) estado.vistos.splice(0, 100);
  }
  const centavos = Math.round(pg.valor * 100), cps = Math.round(cfg.reaisPorSoco * 100);
  estado.sobraCentavos[pg.lado] += centavos;
  const socos = Math.floor(estado.sobraCentavos[pg.lado] / cps);
  estado.sobraCentavos[pg.lado] -= socos * cps;
  const nivel = nivelDoValor(cfg, pg.valor);
  const nome = cfg.mostrarNomeDoPagador ? primeiroNome(pg.nome) : '';

  const t = estado.totais[pg.lado];
  t.valor = (Math.round(t.valor * 100) + centavos) / 100; t.pix += 1;
  const r = estado.rodada;
  r.valor[pg.lado] = (Math.round(r.valor[pg.lado] * 100) + centavos) / 100;
  r.golpes[pg.lado] += socos;
  r.pix[pg.lado] += 1;
  if (!r.maior || pg.valor > r.maior.valor) r.maior = { lado: pg.lado, nome, valor: pg.valor };

  return {
    resultado: { ok: true, socos, nivel, especial: nivel ? nomeDoEspecial(cfg, pg.lado, nivel) : '' },
    eventos: [{ tipo: 'pix', lado: pg.lado, valor: pg.valor, socos, nivel, nome, totais: estado.totais, rodada: estado.rodada }],
  };
}

function estadoPublico(cfg, estado, agora) {
  return {
    tipo: 'estado', agora,
    reaisPorSoco: cfg.reaisPorSoco, maxSocosPorPix: cfg.maxSocosPorPix, niveis: cfg.niveis, duracaoRound: cfg.duracaoRound,
    times: cfg.times,
    totais: estado.totais, rodada: estado.rodada, vitorias: estado.vitorias, historico: estado.historico.slice(0, 10),
    qr: { vermelho: qrDoLado(cfg, 'vermelho'), amarelo: qrDoLado(cfg, 'amarelo') },
    chave: cfg.pix.mostrarChave ? cfg.pix.chave : '',
  };
}

module.exports = {
  LADOS, montarConfig, mesclar, gerarBrCode, crc16, qrDoLado, ladoPorTexto, reaisDe, extrairPagamentos,
  estadoVazio, normalizar, novaRodada, atualizarRounds, registrarPagamento, estadoPublico, nomeDoEspecial,
};
