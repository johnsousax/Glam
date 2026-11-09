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
