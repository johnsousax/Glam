import { workflow, node, trigger, newCredential, switchCase, expr } from '@n8n/workflow-sdk';

const cadaTres = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'A cada 3 min (Pix pendente)', parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 3 }] } } },
  output: [{}]
});

const dezHoras = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Todo dia 10h (É hoje)', parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 10, triggerAtMinute: 0 }] } } },
  output: [{}]
});

const onzeHoras = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Todo dia 11h (Relatório)', parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 11, triggerAtMinute: 0 }] } } },
  output: [{}]
});

const cadaCinco = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'A cada 5 min (Site no ar?)', parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] } } },
  output: [{}]
});

const quatroHoras = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Todo dia 4h (Backup)', parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 4, triggerAtMinute: 0 }] } } },
  output: [{}]
});

const buscarPix = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Buscar Pix Pendentes',
    retryOnFail: true,
    notes: 'Why HTTP: endpoint próprio do site GLAM, sem nó dedicado.',
    parameters: {
      method: 'GET',
      url: 'https://glam-ingressos.vercel.app/api/n8n/pix-pendentes',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: { timeout: 60000 }
    },
    credentials: { httpHeaderAuth: newCredential('GLAM Segredo (x-glam-secret)') }
  },
  output: [{ acao: 'pix-pendentes', casa: { whatsapp_dono: '5598999999999', email_dono: 'dono@exemplo.com', evolution_instancia: 'glam' }, itens: [] }]
});

const buscarHoje = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Buscar Festas de Hoje',
    retryOnFail: true,
    notes: 'Why HTTP: endpoint próprio do site GLAM, sem nó dedicado.',
    parameters: {
      method: 'GET',
      url: 'https://glam-ingressos.vercel.app/api/n8n/festas-hoje',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: { timeout: 60000 }
    },
    credentials: { httpHeaderAuth: newCredential('GLAM Segredo (x-glam-secret)') }
  },
  output: [{ acao: 'festas-hoje', casa: { whatsapp_dono: '5598999999999', email_dono: 'dono@exemplo.com', evolution_instancia: 'glam' }, itens: [] }]
});

const buscarOntem = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Buscar Festas de Ontem',
    retryOnFail: true,
    notes: 'Why HTTP: endpoint próprio do site GLAM, sem nó dedicado.',
    parameters: {
      method: 'GET',
      url: 'https://glam-ingressos.vercel.app/api/n8n/pos-festa',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: { timeout: 60000 }
    },
    credentials: { httpHeaderAuth: newCredential('GLAM Segredo (x-glam-secret)') }
  },
  output: [{ acao: 'pos-festa', casa: { whatsapp_dono: '5598999999999', email_dono: 'dono@exemplo.com', evolution_instancia: 'glam' }, itens: [] }]
});

const gerarBackup = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Gerar Backup',
    retryOnFail: true,
    notes: 'Why HTTP: endpoint próprio do site GLAM, sem nó dedicado.',
    parameters: {
      method: 'GET',
      url: 'https://glam-ingressos.vercel.app/api/n8n/backup',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: { timeout: 60000 }
    },
    credentials: { httpHeaderAuth: newCredential('GLAM Segredo (x-glam-secret)') }
  },
  output: [{ acao: 'backup', casa: { whatsapp_dono: '5598999999999', email_dono: 'dono@exemplo.com', evolution_instancia: 'glam' }, itens: [] }]
});

const verificarSite = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Verificar Site',
    notes: 'Why HTTP: checagem de saúde do site (sem nó dedicado).',
    parameters: { method: 'GET', url: 'https://glam-ingressos.vercel.app/api/health', options: { timeout: 20000, response: { response: { fullResponse: true, neverError: true } } } }
  },
  output: [{ statusCode: 200, body: { ok: true } }]
});

const detectarQueda = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Detectar Queda ou Volta',
    notes: 'Why Code: IF considerado — precisa lembrar o estado entre execuções (static data) para avisar só quando muda.',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const r = $input.first().json || {};\nconst m = $getWorkflowStaticData('global');\nconst ok = r.statusCode === 200 && r.body && r.body.ok === true;\nconst antes = m.site_ok !== false;\nm.site_ok = ok;\nif (ok === antes || !m.whatsapp_dono) return [];\nconst site = 'https://glam-ingressos.vercel.app';\nconst texto = ok\n  ? `\u2705 *GLAM* \u2014 o site de ingressos voltou ao ar.\\n${site}`\n  : `\ud83d\udea8 *ALERTA GLAM* \u2014 o site de ingressos n\u00e3o est\u00e1 respondendo (status ${r.statusCode || 'sem resposta'}).\\n${site}\\nVerifique a Vercel e o Supabase.`;\nreturn [{ json: { canal: 'whatsapp', para: m.whatsapp_dono, texto, instancia: m.instancia || 'glam' } }];\n" }
  },
  output: [{ canal: 'whatsapp', para: '5598999999999', texto: 'alerta', instancia: 'glam' }]
});

const montarRotinas = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar Avisos das Rotinas',
    notes: 'Why Code: Set/HTML considerados — modelos HTML com laços (vários ingressos por pessoa) para 3 rotinas; também guarda o WhatsApp do dono para o alerta de queda.',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Modelos compartilhados de e-mail (HTML dourado) e WhatsApp \u2014 usados nos dois fluxos.\nconst OURO = '#d4af6a';\nconst esc = (s) => String(s == null ? '' : s).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));\nconst emailValido = (e) => !!e && /^\\S+@\\S+\\.\\S+$/.test(e) && !/@glam\\.local$/i.test(e);\nconst zapValido = (n) => !!n && String(n).replace(/\\D/g, '').length >= 12;\nconst botao = (url, txt) => `<a href=\"${esc(url)}\" style=\"display:inline-block;background:linear-gradient(115deg,#9c7a3c,#d4af6a,#f3dca6,#c9a05a);color:#1a1408;text-decoration:none;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:12px;padding:14px 28px;border-radius:999px\">${esc(txt)}</a>`;\nfunction moldura(titulo, corpo, site) {\n  return `<!doctype html><html><body style=\"margin:0;background:#0a0908;font-family:Helvetica,Arial,sans-serif;color:#f5efe4\">\n<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#0a0908;padding:32px 12px\"><tr><td align=\"center\">\n<table width=\"560\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:560px;width:100%;background:#12100e;border:1px solid #3a3022;border-radius:20px;overflow:hidden\">\n<tr><td style=\"height:4px;background:linear-gradient(90deg,#9c7a3c,#f3dca6,#9c7a3c)\"></td></tr>\n<tr><td align=\"center\" style=\"padding:32px 28px 8px\"><img src=\"${site}/logo-dourado.png\" width=\"140\" alt=\"GLAM\" style=\"display:block\"></td></tr>\n<tr><td align=\"center\" style=\"padding:8px 28px 0;font-family:Georgia,serif;font-size:28px;color:#f5efe4\">${titulo}</td></tr>\n<tr><td style=\"padding:20px 28px 32px;font-size:15px;line-height:1.6;color:#d9d2c5\">${corpo}</td></tr>\n<tr><td align=\"center\" style=\"padding:18px;border-top:1px solid #2a251f;font-size:11px;letter-spacing:2px;color:#a39d92\">GLAM HOUSE \u00b7 A CASINHA MAIS AMADA DE S\u00c3O LU\u00cdS</td></tr>\n</table></td></tr></table></body></html>`;\n}\nfunction cartaoIngresso(i) {\n  return `<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:16px 0;border:1px solid #3a3022;border-radius:16px;background:#1b1815\"><tr>\n<td style=\"padding:16px\" width=\"150\"><img src=\"${esc(i.qr_url)}\" width=\"140\" height=\"140\" alt=\"QR\" style=\"display:block;background:#fff;border-radius:10px;padding:6px\"></td>\n<td style=\"padding:16px;vertical-align:middle\"><div style=\"font-family:Georgia,serif;font-size:20px;color:#f5efe4\">${esc(i.nome)}</div>\n<div style=\"font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${OURO};margin:4px 0 12px\">${esc(i.setor)} \u00b7 ${esc(i.lote)}</div>\n<a href=\"${esc(i.url)}\" style=\"color:${OURO};font-size:13px\">Abrir ingresso \u2192</a></td></tr></table>`;\n}\n\nconst r = $input.first().json || {};\nconst site = 'https://glam-ingressos.vercel.app';\nconst casa = r.casa || {};\nconst memoria = $getWorkflowStaticData('global');\nif (casa.whatsapp_dono) memoria.whatsapp_dono = casa.whatsapp_dono;\nif (casa.evolution_instancia) memoria.instancia = casa.evolution_instancia;\nconst rem = casa.email_remetente || 'GLAM House <ingressos@glamhouse.com.br>';\nconst inst = casa.evolution_instancia || 'glam';\nconst out = [];\nconst email = (para, assunto, titulo, corpo) => { if (emailValido(para)) out.push({ json: { canal: 'email', para, assunto, html: moldura(titulo, corpo, site), remetente: rem } }); };\nconst zap = (para, texto) => { if (zapValido(para)) out.push({ json: { canal: 'whatsapp', para: String(para).replace(/\\D/g, ''), texto, instancia: inst } }); };\nconst itens = r.itens || [];\n\nif (r.acao === 'pix-pendentes') {\n  for (const p of itens) {\n    const nome = ((p.cliente || {}).nome || '').split(' ')[0];\n    zap(p.cliente.whatsapp, `Oi, ${nome}! \ud83d\udc9b Seu Pix para *${p.festa}* (${p.total_fmt}) ainda n\u00e3o caiu.\\nSua vaga fica reservada por mais ${p.minutos_restantes} min \u2014 finalize aqui: ${p.url}`);\n    email(p.cliente.email, `Falta pouco: seu ingresso para ${p.festa}`, 'Sua vaga est\u00e1 reservada',\n      `<p>Oi, <b>${esc(nome)}</b>! Vimos que voc\u00ea gerou o Pix de <b>${esc(p.total_fmt)}</b> para <b style=\"color:${OURO}\">${esc(p.festa)}</b>, mas o pagamento ainda n\u00e3o caiu.</p><p>A reserva vale por mais <b>${p.minutos_restantes} minutos</b>.</p><p align=\"center\" style=\"text-align:center;margin:28px 0\">${botao(p.url, 'Finalizar pagamento')}</p>`);\n  }\n}\n\nif (r.acao === 'festas-hoje') {\n  for (const d of itens) {\n    const f = d.festa || {};\n    const nome = (d.nome || '').split(' ')[0];\n    email(d.email, `\u00c9 hoje! ${f.titulo} \ud83e\udd42`, '\u00c9 hoje!',\n      `<p>Oi, <b>${esc(nome)}</b>! Hoje \u00e9 dia de <b style=\"color:${OURO}\">${esc(f.titulo)}</b>.</p><p>\ud83d\udd58 ${esc(f.hora)}<br>\ud83d\udccd ${esc(f.local || 'GLAM House')}${f.endereco ? '<br>' + esc(f.endereco) : ''}</p><p>Deixe o QR \u00e0 m\u00e3o para entrar mais r\u00e1pido:</p>${d.ingressos.map(cartaoIngresso).join('')}`);\n    zap(d.whatsapp, `\ud83e\udd42 *\u00c9 HOJE!* ${f.titulo}\\n\ud83d\udd58 ${f.hora}\\n\ud83d\udccd ${f.local || 'GLAM House'}${f.endereco ? '\\n' + f.endereco : ''}\\n\\nSeus ingressos:\\n` + d.ingressos.map((i) => `\ud83c\udf9f\ufe0f ${i.nome} \u2014 ${i.url}`).join('\\n') + `\\n\\nTe esperamos na casinha mais amada de S\u00e3o Lu\u00eds \u2728`);\n  }\n}\n\nif (r.acao === 'pos-festa') {\n  for (const f of itens) {\n    const txt = `\ud83d\udcca *Relat\u00f3rio \u2014 ${f.titulo}*\\n${f.data}\\n\\n\ud83d\udcb0 Faturamento: ${f.faturamento_fmt}\\n   Pix ${f.pix_fmt} \u00b7 Cart\u00e3o ${f.cartao_fmt} \u00b7 Balc\u00e3o ${f.balcao_fmt}\\n\ud83c\udf9f\ufe0f Ingressos: ${f.ingressos} (${f.pedidos} pedidos)\\n\ud83d\udeaa Entraram: ${f.entraram} \u00b7 Faltaram: ${f.faltaram}\\n\ud83d\udcdd Lista: ${f.lista_entraram}/${f.lista}\\n\\nCompleto: ${f.relatorio_url}`;\n    zap(casa.whatsapp_dono, txt);\n    email(casa.email_dono, `Relat\u00f3rio: ${f.titulo}`, 'Relat\u00f3rio da festa',\n      `<p><b style=\"color:${OURO}\">${esc(f.titulo)}</b> \u2014 ${esc(f.data)}</p><table width=\"100%\" style=\"font-size:14px;color:#d9d2c5\">` +\n      [['Faturamento', f.faturamento_fmt], ['Pix', f.pix_fmt], ['Cart\u00e3o', f.cartao_fmt], ['Balc\u00e3o', f.balcao_fmt], ['Ingressos', f.ingressos], ['Entraram', f.entraram], ['Faltaram', f.faltaram], ['Lista', `${f.lista_entraram}/${f.lista}`]]\n        .map(([k, v]) => `<tr><td style=\"padding:6px 0;border-bottom:1px solid #2a251f\">${k}</td><td align=\"right\" style=\"padding:6px 0;border-bottom:1px solid #2a251f\"><b>${esc(v)}</b></td></tr>`).join('') +\n      `</table><p align=\"center\" style=\"text-align:center;margin-top:24px\">${botao(f.relatorio_url, 'Relat\u00f3rio completo')}</p>`);\n  }\n}\nreturn out;\n" }
  },
  output: [{ canal: 'email', para: 'ana@exemplo.com', assunto: 'É hoje', html: '<p>oi</p>', remetente: 'GLAM <a@b.com>' }]
});

const arquivoBackup = node({
  type: 'n8n-nodes-base.convertToFile',
  version: 1.1,
  config: {
    name: 'Arquivo de Backup',
    parameters: { operation: 'toBinary', sourceProperty: 'base64', binaryPropertyName: 'backup', options: { fileName: expr('{{ $json.arquivo }}'), mimeType: 'application/json' } }
  },
  output: [{ arquivo: 'glam-backup.json' }]
});

const enviarBackup = node({
  type: 'n8n-nodes-base.emailSend',
  version: 2.1,
  config: {
    name: 'Enviar Backup ao Dono',
    retryOnFail: true,
    parameters: {
      operation: 'send',
      fromEmail: expr('{{ $("Gerar Backup").item.json.casa.email_remetente }}'),
      toEmail: expr('{{ $("Gerar Backup").item.json.casa.email_dono }}'),
      subject: expr('Cópia de segurança GLAM — {{ $("Gerar Backup").item.json.arquivo }}'),
      emailFormat: 'text',
      text: expr('Cópia de segurança diária do sistema de ingressos (fora do servidor). Registros: {{ JSON.stringify($("Gerar Backup").item.json.resumo) }}. CPFs seguem criptografados.'),
      options: { appendAttribution: false, attachments: 'backup' }
    },
    credentials: { smtp: newCredential('Resend SMTP (GLAM)') }
  },
  output: [{ accepted: ['dono@exemplo.com'] }]
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

export default workflow('glam-rotinas', 'GLAM | Rotinas')
  .add(cadaTres).to(buscarPix).to(montarRotinas)
  .add(dezHoras).to(buscarHoje).to(montarRotinas)
  .add(onzeHoras).to(buscarOntem).to(montarRotinas)
  .add(montarRotinas).to(rotearCanal.onCase(0, enviarEmail).onCase(1, enviarWhatsapp))
  .add(cadaCinco).to(verificarSite).to(detectarQueda).to(enviarWhatsapp)
  .add(quatroHoras).to(gerarBackup).to(arquivoBackup).to(enviarBackup);
