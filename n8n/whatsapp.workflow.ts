import { workflow, node, trigger, switchCase, expr } from '@n8n/workflow-sdk';

const pedido = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Pedido do Painel',
    notes: 'Chamado só pelo servidor do site (painel › Configurações › WhatsApp), por endereço com token secreto.',
    parameters: { httpMethod: 'POST', path: 'glam-whatsapp-<TOKEN_SECRETO>', responseMode: 'responseNode', options: {} }
  },
  output: [{ body: { acao: 'status' } }]
});

const preparar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Preparar Pedido', notes: 'Why Code: Set considerado — normaliza a ação para uma lista fechada (conectar/codigo/status/desconectar/enviar_texto/enviar_documento).', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const b = $input.first().json.body || {};\nconst acoes = ['conectar', 'codigo', 'status', 'desconectar', 'enviar_texto', 'enviar_documento'];\nconst pedido = acoes.includes(String(b.acao)) ? String(b.acao) : 'status';\n// C\u00f3digo manual: s\u00f3 d\u00edgitos, com DDI (55 + DDD + n\u00famero)\nconst numero = pedido === 'codigo' ? String(b.numero || '').replace(/\\D/g, '').slice(0, 15) : '';\nconst acao = pedido === 'codigo' ? 'conectar' : pedido;\nconst para = String(b.para || '').replace(/\\D/g, '');\nconst envio = pedido.startsWith('enviar_') ? {\n  para: para.length >= 12 && para.length <= 13 ? para : '',\n  texto: String(b.texto || '').slice(0, 4000),\n  arquivo: String(b.arquivo || 'ingresso.pdf').replace(/[^\\w. -]/g, '').slice(0, 80) || 'ingresso.pdf',\n  base64: /^[A-Za-z0-9+/=]+$/.test(String(b.base64 || '')) ? String(b.base64).slice(0, 4000000) : '',\n} : {};\nreturn [{ json: Object.assign({ acao, modo: pedido === 'codigo' ? 'codigo' : 'qr', numero: numero.length >= 12 ? numero : '', instancia: 'glam' }, envio) }];" } },
  output: [{ acao: 'status', instancia: 'glam' }]
});

const tipo = switchCase({
  version: 3.2,
  config: {
    name: 'Tipo de Ação',
    parameters: {
      mode: 'rules',
      rules: { values: [
        { outputKey: 'conectar', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.acao }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'conectar' }], combinator: 'and' } },
        { outputKey: 'status', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.acao }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'status' }], combinator: 'and' } },
        { outputKey: 'desconectar', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.acao }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'desconectar' }], combinator: 'and' } },
        { outputKey: 'enviar_texto', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.acao }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'enviar_texto' }], combinator: 'and' } },
        { outputKey: 'enviar_documento', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.acao }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'enviar_documento' }], combinator: 'and' } }
      ] }
    }
  }
});

const criar = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: { name: 'Criar Instância', onError: 'continueRegularOutput', parameters: { resource: 'instances-api', operation: 'instance-basic', instanceName: expr('{{ $json.instancia }}') }, credentials: { evolutionApi: { id: '4oWhfZxKilVJraRd', name: 'NexusUp Company v2' } } },
  output: [{ success: true, data: {} }]
});

const qr = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: { name: 'Gerar QR Code', onError: 'continueRegularOutput', parameters: { resource: 'instances-api', operation: 'instance-connect', instanceName: expr('{{ $("Preparar Pedido").first().json.instancia + ($("Preparar Pedido").first().json.numero ? "?number=" + $("Preparar Pedido").first().json.numero : "") }}') }, credentials: { evolutionApi: { id: '4oWhfZxKilVJraRd', name: 'NexusUp Company v2' } } },
  output: [{ success: true, data: {} }]
});

const consultar = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: { name: 'Consultar Status', onError: 'continueRegularOutput', parameters: { resource: 'instances-api', operation: 'fetch-instances', instanceName: expr('{{ $json.instancia }}') }, credentials: { evolutionApi: { id: '4oWhfZxKilVJraRd', name: 'NexusUp Company v2' } } },
  output: [{ success: true, data: {} }]
});

const desconectar = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: { name: 'Desconectar Número', onError: 'continueRegularOutput', parameters: { resource: 'instances-api', operation: 'logout-instance', instanceName: expr('{{ $json.instancia }}') }, credentials: { evolutionApi: { id: '4oWhfZxKilVJraRd', name: 'NexusUp Company v2' } } },
  output: [{ success: true, data: {} }]
});

const enviarTexto = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: { name: 'Enviar Texto', onError: 'continueRegularOutput', parameters: { resource: 'messages-api', operation: 'send-text', instanceName: expr('{{ $json.instancia }}'), remoteJid: expr('{{ $json.para }}'), messageText: expr('{{ $json.texto }}'), options_message: { delay: 1200, linkPreview: false } }, credentials: { evolutionApi: { id: '4oWhfZxKilVJraRd', name: 'NexusUp Company v2' } } },
  output: [{ success: true, data: {} }]
});

const enviarDocumento = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: { name: 'Enviar PDF', onError: 'continueRegularOutput', parameters: { resource: 'messages-api', operation: 'send-document', instanceName: expr('{{ $json.instancia }}'), remoteJid: expr('{{ $json.para }}'), media: expr('{{ $json.base64 }}'), mimetype: 'application/pdf', caption: expr('{{ $json.texto }}'), fileName: expr('{{ $json.arquivo }}'), options_message: { delay: 800 } }, credentials: { evolutionApi: { id: '4oWhfZxKilVJraRd', name: 'NexusUp Company v2' } } },
  output: [{ success: true, data: {} }]
});

const formatar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Formatar Resultado', notes: 'Why Code: IF/Set considerados — junta 3 respostas diferentes da Evolution numa só, tratando erros.', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const a = $('Preparar Pedido').first().json;\nconst junta = (it) => { const j = (it && it.json) || {}; const e = it && it.error; if (e && typeof e === 'object' && j.success === undefined) return Object.assign({}, j, { success: false, error: { message: e.message || 'Erro', details: e.description || e.message || '' } }); return j; };\nconst rodou = (n) => { try { return $(n).isExecuted; } catch (e) { return false; } };\nconst pega = (n) => { try { return rodou(n) ? junta($(n).first()) : {}; } catch (e) { return {}; } };\nconst msgErro = (x, p) => String((x && x.error && (x.error.details || x.error.message)) || p).slice(0, 300);\nconst mapa = (s) => { const v = String(s || '').toLowerCase(); if (v === 'open') return 'conectado'; if (v === 'connecting') return 'aguardando_qr'; if (v === 'close' || v === 'closed') return 'desconectado'; return v || 'desconhecido'; };\nconst res = { ok: false, acao: a.acao, status: '', numero: '', perfil: '', base64: '', codigo: '', erro: '' };\nif (a.acao === 'conectar') {\n  const c = pega('Criar Inst\u00e2ncia');\n  const tc = JSON.stringify(c.error || {}).toLowerCase();\n  const criou = c.success === true || tc.includes('already') || tc.includes('em uso') || tc.includes('exist');\n  const q = pega('Gerar QR Code');\n  const d = q.data || {};\n  const estado = mapa((d.instance && d.instance.state) || d.state || '');\n  res.base64 = String(d.base64 || (d.qrcode && d.qrcode.base64) || '');\n  res.codigo = a.modo === 'codigo' ? String(d.pairingCode || (d.qrcode && d.qrcode.pairingCode) || '') : '';\n  if (estado === 'conectado') { res.status = 'conectado'; res.ok = true; }\n  else if (a.modo === 'codigo' && !res.codigo) { res.status = 'erro'; res.erro = 'Não foi possível gerar o código. Confira o número (com DDD) e tente de novo.'; }\n  else if (res.codigo || res.base64) { res.status = 'aguardando_qr'; res.ok = true; }\n  else { res.status = 'erro'; res.erro = !criou ? msgErro(c, 'N\u00e3o foi poss\u00edvel criar a conex\u00e3o.') : msgErro(q, 'N\u00e3o foi poss\u00edvel gerar o QR Code. Tente de novo.'); }\n} else if (a.acao === 'status') {\n  const r = junta($input.first());\n  const d = r.data;\n  let i = null;\n  if (Array.isArray(d)) i = d.find((x) => x && (x.name === a.instancia || (x.instance && x.instance.instanceName === a.instancia))) || null;\n  else if (d && typeof d === 'object' && (d.name || d.instance)) i = d;\n  if (i) {\n    res.ok = true;\n    res.status = mapa(i.connectionStatus || (i.instance && (i.instance.state || i.instance.status)));\n    res.numero = String(i.ownerJid || (i.instance && i.instance.owner) || '').split('@')[0].split(':')[0];\n    res.perfil = String(i.profileName || (i.instance && i.instance.profileName) || '');\n  } else { res.ok = true; res.status = 'nao_conectado'; }\n} else if (a.acao === 'enviar_texto' || a.acao === 'enviar_documento') {\n  const r = junta($input.first());\n  res.ok = r.success === true;\n  res.status = res.ok ? 'enviado' : 'falhou';\n  if (!res.ok) res.erro = msgErro(r, 'N\u00e3o foi poss\u00edvel enviar a mensagem.');\n} else {\n  const r = junta($input.first());\n  const t = JSON.stringify(r.error || {}).toLowerCase();\n  res.ok = r.success === true || t.includes('not connected') || t.includes('close') || t.includes('not found');\n  res.status = res.ok ? 'desconectado' : 'erro';\n  if (!res.ok) res.erro = msgErro(r, 'N\u00e3o foi poss\u00edvel desconectar agora.');\n}\nreturn [{ json: res }];" } },
  output: [{ ok: true, acao: 'status', status: 'conectado', numero: '', perfil: '', base64: '', erro: '' }]
});

const responder = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Responder', parameters: { respondWith: 'json', responseBody: expr('{{ JSON.stringify($json) }}'), options: {} } },
  output: [{}]
});

export default workflow('glam-whatsapp', 'GLAM | Conexão do WhatsApp')
  .add(pedido)
  .to(preparar)
  .to(tipo
    .onCase(0, criar.to(qr).to(formatar))
    .onCase(1, consultar.to(formatar))
    .onCase(2, desconectar.to(formatar))
    .onCase(3, enviarTexto.to(formatar))
    .onCase(4, enviarDocumento.to(formatar)))
  .add(formatar)
  .to(responder);
