# GLAM House · Estrutura completa do sistema

Site de venda de ingressos da GLAM ("a casinha mais amada de São Luís"): vitrine de festas,
Pix e cartão (PagBank), ingresso com QR, portaria, painel da casa e automações (n8n + WhatsApp).

- **Site:** https://glam-ingressos.vercel.app · **Painel:** `/admin` · **Portaria:** `/portaria`
- **Código:** GitHub `johnsousax/Glam`, branch `ccr-4f84f32e-w83i8g`

---

## 1. Visão geral (como as peças se conectam)

```
                   ┌──────────────────────────────┐
  Cliente ───────▶ │  SITE (Next.js 16 · Vercel)  │ ◀─────── Equipe (painel /admin, portaria)
  (celular)        │  páginas + APIs + proxy.ts   │
                   └──┬─────────┬──────────┬──────┘
         service role │         │ HTTPS    │ POST (endereço secreto)
                      ▼         ▼          ▼
            ┌──────────────┐ ┌─────────┐ ┌──────────────────────────────┐
            │  SUPABASE    │ │ PAGBANK │ │ n8n                          │
            │  Postgres +  │ │ Pix e   │ │ • GLAM | Eventos do site     │──▶ Evolution API ──▶ WhatsApp
            │  Auth +      │ │ cartão  │ │ • GLAM | Conexão do WhatsApp │──▶ (Resend SMTP ──▶ e-mail, desligado)
            │  Storage     │ └────┬────┘ └──────────────────────────────┘
            │  pg_cron     │      │ aviso de pagamento (webhook com token)
            │  Vault       │      └──────────────▶ SITE /api/webhooks/pagbank
            └──────┬───────┘
                   │ pg_cron + pg_net (com segredo do Vault)
                   └──────────────▶ SITE /api/n8n/<rotina> ──▶ n8n (avisos prontos)
```

**Fluxo de uma compra**
1. Cliente escolhe festa/lote → `POST /api/pedidos` → banco reserva a vaga por 15 min (`glam_criar_pedido_v2`, com trava).
2. Página `/pedido/[id]` → `POST /api/pedidos/[id]/pagar` → PagBank gera Pix (ou cobra o cartão criptografado no navegador).
3. PagBank avisa `POST /api/webhooks/pagbank?k=…` (e a tela também consulta a cada 4 s).
4. O site reconsulta o PagBank, confere o valor e chama `glam_confirmar_pedido` → ingressos com QR são emitidos.
5. O site manda o evento `pedido_pago` ao n8n → WhatsApp (e e-mail, quando ligado) com os QR.
6. Na festa, a portaria lê o QR → `glam_checkin` (cada ingresso entra uma vez só).

---

## 2. Conexões e serviços

| Serviço | Para quê | Identificação |
|---|---|---|
| **Vercel** | Hospedagem do site | projeto `glam-ingressos` (`prj_84VUWzo2m2EYMwhn0YsrXpPwU8v4`), time `team_DQIq9yASIWuY62n32iKiSj2J`, região `gru1` (São Paulo) |
| **Supabase** | Banco, login da equipe, cartazes, agendamentos | projeto "Fluxo zero" `vpldivsicywvnvyczkhz` (us-east-1), tabelas `glam_*` |
| **GitHub** | Código | `johnsousax/Glam` |
| **PagBank** | Pix e cartão | API de Pedidos (`api.pagseguro.com` / sandbox) — token em `PAGBANK_TOKEN` |
| **n8n** | Automações | `https://n8n-n8n-start.qkcypa.easypanel.host` |
| **Evolution API** | WhatsApp | credencial n8n "NexusUp Company v2" (`4oWhfZxKilVJraRd`), instância `glam` |
| **Resend** (opcional) | E-mail | credencial n8n "Resend SMTP (GLAM)" — ainda não criada; nó desligado |
| **Meta Pixel** | Anúncios | `880769331739336` (só carrega após aceite de cookies) |
| **Have I Been Pwned** | Bloquear senhas vazadas | consulta por k-anonimato (sem enviar a senha) |
| **Cloudflare Turnstile** (opcional) | Anti-robô | ativa se as chaves existirem |

### Variáveis de ambiente (Vercel)

| Variável | Situação | Uso |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ✅ | endereço do site |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | chave pública (só login da equipe) |
| `SUPABASE_SERVICE_ROLE_KEY` | ⛔ falta | acesso do servidor ao banco |
| `CPF_ENCRYPTION_KEY` | ✅ sensível | criptografia do CPF (AES-256-GCM) |
| `GLAM_AUTOMACAO_SECRET` | ✅ sensível | segredo das rotinas (também no Vault do Supabase) |
| `GLAM_SETUP_TOKEN` | ✅ sensível | criação do dono em `/admin/setup` (já não é necessário) |
| `N8N_WEBHOOK_URL` | ✅ sensível | endereço secreto do fluxo de eventos |
| `N8N_WHATSAPP_URL` | ✅ sensível | endereço secreto do fluxo de conexão do WhatsApp |
| `PAGBANK_TOKEN` | ⛔ falta | token do PagBank (sem ele: modo demonstração) |
| `PAGBANK_ENV` | ✅ `sandbox` | trocar para `production` ao vender de verdade |
| `NEXT_PUBLIC_META_PIXEL_ID` | ✅ | Pixel da Meta |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | opcional | anti-robô |

---

## 3. Banco de dados (Supabase · `supabase/migrations/`)

Todas as tabelas com RLS ligado e **sem acesso para anon/authenticated** — só o servidor (service role).

| Tabela | Conteúdo |
|---|---|
| `glam_config` | dados da casa (WhatsApp, e-mail do dono, instância, comissão) |
| `glam_staff` | equipe e nível (dono, gerente, financeiro, portaria) |
| `glam_festas` | festas (cartaz, data, lotação, situação) |
| `glam_lotes` | lotes por setor, preço, quantidade, janela de venda, ordem da virada |
| `glam_cupons` | cupons (%, R$, limite total e por cliente) |
| `glam_promoters` | promoters, link e comissão |
| `glam_clientes` | compradores (CPF criptografado + índice cego) |
| `glam_pedidos` / `glam_pedido_itens` | pedidos, reserva de 15 min, idempotência, revisão |
| `glam_ingressos` | ingressos com QR aleatório, titular, entrada |
| `glam_lista` | lista de nomes (até 1.000 por festa) |
| `glam_acessos` | links de "Meus ingressos" (só o hash) |
| `glam_auditoria` | registro de ações — **imutável** (trigger bloqueia edição/exclusão) |
| `glam_notificacoes` | log dos envios ao n8n |
| `glam_limites` | limite de tentativas (rate limit) |
| `glam_webhook_eventos` | avisos do PagBank já processados |

| Função | O que faz |
|---|---|
| `glam_criar_pedido_v2` | reserva atômica (trava), preço/cupom no banco, antifraude, idempotência |
| `glam_confirmar_pedido` | confirma pagamento uma vez só e emite os ingressos |
| `glam_checkin` | entrada na portaria (uma vez só) |
| `glam_lote_ocupado`, `glam_festa_ocupada`, `glam_lotes_status` | estoque |
| `glam_resumo`, `glam_festa_contadores`, `glam_faturamento_diario` | painel e relatórios |
| `glam_limite`, `glam_registrar_evento` | segurança |
| `glam_auditar_linha`, `glam_bloquear_alteracao` | auditoria automática e imutável |
| `glam_chamar_rotina` | chama as rotinas do site com o segredo do Vault |
| `glam_expirar_pedidos`, `glam_limpeza` | manutenção |

**Agendamentos (pg_cron, horário UTC)**

| Job | Quando | Faz |
|---|---|---|
| `glam-expirar-pedidos` | a cada minuto | libera reservas vencidas |
| `glam-pix-pendentes` | a cada 3 min | lembrete de Pix não pago |
| `glam-e-hoje` | 13:00 (10h Brasília) | "É hoje" para quem tem ingresso |
| `glam-pos-festa` | 14:00 (11h Brasília) | relatório da festa de ontem ao dono |
| `glam-backup` | 07:00 (4h Brasília) | backup diário (anexo por e-mail quando ligado) |
| `glam-config-n8n` | a cada 6 h | manda ao n8n o WhatsApp do dono (alerta de queda) |
| `glam-limpeza` | de hora em hora | apaga limites e links antigos |

**Storage:** bucket público `glam-cartazes` (cartazes reprocessados em WEBP, sem EXIF).

---

## 4. Automações (n8n · `n8n/`)

| Fluxo | ID | Gatilhos | Faz |
|---|---|---|---|
| **GLAM \| Eventos do site** | `wLlhIOc6iAVPI9I0` | webhook secreto + a cada 5 min | monta e envia WhatsApp/e-mail para: `pedido_pago`, `acesso_link`, `ingresso_transferido`, `lote_esgotado`, `alerta_seguranca`, `pix_lembrete`, `e_hoje`, `relatorio`, `backup`, `config`; checa `/api/health` e avisa o dono se o site cair/voltar |
| **GLAM \| Conexão do WhatsApp** | `rXwYmkQ6ZoPTmSFA` | webhook secreto | cria a instância `glam`, gera QR, consulta status, desconecta (usado pelo painel) |
| ~~GLAM \| Rotinas~~ | `0LSe922PdkUtlqn7` | — | arquivado (substituído pelo pg_cron) |

Arquivos: `modelos.js` (modelos HTML dourados), `eventos.js` (mensagens), `queda.js` (alerta), `*.workflow.ts` (fluxos no SDK do n8n, com `<TOKEN_SECRETO>` no lugar do endereço real).

---

## 5. Código do site (`src/`)

### Páginas públicas
| Rota | Arquivo | O que é |
|---|---|---|
| `/` | `app/page.tsx` + `components/Intro.tsx` | abertura animada + vitrine de festas |
| `/festa/[slug]` | `app/festa/[slug]/page.tsx`, `Checkout.tsx` | cartaz, lotes, nomes, dados do comprador, cupom |
| `/pedido/[id]` | `app/pedido/[id]/page.tsx`, `Pagamento.tsx` | Pix (QR/copia e cola), cartão, contador de 15 min, ingressos |
| `/ingresso/[codigo]` | `app/ingresso/[codigo]/page.tsx`, `Transferir.tsx` | ingresso com QR e transferência |
| `/meus-ingressos` | `app/meus-ingressos/…` | acesso sem senha por link + exportar/excluir dados (LGPD) |
| `/privacidade`, `/termos` | `app/privacidade`, `app/termos` | textos legais |
| `/baile` | `public/baile-whatsapp.html` | redirecionamento antigo para o WhatsApp |

### Painel (`/admin`, exige login + 2 etapas)
| Rota | Arquivo | Quem acessa |
|---|---|---|
| `/admin` | `(painel)/page.tsx` | visão geral, faturamento 30 dias (dono, gerente, financeiro) |
| `/admin/festas…` | `(painel)/festas/…` | festas, lotes, lista de nomes, relatório PDF/CSV |
| `/admin/pedidos` | `(painel)/pedidos/page.tsx` | pedidos, cancelar, reenviar, revisão |
| `/admin/balcao` | `(painel)/balcao/page.tsx` | venda no balcão e cortesias |
| `/admin/cupons`, `/admin/promoters` | … | cupons e promoters com comissão |
| `/admin/equipe` | … | equipe e níveis (só dono) |
| `/admin/auditoria` | … | registro de ações |
| `/admin/config` | `config/page.tsx`, `WhatsappConexao.tsx` | dados da casa + conectar WhatsApp (QR) |
| `/admin/seguranca` | `seguranca/Mfa.tsx` | 2 etapas e troca de senha |
| `/admin/login`, `/admin/setup` | … | entrar e primeiro acesso |
| `/portaria` | `app/portaria/Leitor.tsx` | leitor de QR pela câmera, funciona offline, lista de nomes |

### APIs (`src/app/api/`)
| Rota | Método | Proteções |
|---|---|---|
| `pedidos` | POST | origem, limite IP/CPF/WhatsApp, Zod, honeypot, Turnstile, idempotência |
| `pedidos/[id]` | GET | limite; consulta o PagBank como plano B |
| `pedidos/[id]/pagar` | POST | origem, limite, Zod; cartão só criptografado |
| `pedidos/[id]/simular` | POST | só em modo demonstração e só para o comprador |
| `webhooks/pagbank` | POST | token na URL, assinatura, uma vez só, reconsulta, valor conferido |
| `ingressos/[codigo]/transferir` | POST | origem, limite, e-mail da compra |
| `meus-ingressos`, `meus-dados` | POST | origem, limite, resposta neutra |
| `portaria/base`, `portaria/checkin`, `portaria/lista` | GET/POST | login da equipe + nível |
| `n8n/[acao]` | GET/POST | segredo `x-glam-secret` (chamado pelo pg_cron) |
| `qr/[codigo]` | GET | gera a imagem do QR |
| `pagbank/chave` | GET | chave pública do cartão |
| `health` | GET | saúde do site (usado pelo alerta) |

### Bibliotecas (`src/lib/`)
| Arquivo | Responsabilidade |
|---|---|
| `supabase-admin.ts` / `supabase-server.ts` | conexão do servidor ao banco / sessão da equipe em cookie httpOnly |
| `staff.ts` | níveis de acesso, `exigirStaff`, MFA obrigatório, auditoria |
| `pedidos.ts` | confirmação de pagamento, conferência de valor, mensagens de erro |
| `pagbank.ts` | Pix, cartão, consulta e chave pública do PagBank |
| `n8n.ts` | envio de eventos ao n8n e validação do segredo |
| `seguranca.ts` | rate limit, CSRF, comparação segura, Turnstile, senha vazada, logs |
| `esquemas.ts` | validação Zod de todas as entradas |
| `crypto.ts` | AES-256-GCM do CPF, HMAC, tokens |
| `acesso-pedido.ts` | cookie do comprador (QR só no aparelho que comprou) |
| `festas.ts`, `clientes.ts`, `config.ts`, `format.ts`, `tipos.ts`, `env.ts` | regras e utilidades |
| `src/proxy.ts` | CSP com nonce, sessão do painel (30 min ociosa) |
| `next.config.ts` | cabeçalhos de segurança |

---

## 6. Documentos
- `README.md` — situação da instalação e como rodar
- `SECURITY.md` — padrão de segurança seguido
- `docs/RELATORIO-SEGURANCA.md` — auditoria, riscos e checklist
- `.env.example` — nomes das variáveis (sem valores)
