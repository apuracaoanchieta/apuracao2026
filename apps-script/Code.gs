/**
 * Backend do "Central de Apuração" rodando como Web App do Google Apps Script,
 * usando uma aba da própria planilha como banco de dados.
 *
 * COMO INSTALAR (veja também o README.md do repositório):
 *   1. Crie uma Google Sheets em branco (sheets.new).
 *   2. Menu Extensões → Apps Script.
 *   3. Apague o conteúdo do arquivo Code.gs que abrir e cole todo este arquivo no lugar.
 *   4. O ACCESS_TOKEN abaixo já vem preenchido com a chave desta campanha ('fabricio36222'),
 *      a mesma que já está pré-preenchida no index.html — então o painel conecta sozinho,
 *      sem ninguém da equipe precisar digitar nada. Só troque esse valor se quiser revogar
 *      o acesso de alguém (aí troque aqui E no GAS_TOKEN_PADRAO do index.html, e implante uma
 *      nova versão).
 *   5. Clique em Implantar → Nova implantação → tipo "App da Web".
 *        - Executar como: Eu (seu usuário)
 *        - Quem pode acessar: Qualquer pessoa
 *      Autorize as permissões pedidas (é normal aparecer um aviso de app não verificado —
 *      é o seu próprio script, pode continuar).
 *   6. Copie a URL do Web App (termina em /exec) — ela + a chave de acesso são o que
 *      cada pessoa da equipe vai colar na tela de conexão do painel.
 *
 * SEMPRE que editar este código, você precisa criar uma NOVA VERSÃO em
 * Implantar → Gerenciar implantações → ✏️ → Versão "Nova versão" → Implantar,
 * senão o Web App continua rodando o código antigo.
 */

// ===================== CONFIGURAÇÃO =====================
// Chave padrão desta campanha — igual ao GAS_TOKEN_PADRAO já embutido no index.html, pra
// conectar sozinho em qualquer aparelho sem ninguém precisar digitar nada.
var ACCESS_TOKEN = 'fabricio36222';
var NOME_DA_ABA = 'dados';

// Integração com os resultados oficiais do TSE (botão "Atualizar do TSE" na aba
// Apuração Oficial). O TSE monta a URL de cada arquivo de resultado a partir de
// placeholders (ambiente/ciclo/eleição/pleito) cujos valores só saem publicados
// perto da eleição — por isso, em vez de tentar montar a URL aqui, colamos a URL
// completa e pronta assim que ela existir. Veja o README ("Descobrindo a URL do
// TSE") para o passo a passo de como achar essa URL usando o site oficial de
// resultados (resultados.tse.jus.br) perto da data, ou durante um simulado oficial.
// URL do AMBIENTE DE TESTES (simulado) do TSE — confirmada e testada em 22/09/2026,
// devolvendo dados de verdade (sintéticos) para Deputado Estadual/ES. Funciona só durante
// as janelas oficiais de simulado (15-17 e 22-24/09/2026, 9h-12h e 14h-17h de Brasília);
// fora desses horários o TSE pode devolver 404/erro — é esperado, não é bug do painel.
// QUANDO O TSE PUBLICAR A ELEIÇÃO OFICIAL DE VERDADE (perto do pleito), troque esta URL
// pela do ambiente oficial: troque "resultados-sim.tse.jus.br/simulado/simulado2026" pelo
// domínio/prefixo oficiais (algo como "resultados.tse.jus.br/oficial/..."), mantendo o
// mesmo código de cargo (c0007 = Deputado Estadual) e usando o código de eleição real
// (não mais 21272, que é só do simulado) — o TSE publica esse código perto do dia.
var TSE_URL_RESULTADO = 'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21272/dados/es/es-c0007-e021272-u.json';
// ==========================================================

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NOME_DA_ABA);
  if (!sheet) {
    sheet = ss.insertSheet(NOME_DA_ABA);
    sheet.appendRow(['path', 'json', 'atualizadoEm']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function checkToken_(token) {
  if (!token || token !== ACCESS_TOKEN) {
    throw new Error('token de acesso inválido');
  }
}

// Lê todas as linhas da aba de dados de uma vez.
function readAll_(sheet) {
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var path = values[i][0];
    if (!path) continue;
    var data = null;
    try { data = JSON.parse(values[i][1]); } catch (e) { data = null; }
    rows.push({ path: String(path), data: data, row: i + 1 });
  }
  return rows;
}

function findRow_(rows, path) {
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].path === path) return rows[i];
  }
  return null;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Busca o arquivo de resultados do TSE (servidor consultando servidor — sem restrição
 * de CORS) e devolve num formato simples e estável para o painel, independente do
 * exato nome dos campos usado pelo TSE (que já variou entre ciclos eleitorais).
 */
function buscarResultadoTSE_() {
  if (!TSE_URL_RESULTADO) {
    throw new Error('A URL do resultado do TSE ainda não foi configurada (TSE_URL_RESULTADO no topo do Code.gs). Veja o README — "Descobrindo a URL do TSE".');
  }
  var resp = UrlFetchApp.fetch(TSE_URL_RESULTADO, { muteHttpExceptions: true });
  var status = resp.getResponseCode();
  if (status !== 200) {
    throw new Error('O TSE respondeu ' + status + ' para essa URL — os dados podem ainda não estar publicados (fora do horário de apuração, ou código da eleição errado).');
  }
  var raw;
  try {
    raw = JSON.parse(resp.getContentText());
  } catch (e) {
    throw new Error('A resposta do TSE não veio em JSON válido — o formato pode ter mudado.');
  }
  return normalizarResultadoTSE_(raw);
}

// Campos e hierarquia confirmados batendo com um arquivo real do ambiente de testes do TSE
// (Deputado Estadual/ES, simulado de 22/09/2026): a raiz tem "carg" (lista de cargos —
// nesse arquivo só o próprio, já que o nome do arquivo já é por cargo); cada cargo tem
// "agr" (agremiação — partido isolado ou federação); cada agremiação tem "par" (lista de
// partidos, mesmo quando é federação de um partido só); cada partido tem "cand" (lista de
// candidatos). Ou seja: carg → agr → par → cand, sempre aninhado, nunca solto na raiz.
// Candidato: n/nm/nmu/st/vap(votos apurados)/pvap. Partido: n/sg/nm/tvtn(votos válidos
// nominais)/tvtl(votos válidos legenda)/tvan(votos computados nominais)/tval(votos
// computados legenda).
function extrairCandidato_(c, siglaPartidoPai) {
  return {
    numero: String(c.n != null ? c.n : (c.numero != null ? c.numero : '')),
    nome: c.nm || c.nome || c.nmu || '',
    partido: c.sg || c.partido || siglaPartidoPai || '',
    situacao: c.st || c.situacao || '',
    votos: Number(c.vap != null ? c.vap : (c.votos != null ? c.votos : 0)),
  };
}
function extrairPartido_(p) {
  var votosNominais = Number(p.tvan != null ? p.tvan : (p.tvtn != null ? p.tvtn : 0));
  var votosLegenda = Number(p.tval != null ? p.tval : (p.tvtl != null ? p.tvtl : 0));
  return {
    sigla: p.sg || p.sigla || p.nm || '',
    votos: votosNominais + votosLegenda,
  };
}

function normalizarResultadoTSE_(raw) {
  var candidatos = [];
  var partidos = [];

  // Formato confirmado (ver comentário acima de extrairCandidato_): carg → agr → par → cand.
  var cargos = raw.carg || [];
  cargos.forEach(function (cg) {
    var agrs = cg.agr || [];
    agrs.forEach(function (agr) {
      var pars = agr.par || [];
      pars.forEach(function (p) {
        partidos.push(extrairPartido_(p));
        var cands = p.cand || [];
        cands.forEach(function (c) { candidatos.push(extrairCandidato_(c, p.sg || p.sigla)); });
      });
    });
  });

  // Se o arquivo não vier no formato acima (ex: outro tipo de arquivo do TSE, ou um ciclo
  // eleitoral futuro que mude o formato), tenta os formatos mais "soltos" como reserva, em
  // vez de simplesmente falhar.
  if (!cargos.length) {
    var listaPart = raw.par || raw.partidos || (raw.abr && raw.abr.par) || [];
    listaPart.forEach(function (p) {
      partidos.push(extrairPartido_(p));
      if (p.cand && p.cand.length) {
        p.cand.forEach(function (c) { candidatos.push(extrairCandidato_(c, p.sg || p.sigla)); });
      }
    });
    var listaCandSolta = raw.cand || raw.candidatos || (raw.abr && raw.abr.cand) || [];
    listaCandSolta.forEach(function (c) { candidatos.push(extrairCandidato_(c, '')); });
  }

  candidatos = candidatos.filter(function (c) { return c.numero; });
  partidos = partidos.filter(function (p) { return p.sigla; });

  if (!candidatos.length && !partidos.length) {
    Logger.log('Resposta do TSE não reconhecida: ' + JSON.stringify(raw).slice(0, 5000));
    throw new Error('Não consegui reconhecer nenhum candidato/partido no arquivo do TSE — o formato pode ter mudado desde que este código foi escrito. Os dados brutos foram registrados nos logs do Apps Script (Execuções) para conferência.');
  }

  // "snt" = seções não totalizadas, no vocabulário usado pelo TSE na documentação da
  // divulgação 2026; mantemos também os nomes vistos em ciclos anteriores, por segurança.
  var secoesNaoTotalizadas = raw.snt != null ? raw.snt : (raw.perst != null ? raw.perst : null);

  return {
    atualizadoEm: raw.dg && raw.hg ? (raw.dg + ' ' + raw.hg) : new Date().toISOString(),
    secoesTotalizadas: raw.pst || (secoesNaoTotalizadas != null ? (secoesNaoTotalizadas === 0 ? 'totalização final' : secoesNaoTotalizadas + ' seção(ões) ainda não totalizada(s)') : null),
    candidatos: candidatos,
    partidos: partidos,
  };
}

/**
 * GET ?action=syncAll&token=...
 * Devolve tudo que o painel precisa em uma única resposta — é a chamada que
 * o painel repete a cada poucos segundos para "sincronizar" (não existe
 * push em tempo real de verdade com Apps Script, então isso é feito por polling).
 */
function doGet(e) {
  try {
    checkToken_(e.parameter.token);
    var action = e.parameter.action;
    if (action === 'syncAll') {
      var rows = readAll_(getSheet_());
      var out = { config: null, historico: null, oficial: [], candidatosPartido: [], fiscais: [] };
      rows.forEach(function (r) {
        if (r.path === 'config/geral') { out.config = r.data; return; }
        if (r.path === 'historico/pontos') { out.historico = r.data; return; }
        var barra = r.path.indexOf('/');
        if (barra === -1) return;
        var colecao = r.path.slice(0, barra);
        var id = r.path.slice(barra + 1);
        if (out[colecao]) out[colecao].push({ id: id, data: r.data });
      });
      return jsonOut_(out);
    }
    if (action === 'tse') {
      return jsonOut_(buscarResultadoTSE_());
    }
    return jsonOut_({ error: 'ação GET desconhecida: ' + action });
  } catch (err) {
    return jsonOut_({ error: String(err && err.message || err) });
  }
}

/**
 * POST com corpo JSON (enviado como texto puro, de propósito — ver nota no
 * index.html sobre por que o Content-Type é text/plain).
 * body = { token, action: 'set'|'update'|'delete'|'add', path, data }
 *   - 'set'/'update' em path = "config/geral" ou "oficial/pl" etc (documento único)
 *   - 'add' em path = "candidatosPartido" ou "fiscais" (nome da coleção — o id é gerado aqui)
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var body = JSON.parse(e.postData.contents);
    checkToken_(body.token);
    var sheet = getSheet_();
    var rows = readAll_(sheet);
    var action = body.action;

    if (action === 'set' || action === 'update') {
      var existente = findRow_(rows, body.path);
      var novoDado = body.data;
      if (action === 'update' && existente && existente.data && typeof existente.data === 'object') {
        novoDado = Object.assign({}, existente.data, body.data);
      }
      var json = JSON.stringify(novoDado);
      var agora = new Date().toISOString();
      if (existente) {
        sheet.getRange(existente.row, 2).setValue(json);
        sheet.getRange(existente.row, 3).setValue(agora);
      } else {
        sheet.appendRow([body.path, json, agora]);
      }
      return jsonOut_({ ok: true });
    }

    if (action === 'delete') {
      var alvo = findRow_(rows, body.path);
      if (alvo) sheet.deleteRow(alvo.row);
      return jsonOut_({ ok: true });
    }

    if (action === 'add') {
      var id = Utilities.getUuid();
      var caminho = body.path + '/' + id;
      sheet.appendRow([caminho, JSON.stringify(body.data), new Date().toISOString()]);
      return jsonOut_({ ok: true, id: id });
    }

    return jsonOut_({ error: 'ação POST desconhecida: ' + action });
  } catch (err) {
    return jsonOut_({ error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}
