# Relatório de segurança — GLAM House · Sistema de Ingressos

Auditoria contra o `SECURITY.md` (Prompt Coringa — Segurança Máxima) · novembro de 2026.

## 1. Tipo de sistema e seções aplicadas
**Ingressos com pagamento** (tabela do padrão: "Delivery, loja, ingressos, rifa"), mais **n8n e WhatsApp**.
Seções aplicadas: todas, exceto Jogos e Apps mobile, com **Pagamentos reforçado**.

## 2. Modelo de ameaças (STRIDE resumido)
| Ameaça | Quem / como | Camada que bloqueia |
|---|---|---|
| Falsificar pagamento (S/T) | cliente chama "confirmar" ou forja aviso do PagBank | ingresso só sai após consulta à API do PagBank; token secreto no webhook; valor pago = total |
| Mudar preço (T) | cliente edita preço/total no navegador | preço e desconto recalculados no banco (`glam_criar_pedido_v2`); Zod `strictObject` recusa campos extras |
| Esgotar o estoque com reservas falsas (D) | robô cria pedidos sem pagar | limite por IP/CPF/WhatsApp, máx. 3 reservas abertas por cliente, reserva expira em 15 min |
| Copiar/adivinhar QR (S) | print ou QR sequencial | QR de 144 bits aleatórios, entra uma vez só (`glam_checkin` atômico), transferência gera QR novo |
| Roubar dados de cliente (I) | ler outro pedido/ingresso | QR do pedido só no aparelho do comprador (cookie httpOnly); "Meus ingressos" por link de 30 min; RLS fechado |
| Invadir o painel (E) | força bruta, sessão roubada | Supabase Auth, MFA obrigatório (dono/gerente/financeiro), limite 5 tentativas, cookies httpOnly+Strict, 30 min ocioso |
| Abuso interno (R) | funcionário cancela/dá cortesia/muda preço | níveis de acesso + registro de ações imutável (trigger bloqueia update/delete) |
| XSS/clickjacking (T) | script injetado | CSP com nonce, `frame-ancestors 'none'`, React escapa tudo, sem `dangerouslySetInnerHTML` |

## 3. Dados
- **Público:** festas, lotes, preços, cartazes.
- **Interno:** pedidos, faturamento, equipe, auditoria.
- **Pessoal (LGPD):** nome, e-mail, WhatsApp, nomes de acompanhantes.
- **Sensível/financeiro:** CPF (AES-256-GCM + índice cego HMAC com subchave separada); cartão nunca passa pelo servidor.

## 4. O que foi implementado
**Autenticação:** Supabase Auth; login, MFA e troca de senha só no servidor; cookies `httpOnly`, `Secure`, `SameSite=Strict`; senha ≥ 12; MFA TOTP obrigatório para dono, gerente e financeiro; limite 5 tentativas/15 min por conta e 10 por IP, com alerta ao dono; mensagem neutra; reautenticação (senha atual) para trocar senha, derrubando as outras sessões; sessão do painel expira com 30 min ocioso; Turnstile opcional; criação do dono protegida por código de instalação; só contas da tabela `glam_staff` entram (Auth é compartilhado com outros sistemas).
**Autorização:** toda página/ação/API do painel passa por `exigirStaff(recurso)` / `staffDaApi`; papéis só no banco; listas brancas de campos; bloqueio de membro vale na hora.
**Banco:** RLS ativo em 100% das tabelas `glam_*`, sem policies (anon/authenticated sem acesso, inclusive `revoke`); funções `security definer` com `execute` só para `service_role`; reserva atômica com `for update`; idempotência (`Idempotency-Key`); cupom com limite total e por cliente; auditoria imutável + trilha automática por trigger (staff, config, lotes, cupons); limpeza horária.
**API:** Zod `strictObject` + teto de 1 MB; checagem de `Origin` (CSRF) em todos os POST; rate limit no Postgres (falha fechado); erros genéricos com código de rastreio; comparação de segredos em tempo constante; parâmetros de busca saneados; e-mails comparados exatamente (sem curinga).
**Pagamentos:** total recalculado no servidor; webhook com token secreto na URL, `x-authenticity-token` conferido, evento processado uma vez, reconsulta à API; valor pago ≠ total → pedido em revisão + alerta; cartão criptografado no navegador pelo SDK do PagBank.
**Frontend:** CSP com nonce por requisição (`strict-dynamic`, sem `unsafe-eval` em produção), HSTS preload, `X-Frame-Options: DENY`, COOP, `Permissions-Policy` (só câmera para a portaria), sem `X-Powered-By`, sem source maps; Pixel da Meta só depois do aceite (banner com "Recusar"); honeypot nos formulários públicos.
**Uploads:** cartaz conferido pelos bytes reais (JPG/PNG/WEBP), máx. 5 MB, reprocessado no servidor (remove EXIF/GPS), salvo como WEBP com nome UUID. Bucket público de propósito: cartaz é conteúdo público.
**LGPD:** política de privacidade e termos versionados; exportar e excluir os próprios dados em "Meus ingressos"; consentimento de cookies; CPF nunca exibido.
**n8n/WhatsApp:** webhook com Header Auth; segredos só em Credentials; alertas de segurança e de site fora do ar para o dono; backup diário por e-mail.

## 5. O que depende de você
1. **Vercel:** criar `SUPABASE_SERVICE_ROLE_KEY` e `PAGBANK_TOKEN` (sensitive). Usar o `GLAM_SETUP_TOKEN` uma vez em `/admin/setup`.
2. **Supabase (Auth › Settings):** ligar *Leaked password protection* e definir senha mínima 12. Ativar MFA na sua conta do Supabase.
3. **MFA** em Vercel, Supabase, GitHub, n8n, PagBank, registrador do domínio e e-mail.
4. **n8n:** credenciais "GLAM Segredo (x-glam-secret)" e "Resend SMTP (GLAM)"; escolher a instância Evolution da GLAM; ativar os dois fluxos.
5. **Opcional recomendado:** Cloudflare Turnstile (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`), Firewall da Vercel com rate limit na borda, domínio próprio com SPF/DKIM/DMARC e CAA.
6. Preencher na página de privacidade o e-mail do responsável pelos dados (vem de "E-mail do dono" em Configurações).

## 6. Riscos que sobraram
| Risco | Por quê | Como reduzir |
|---|---|---|
| Banco compartilhado com outros sistemas (projeto "Fluxo zero") | limite do plano gratuito | migrar para projeto próprio (Supabase Pro, previsto na proposta) — tudo está em `supabase/migrations/` |
| Alertas do Supabase em funções `crm_*`, `gi_*` e na extensão `pg_net` | são de outros sistemas, não da GLAM | revisar nesses projetos (revogar `execute` de `anon`) |
| Sem PITR/backup do provedor (plano gratuito) | só o backup diário por e-mail | Supabase Pro + PITR; testar restauração mensal |
| WhatsApp não oficial (Evolution) | risco de banimento/sessão | número reserva; API key forte; VPS com firewall |
| Base offline da portaria no celular | contém hashes e nomes dos titulares | usar só aparelhos da casa; limpar dados do navegador após a festa |
| Retenção de logs de acesso por 6 meses | logs da Vercel têm prazo curto no plano atual | Log Drain da Vercel para armazenamento próprio |

## 7. Checklist de deploy
- [x] RLS em 100% das tabelas `glam_*`; Security Advisor sem alerta das tabelas/funções da GLAM
- [x] Usuário A não lê dado do B (QR só no aparelho do comprador; links com token; e-mail exato)
- [x] Quem não é da equipe recebe 401/redirect em todas as rotas do painel e da portaria (testado)
- [x] Nenhum segredo no frontend ou no Git (só `NEXT_PUBLIC_*` com chave anon)
- [x] Preço, total e status de pagamento só no servidor
- [x] Webhook com token, idempotência e reconsulta ao gateway
- [x] Rate limit em login, MFA, pedido, pagamento, transferência, link de acesso e LGPD
- [ ] MFA nas contas de infraestrutura — **depende de você**
- [x] Cabeçalhos de segurança ativos (CSP com nonce, HSTS, XFO, COOP)
- [x] Upload com tipo real, tamanho máximo e reprocessamento (bucket público justificado)
- [x] Erros sem stack trace; logs sem senha, token ou CPF
- [ ] Backup do provedor + restauração testada — backup diário por e-mail ativo; PITR **depende do plano**
- [x] `npm audit` sem vulnerabilidades (0 encontradas)
- [x] Política de privacidade, termos e consentimento de cookies/pixel publicados
- [x] Alertas: login errado em massa, valor divergente, site fora do ar
- [x] Preview protegido (Vercel Authentication); produção com chaves próprias

## Clientes e disparos (10/11/2026)
- `/admin/clientes`, ficha e CSV exigem `exigirStaff("clientes")` (dono e gerente); exportação fica na auditoria.
- `glam_clientes_resumo` é `security definer` com `search_path` fixo e só `service_role` executa; `glam_disparos` com RLS fechado.
- Disparos só para quem marcou "quero receber novidades" no checkout (consentimento com data em `marketing_em`, LGPD).
- Todo disparo leva link de descadastro assinado (HMAC) e cabeçalho `List-Unsubscribe`; `/descadastrar` só aceita token válido.
- CSV neutraliza células que começam com `= + - @` (injeção de fórmula).
