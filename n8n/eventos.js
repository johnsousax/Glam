const b = $input.first().json.body || $input.first().json;
const site = String(b.site_url || 'https://glam-ingressos.vercel.app');
const casa = b.casa || {};
const rem = casa.email_remetente || 'GLAM House <ingressos@glamhouse.com.br>';
const inst = casa.evolution_instancia || 'glam';
const out = [];
const email = (para, assunto, titulo, corpo) => { if (emailValido(para)) out.push({ json: { canal: 'email', para, assunto, html: moldura(titulo, corpo, site), remetente: rem } }); };
const zap = (para, texto) => { if (zapValido(para)) out.push({ json: { canal: 'whatsapp', para: String(para).replace(/\D/g, ''), texto, instancia: inst } }); };

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
return out;
