const r = $input.first().json || {};
const site = 'https://glam-ingressos.vercel.app';
const casa = r.casa || {};
const memoria = $getWorkflowStaticData('global');
if (casa.whatsapp_dono) memoria.whatsapp_dono = casa.whatsapp_dono;
if (casa.evolution_instancia) memoria.instancia = casa.evolution_instancia;
const rem = casa.email_remetente || 'GLAM House <ingressos@glamhouse.com.br>';
const inst = casa.evolution_instancia || 'glam';
const out = [];
const email = (para, assunto, titulo, corpo) => { if (emailValido(para)) out.push({ json: { canal: 'email', para, assunto, html: moldura(titulo, corpo, site), remetente: rem } }); };
const zap = (para, texto) => { if (zapValido(para)) out.push({ json: { canal: 'whatsapp', para: String(para).replace(/\D/g, ''), texto, instancia: inst } }); };
const itens = r.itens || [];

if (r.acao === 'pix-pendentes') {
  for (const p of itens) {
    const nome = ((p.cliente || {}).nome || '').split(' ')[0];
    zap(p.cliente.whatsapp, `Oi, ${nome}! 💛 Seu Pix para *${p.festa}* (${p.total_fmt}) ainda não caiu.\nSua vaga fica reservada por mais ${p.minutos_restantes} min — finalize aqui: ${p.url}`);
    email(p.cliente.email, `Falta pouco: seu ingresso para ${p.festa}`, 'Sua vaga está reservada',
      `<p>Oi, <b>${esc(nome)}</b>! Vimos que você gerou o Pix de <b>${esc(p.total_fmt)}</b> para <b style="color:${OURO}">${esc(p.festa)}</b>, mas o pagamento ainda não caiu.</p><p>A reserva vale por mais <b>${p.minutos_restantes} minutos</b>.</p><p align="center" style="text-align:center;margin:28px 0">${botao(p.url, 'Finalizar pagamento')}</p>`);
  }
}

if (r.acao === 'festas-hoje') {
  for (const d of itens) {
    const f = d.festa || {};
    const nome = (d.nome || '').split(' ')[0];
    email(d.email, `É hoje! ${f.titulo} 🥂`, 'É hoje!',
      `<p>Oi, <b>${esc(nome)}</b>! Hoje é dia de <b style="color:${OURO}">${esc(f.titulo)}</b>.</p><p>🕘 ${esc(f.hora)}<br>📍 ${esc(f.local || 'GLAM House')}${f.endereco ? '<br>' + esc(f.endereco) : ''}</p><p>Deixe o QR à mão para entrar mais rápido:</p>${d.ingressos.map(cartaoIngresso).join('')}`);
    zap(d.whatsapp, `🥂 *É HOJE!* ${f.titulo}\n🕘 ${f.hora}\n📍 ${f.local || 'GLAM House'}${f.endereco ? '\n' + f.endereco : ''}\n\nSeus ingressos:\n` + d.ingressos.map((i) => `🎟️ ${i.nome} — ${i.url}`).join('\n') + `\n\nTe esperamos na casinha mais amada de São Luís ✨`);
  }
}

if (r.acao === 'pos-festa') {
  for (const f of itens) {
    const txt = `📊 *Relatório — ${f.titulo}*\n${f.data}\n\n💰 Faturamento: ${f.faturamento_fmt}\n   Pix ${f.pix_fmt} · Cartão ${f.cartao_fmt} · Balcão ${f.balcao_fmt}\n🎟️ Ingressos: ${f.ingressos} (${f.pedidos} pedidos)\n🚪 Entraram: ${f.entraram} · Faltaram: ${f.faltaram}\n📝 Lista: ${f.lista_entraram}/${f.lista}\n\nCompleto: ${f.relatorio_url}`;
    zap(casa.whatsapp_dono, txt);
    email(casa.email_dono, `Relatório: ${f.titulo}`, 'Relatório da festa',
      `<p><b style="color:${OURO}">${esc(f.titulo)}</b> — ${esc(f.data)}</p><table width="100%" style="font-size:14px;color:#d9d2c5">` +
      [['Faturamento', f.faturamento_fmt], ['Pix', f.pix_fmt], ['Cartão', f.cartao_fmt], ['Balcão', f.balcao_fmt], ['Ingressos', f.ingressos], ['Entraram', f.entraram], ['Faltaram', f.faltaram], ['Lista', `${f.lista_entraram}/${f.lista}`]]
        .map(([k, v]) => `<tr><td style="padding:6px 0;border-bottom:1px solid #2a251f">${k}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #2a251f"><b>${esc(v)}</b></td></tr>`).join('') +
      `</table><p align="center" style="text-align:center;margin-top:24px">${botao(f.relatorio_url, 'Relatório completo')}</p>`);
  }
}
return out;
