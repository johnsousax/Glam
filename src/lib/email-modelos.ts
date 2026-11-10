// @ts-nocheck
// Modelos de e-mail (HTML dourado) — os mesmos do fluxo do n8n, agora enviados pelo próprio site.
// Fonte: n8n/modelos.js + n8n/eventos.js (mantenha em sincronia).
import "server-only";

export type EmailMontado = { para: string; assunto: string; html: string; anexos?: { nome: string; base64: string; tipo: string }[] };

// Modelos compartilhados de e-mail (HTML dourado) e WhatsApp — usados nos dois fluxos.
const OURO = '#d4af6a';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const emailValido = (e) => !!e && /^\S+@\S+\.\S+$/.test(e) && !/@glam\.local$/i.test(e);
const zapValido = (n) => !!n && String(n).replace(/\D/g, '').length >= 12;
const botao = (url, txt) => `<a href="${esc(url)}" style="display:inline-block;background:linear-gradient(115deg,#9c7a3c,#d4af6a,#f3dca6,#c9a05a);color:#1a1408;text-decoration:none;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:12px;padding:14px 28px;border-radius:999px">${esc(txt)}</a>`;
function moldura(titulo, corpo, site) {
  return `<!doctype html><html><body style="margin:0;background:#0a0908;font-family:Helvetica,Arial,sans-serif;color:#f5efe4">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0908;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#12100e;border:1px solid #3a3022;border-radius:20px;overflow:hidden">
<tr><td style="height:4px;background:linear-gradient(90deg,#9c7a3c,#f3dca6,#9c7a3c)"></td></tr>
<tr><td align="center" style="padding:32px 28px 8px"><img src="${site}/logo-dourado.png" width="140" alt="GLAM" style="display:block"></td></tr>
<tr><td align="center" style="padding:8px 28px 0;font-family:Georgia,serif;font-size:28px;color:#f5efe4">${titulo}</td></tr>
<tr><td style="padding:20px 28px 32px;font-size:15px;line-height:1.6;color:#d9d2c5">${corpo}</td></tr>
<tr><td align="center" style="padding:18px;border-top:1px solid #2a251f;font-size:11px;letter-spacing:2px;color:#a39d92">GLAM HOUSE · A CASINHA MAIS AMADA DE SÃO LUÍS</td></tr>
</table></td></tr></table></body></html>`;
}
function cartaoIngresso(i) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #3a3022;border-radius:16px;background:#1b1815"><tr>
<td style="padding:16px" width="150"><img src="${esc(i.qr_url)}" width="140" height="140" alt="QR" style="display:block;background:#fff;border-radius:10px;padding:6px"></td>
<td style="padding:16px;vertical-align:middle"><div style="font-family:Georgia,serif;font-size:20px;color:#f5efe4">${esc(i.nome)}</div>
<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${OURO};margin:4px 0 12px">${esc(i.setor)} · ${esc(i.lote)}</div>
<a href="${esc(i.url)}" style="color:${OURO};font-size:13px">Abrir ingresso →</a></td></tr></table>`;
}

export function montarEmails(b: any, siteUrl: string): EmailMontado[] {
  const site = String(b.site_url || siteUrl);
  const casa = b.casa || {};
  const out: EmailMontado[] = [];
  const email = (para, assunto, titulo, corpo) => { if (emailValido(para)) out.push({ para, assunto, html: moldura(titulo, corpo, site) }); };
  const zap = (..._: unknown[]) => {};

if (b.evento === 'pedido_pago') {
  const f = b.festa || {}, c = b.cliente || {}, ings = b.ingressos || [];
  const corpo = `<p>Oi, <b>${esc((c.nome || '').split(' ')[0])}</b>! Seu pagamento foi aprovado e seus ingressos estão garantidos ✨</p>
<p style="margin:0"><b style="color:${OURO}">${esc(f.titulo)}</b><br>${esc(f.data)} · ${esc(f.hora)}<br>${esc(f.local || '')}${f.endereco ? ' — ' + esc(f.endereco) : ''}</p>
${ings.map(cartaoIngresso).join('')}
<p style="font-size:13px;color:#a39d92">Pedido <b>${esc(b.pedido.codigo)}</b> · ${esc(b.pedido.total_fmt)}. Cada QR entra uma vez só — não compartilhe print. Você pode transferir um ingresso pela página dele.</p>
<p align="center" style="text-align:center;margin-top:24px">${botao(b.meus_ingressos_url || site + '/meus-ingressos', 'Meus ingressos')}</p>`;
  email(c.email, (b.reenvio ? '[Reenvio] ' : '') + `Seus ingressos para ${f.titulo} ✨`, 'Ingressos confirmados', corpo);
  zap(c.whatsapp, `✨ *GLAM* — pagamento aprovado!\n\nOi, ${(c.nome || '').split(' ')[0]}! Seus ingressos para *${f.titulo}* estão garantidos.\n📅 ${f.data} · ${f.hora}\n📍 ${f.local || 'GLAM House'}\n\n` +
    ings.map((i, n) => `🎟️ ${n + 1}. ${i.nome} — ${i.setor}\n${i.url}`).join('\n\n') +
    `\n\nPedido ${b.pedido.codigo}. Mostre o QR na portaria — cada um entra uma vez só. Te esperamos! 🥂`);
}

if (b.evento === 'acesso_link') {
  zap(b.whatsapp, `🔐 *GLAM* — seu link para ver os ingressos (vale 30 min):\n${b.link}\n\nSe não foi você que pediu, ignore.`);
  email(b.email, 'Seu acesso aos ingressos GLAM', 'Meus ingressos',
    `<p>Use o botão abaixo para ver seus ingressos. O link vale por <b>30 minutos</b>.</p><p align="center" style="text-align:center;margin:28px 0">${botao(b.link, 'Ver meus ingressos')}</p><p style="font-size:12px;color:#a39d92">Se não foi você que pediu, ignore este e-mail.</p>`);
}

if (b.evento === 'ingresso_transferido') {
  const p = b.para || {}, f = b.festa || {}, i = b.ingresso || {};
  email(p.email, `${b.de} te enviou um ingresso para ${f.titulo} ✨`, 'Você ganhou um ingresso',
    `<p>Oi, <b>${esc((p.nome || '').split(' ')[0])}</b>! <b>${esc(b.de)}</b> transferiu um ingresso para você.</p><p><b style="color:${OURO}">${esc(f.titulo)}</b><br>${esc(f.data)} · ${esc(f.hora)}<br>${esc(f.local || '')}</p>` +
    cartaoIngresso({ nome: p.nome, setor: i.setor, lote: i.lote, url: i.url, qr_url: i.qr_url }));
  zap(p.whatsapp, `✨ *GLAM* — ${b.de} te enviou um ingresso para *${f.titulo}*!\n📅 ${f.data} · ${f.hora}\n\nSeu QR: ${i.url}`);
}

if (b.evento === 'lote_esgotado') {
  const l = b.lote || {}, f = b.festa || {};
  const txt = `🔥 *Lote esgotado*\n${f.titulo || ''}\n${l.setor} · ${l.nome} (${l.capacidade} unidades)\n\nO próximo lote já entrou à venda (se cadastrado). Painel: ${site}/admin`;
  zap(casa.whatsapp_dono, txt);
  email(casa.email_dono, `Lote esgotado: ${l.setor} · ${l.nome}`, 'Lote esgotado 🔥', `<p><b>${esc(f.titulo || '')}</b><br>${esc(l.setor)} · ${esc(l.nome)} — ${esc(l.capacidade)} unidades vendidas.</p><p align="center" style="text-align:center">${botao(site + '/admin/festas', 'Abrir painel')}</p>`);
}
if (b.evento === 'alerta_seguranca') {
  zap(casa.whatsapp_dono, b.texto);
  email(casa.email_dono, 'Alerta de segurança — GLAM', 'Alerta de segurança', `<p>${esc(b.texto)}</p><p style="font-size:12px;color:#a39d92">Enviado automaticamente pelo sistema de ingressos.</p>`);
}
if (b.evento === 'pix_lembrete') {
  const c = b.cliente || {};
  const nome = (c.nome || '').split(' ')[0];
  zap(c.whatsapp, `Oi, ${nome}! 💛 Seu Pix para *${b.festa}* (${b.total_fmt}) ainda não caiu.\nSeu ingresso fica reservado por mais ${b.minutos_restantes} min — finalize aqui: ${b.url}`);
  email(c.email, `Falta pouco: seu ingresso para ${b.festa}`, 'Seu ingresso está reservado',
    `<p>Oi, <b>${esc(nome)}</b>! Vimos que você gerou o Pix de <b>${esc(b.total_fmt)}</b> para <b style="color:${OURO}">${esc(b.festa)}</b>, mas o pagamento ainda não caiu.</p><p>A reserva vale por mais <b>${b.minutos_restantes} minutos</b>.</p><p align="center" style="text-align:center;margin:28px 0">${botao(b.url, 'Finalizar pagamento')}</p>`);
}

if (b.evento === 'e_hoje') {
  const f = b.festa || {}, ings = b.ingressos || [];
  const nome = (b.nome || '').split(' ')[0];
  email(b.email, `É hoje! ${f.titulo} 🥂`, 'É hoje!',
    `<p>Oi, <b>${esc(nome)}</b>! Hoje é dia de <b style="color:${OURO}">${esc(f.titulo)}</b>.</p><p>🕘 ${esc(f.hora)}<br>📍 ${esc(f.local || 'GLAM House')}${f.endereco ? '<br>' + esc(f.endereco) : ''}</p><p>Deixe o QR à mão para entrar mais rápido:</p>${ings.map(cartaoIngresso).join('')}`);
  zap(b.whatsapp, `🥂 *É HOJE!* ${f.titulo}\n🕘 ${f.hora}\n📍 ${f.local || 'GLAM House'}${f.endereco ? '\n' + f.endereco : ''}\n\nSeus ingressos:\n` + ings.map((i) => `🎟️ ${i.nome} — ${i.url}`).join('\n') + `\n\nTe esperamos na casinha mais amada de São Luís ✨`);
}

if (b.evento === 'relatorio') {
  const f = b.festa || {};
  const txt = `📊 *Relatório — ${f.titulo}*\n${f.data}\n\n💰 Faturamento: ${f.faturamento_fmt}\n   Pix ${f.pix_fmt} · Cartão ${f.cartao_fmt} · Balcão ${f.balcao_fmt}\n🎟️ Ingressos: ${f.ingressos} (${f.pedidos} pedidos)\n🚪 Entraram: ${f.entraram} · Faltaram: ${f.faltaram}\n📝 Lista: ${f.lista_entraram}/${f.lista}\n\nCompleto: ${f.relatorio_url}`;
  zap(casa.whatsapp_dono, txt);
  email(casa.email_dono, `Relatório: ${f.titulo}`, 'Relatório da festa',
    `<p><b style="color:${OURO}">${esc(f.titulo)}</b> — ${esc(f.data)}</p><table width="100%" style="font-size:14px;color:#d9d2c5">` +
    [['Faturamento', f.faturamento_fmt], ['Pix', f.pix_fmt], ['Cartão', f.cartao_fmt], ['Balcão', f.balcao_fmt], ['Ingressos', f.ingressos], ['Entraram', f.entraram], ['Faltaram', f.faltaram], ['Lista', `${f.lista_entraram}/${f.lista}`]]
      .map(([k, v]) => `<tr><td style="padding:6px 0;border-bottom:1px solid #2a251f">${k}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #2a251f"><b>${esc(v)}</b></td></tr>`).join('') +
    `</table><p align="center" style="text-align:center;margin-top:24px">${botao(f.relatorio_url, 'Relatório completo')}</p>`);
}

if (b.evento === 'backup' && emailValido(casa.email_dono) && b.base64) {
  out.push({
    para: casa.email_dono, assunto: `Cópia de segurança GLAM — ${b.arquivo}`,
    html: moldura('Cópia de segurança', `<p>Backup diário do sistema de ingressos (fora do servidor). Registros: ${esc(JSON.stringify(b.resumo || {}))}. CPFs seguem criptografados.</p>`, site),
    anexos: [{ nome: b.arquivo, base64: b.base64, tipo: 'application/json' }],
  });
}
  return out;
}
