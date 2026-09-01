/**
 * Backend do "Central de Apuração" rodando como Web App do Google Apps Script,
 * usando uma aba da própria planilha como banco de dados.
 *
 * COMO INSTALAR (veja também o README.md do repositório):
 *   1. Crie uma Google Sheets em branco (sheets.new).
 *   2. Menu Extensões → Apps Script.
 *   3. Apague o conteúdo do arquivo Code.gs que abrir e cole todo este arquivo no lugar.
 *   4. Troque o valor de ACCESS_TOKEN abaixo por uma chave só sua (qualquer texto,
 *      quanto mais aleatório melhor — é a "senha" que protege os dados).
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
var ACCESS_TOKEN = 'TROQUE-ESTA-CHAVE-POR-ALGO-SO-SEU'; // obrigatório trocar antes de usar
var NOME_DA_ABA = 'dados';
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
