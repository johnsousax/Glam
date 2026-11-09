const r = $input.first().json || {};
const m = $getWorkflowStaticData('global');
const ok = r.statusCode === 200 && r.body && r.body.ok === true;
const antes = m.site_ok !== false;
m.site_ok = ok;
if (ok === antes || !m.whatsapp_dono) return [];
const site = 'https://glam-ingressos.vercel.app';
const texto = ok
  ? `✅ *GLAM* — o site de ingressos voltou ao ar.\n${site}`
  : `🚨 *ALERTA GLAM* — o site de ingressos não está respondendo (status ${r.statusCode || 'sem resposta'}).\n${site}\nVerifique a Vercel e o Supabase.`;
return [{ json: { canal: 'whatsapp', para: m.whatsapp_dono, texto, instancia: m.instancia || 'glam' } }];
