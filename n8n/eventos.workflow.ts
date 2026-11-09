import { workflow, node, trigger, newCredential, switchCase, expr } from '@n8n/workflow-sdk';

const receberEvento = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Receber Evento do Site',
    parameters: { httpMethod: 'POST', path: 'glam-eventos', authentication: 'headerAuth', responseMode: 'onReceived', options: {} },
    credentials: { httpHeaderAuth: newCredential('GLAM Segredo (x-glam-secret)') }
  },
  output: [{ body: { evento: 'pedido_pago', site_url: 'https://glam-ingressos.vercel.app', casa: { email_remetente: 'GLAM House <ingressos@glam.com.br>', evolution_instancia: 'glam' }, cliente: { nome: 'Ana Souza', email: 'ana@exemplo.com', whatsapp: '5598999999999' }, festa: { titulo: 'Baile', data: 'sábado, 20 de dezembro', hora: '23:00', local: 'GLAM House' }, pedido: { codigo: 'GLM-ABC123', total_fmt: 'R$ 40,00' }, ingressos: [{ nome: 'Ana', setor: 'Pista', lote: '1º lote', url: 'https://glam-ingressos.vercel.app/ingresso/x', qr_url: 'https://glam-ingressos.vercel.app/api/qr/x' }] } }]
});

const montarMensagens = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar E-mails e WhatsApps',
    notes: 'Why Code: Set/HTML considered — monta modelos HTML com laço de ingressos para 4 tipos de evento; um nó substitui ~12 nós de formatação.',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Modelos compartilhados de e-mail (HTML dourado) e WhatsApp \u2014 usados nos dois fluxos.\nconst OURO = '#d4af6a';\nconst esc = (s) => String(s == null ? '' : s).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));\nconst emailValido = (e) => !!e && /^\\S+@\\S+\\.\\S+$/.test(e) && !/@glam\\.local$/i.test(e);\nconst zapValido = (n) => !!n && String(n).replace(/\\D/g, '').length >= 12;\nconst botao = (url, txt) => `<a href=\"${esc(url)}\" style=\"display:inline-block;background:linear-gradient(115deg,#9c7a3c,#d4af6a,#f3dca6,#c9a05a);color:#1a1408;text-decoration:none;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:12px;padding:14px 28px;border-radius:999px\">${esc(txt)}</a>`;\nfunction moldura(titulo, corpo, site) {\n  return `<!doctype html><html><body style=\"margin:0;background:#0a0908;font-family:Helvetica,Arial,sans-serif;color:#f5efe4\">\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#0a0908;padding:32px 12px\"><tr><td align=\"center\">\n<table width=\"560\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:560px;width:100%;background:#12100e;border:1px solid #3a3022;border-radius:20px;overflow:hidden\">\n<tr><td style=\"height:4px;background:linear-gradient(90deg,#9c7a3c,#f3dca6,#9c7a3c)\"></td></tr>\n<tr><td align=\"center\" style=\"padding:32px 28px 8px\"><img src=\"${site}/logo-dourado.png\" width=\"140\" alt=\"GLAM\" style=\"display:block\"></td></tr>\n<tr><td align=\"center\" style=\"padding:8px 28px 0;font-family:Georgia,serif;font-size:28px;color:#f5efe4\">${titulo}</td></tr>\n<tr><td style=\"padding:20px 28px 32px;font-size:15px;line-height:1.6;color:#d9d2c5\">${corpo}</td></tr>\n<tr><td align=\"center\" style=\"padding:18px;border-top:1px solid #2a251f;font-size:11px;letter-spacing:2px;color:#a39d92\">GLAM HOUSE \u00b7 A CASINHA MAIS AMADA DE S\u00c3O LU\u00cdS</td></tr>\n</table></td></tr></table></body></html>`;\n}\nfunction cartaoIngresso(i) {\n  return `<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:16px 0;border:1px solid #3a3022;border-radius:16px;background:#1b1815\"><tr>\n<td style=\"padding:16px\" width=\"150\"><img src=\"${esc(i.qr_url)}\" width=\"140\" height=\"140\" alt=\"QR\" style=\"display:block;background:#fff;border-radius:10px;padding:6px\"></td>\n<td style=\"padding:16px;vertical-align:middle\"><div style=\"font-family:Georgia,serif;font-size:20px;color:#f5efe4\">${esc(i.nome)}</div>\n<div style=\"font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${OURO};margin:4px 0 12px\">${esc(i.setor)} \u00b7 ${esc(i.lote)}</div>\n<a href=\"${esc(i.url)}\" style=\"color:${OURO};font-size:13px\">Abrir ingresso \u2192</a></td></tr></table>`;\n}\n\nconst b = $input.first().json.body || $input.first().json;\nconst site = String(b.site_url || 'https://glam-ingressos.vercel.app');\nconst casa = b.casa || {};\nconst rem = casa.email_remetente || 'GLAM House <ingressos@glamhouse.com.br>';\nconst inst = casa.evolution_instancia || 'glam';\nconst out = [];\nconst email = (para, assunto, titulo, corpo) => { if (emailValido(para)) out.push({ json: { canal: 'email', para, assunto, html: moldura(titulo, corpo, site), remetente: rem } }); };\nconst zap = (para, texto) => { if (zapValido(para)) out.push({ json: { canal: 'whatsapp', para: String(para).replace(/\\D/g, ''), texto, instancia: inst } }); };\n\nif (b.evento === 'pedido_pago') {\n  const f = b.festa || {}, c = b.cliente || {}, ings = b.ingressos || [];\n  const corpo = `<p>Oi, <b>${esc((c.nome || '').split(' ')[0])}</b>! Seu pagamento foi aprovado e seus ingressos est\u00e3o garantidos \u2728</p>\n<p style=\"margin:0\"><b style=\"color:${OURO}\">${esc(f.titulo)}</b><br>${esc(f.data)} \u00b7 ${esc(f.hora)}<br>${esc(f.local || '')}${f.endereco ? ' \u2014 ' + esc(f.endereco) : ''}</p>\n${ings.map(cartaoIngresso).join('')}\n<p style=\"font-size:13px;color:#a39d92\">Pedido <b>${esc(b.pedido.codigo)}</b> \u00b7 ${esc(b.pedido.total_fmt)}. Cada QR entra uma vez s\u00f3 \u2014 n\u00e3o compartilhe print. Voc\u00ea pode transferir um ingresso pela p\u00e1gina dele.</p>\n<p align=\"center\" style=\"text-align:center;margin-top:24px\">${botao(b.meus_ingressos_url || site + '/meus-ingressos', 'Meus ingressos')}</p>`;\n  email(c.email, (b.reenvio ? '[Reenvio] ' : '') + `Seus ingressos para ${f.titulo} \u2728`, 'Ingressos confirmados', corpo);\n  zap(c.whatsapp, `\u2728 *GLAM* \u2014 pagamento aprovado!\\n\\nOi, ${(c.nome || '').split(' ')[0]}! Seus ingressos para *${f.titulo}* est\u00e3o garantidos.\\n\ud83d\udcc5 ${f.data} \u00b7 ${f.hora}\\n\ud83d\udccd ${f.local || 'GLAM House'}\\n\\n` +\n    ings.map((i, n) => `\ud83c\udf9f\ufe0f ${n + 1}. ${i.nome} \u2014 ${i.setor}\\n${i.url}`).join('\\n\\n') +\n    `\\n\\nPedido ${b.pedido.codigo}. Mostre o QR na portaria \u2014 cada um entra uma vez s\u00f3. Te esperamos! \ud83e\udd42`);\n}\n\nif (b.evento === 'acesso_link') {\n  email(b.email, 'Seu acesso aos ingressos GLAM', 'Meus ingressos',\n    `<p>Use o bot\u00e3o abaixo para ver seus ingressos. O link vale por <b>30 minutos</b>.</p><p align=\"center\" style=\"text-align:center;margin:28px 0\">${botao(b.link, 'Ver meus ingressos')}</p><p style=\"font-size:12px;color:#a39d92\">Se n\u00e3o foi voc\u00ea que pediu, ignore este e-mail.</p>`);\n}\n\nif (b.evento === 'ingresso_transferido') {\n  const p = b.para || {}, f = b.festa || {}, i = b.ingresso || {};\n  email(p.email, `${b.de} te enviou um ingresso para ${f.titulo} \u2728`, 'Voc\u00ea ganhou um ingresso',\n    `<p>Oi, <b>${esc((p.nome || '').split(' ')[0])}</b>! <b>${esc(b.de)}</b> transferiu um ingresso para voc\u00ea.</p><p><b style=\"color:${OURO}\">${esc(f.titulo)}</b><br>${esc(f.data)} \u00b7 ${esc(f.hora)}<br>${esc(f.local || '')}</p>` +\n    cartaoIngresso({ nome: p.nome, setor: i.setor, lote: i.lote, url: i.url, qr_url: i.qr_url }));\n  zap(p.whatsapp, `\u2728 *GLAM* \u2014 ${b.de} te enviou um ingresso para *${f.titulo}*!\\n\ud83d\udcc5 ${f.data} \u00b7 ${f.hora}\\n\\nSeu QR: ${i.url}`);\n}\n\nif (b.evento === 'lote_esgotado') {\n  const l = b.lote || {}, f = b.festa || {};\n  const txt = `\ud83d\udd25 *Lote esgotado*\\n${f.titulo || ''}\\n${l.setor} \u00b7 ${l.nome} (${l.capacidade} unidades)\\n\\nO pr\u00f3ximo lote j\u00e1 entrou \u00e0 venda (se cadastrado). Painel: ${site}/admin`;\n  zap(casa.whatsapp_dono, txt);\n  email(casa.email_dono, `Lote esgotado: ${l.setor} \u00b7 ${l.nome}`, 'Lote esgotado \ud83d\udd25', `<p><b>${esc(f.titulo || '')}</b><br>${esc(l.setor)} \u00b7 ${esc(l.nome)} \u2014 ${esc(l.capacidade)} unidades vendidas.</p><p align=\"center\" style=\"text-align:center\">${botao(site + '/admin/festas', 'Abrir painel')}</p>`);\n}\nif (b.evento === 'alerta_seguranca') {\n  zap(casa.whatsapp_dono, b.texto);\n  email(casa.email_dono, 'Alerta de seguran\u00e7a \u2014 GLAM', 'Alerta de seguran\u00e7a', `<p>${esc(b.texto)}</p><p style=\"font-size:12px;color:#a39d92\">Enviado automaticamente pelo sistema de ingressos.</p>`);\n}\nreturn out;\n" }
  },
  output: [{ canal: 'email', para: 'ana@exemplo.com', assunto: 'Seus ingressos', html: '<p>oi</p>', remetente: 'GLAM <a@b.com>', texto: 'oi', instancia: 'glam' }]
});

const rotearCanal = switchCase({
  version: 3.2,
  config: {
    name: 'Canal de Envio',
    parameters: {
      mode: 'rules',
      rules: { values: [
        { outputKey: 'email', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.canal }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'email' }], combinator: 'and' } },
        { outputKey: 'whatsapp', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.canal }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'whatsapp' }], combinator: 'and' } }
      ] }
    }
  }
});

const enviarEmail = node({
  type: 'n8n-nodes-base.emailSend',
  version: 2.1,
  config: {
    name: 'Enviar E-mail (Resend SMTP)',
    onError: 'continueRegularOutput',
    retryOnFail: true,
    parameters: {
      operation: 'send',
      fromEmail: expr('{{ $json.remetente }}'),
      toEmail: expr('{{ $json.para }}'),
      subject: expr('{{ $json.assunto }}'),
      emailFormat: 'html',
      html: expr('{{ $json.html }}'),
      options: { appendAttribution: false }
    },
    credentials: { smtp: newCredential('Resend SMTP (GLAM)') }
  },
  output: [{ accepted: ['cliente@exemplo.com'] }]
});

const enviarWhatsapp = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: {
    name: 'Enviar WhatsApp (Evolution)',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'messages-api',
      instanceName: expr('{{ $json.instancia }}'),
      remoteJid: expr('{{ $json.para }}'),
      messageText: expr('{{ $json.texto }}'),
      options_message: { delay: 1200, linkPreview: true }
    },
    credentials: { evolutionApi: newCredential('NexusUp Company v2') }
  },
  output: [{ key: { id: 'ABC' } }]
});

export default workflow('glam-eventos', 'GLAM | Eventos do site')
  .add(receberEvento)
  .to(montarMensagens)
  .to(rotearCanal
    .onCase(0, enviarEmail)
    .onCase(1, enviarWhatsapp));
