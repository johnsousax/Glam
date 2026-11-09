# GLAM House · Sistema de Ingressos

Site próprio de venda de ingressos da GLAM ("a casinha mais amada de São Luís"):
vitrine de festas, Pix e cartão pelo PagBank, ingresso com QR, portaria offline,
painel da casa e automações no n8n (e-mail + WhatsApp).

**Produção:** https://glam-ingressos.vercel.app · **Painel:** `/admin` · **Portaria:** `/portaria`

## Arquitetura

| Parte | Onde |
|---|---|
| Site, painel, portaria e API | Next.js 16 na Vercel (`glam-ingressos`, região São Paulo) |
| Banco | Supabase (projeto "Fluxo zero"), tabelas `glam_*`, RLS fechado, só o servidor acessa |
| Pagamentos | API de Pedidos do PagBank (Pix + cartão criptografado no navegador) |
| Automações | n8n: **GLAM \| Eventos do site** e **GLAM \| Rotinas** (exportados em `n8n/`) |
| E-mail | Resend via SMTP (no n8n) |
| WhatsApp | Evolution API (no n8n) |

### Segurança
Padrão completo em `SECURITY.md` e relatório da auditoria em `docs/RELATORIO-SEGURANCA.md`.

- Reserva atômica no banco (`glam_criar_pedido` com trava): sem venda acima da lotação.
- Ingresso só é emitido depois que o PagBank confirma (o aviso do PagBank é reconsultado na API).
- QR = 144 bits aleatórios; transferir gera um QR novo e o antigo deixa de valer.
- CPF criptografado (AES-256-GCM) + hash para busca (LGPD).
- Equipe com senha + verificação em 2 etapas (TOTP), níveis: dono, gerente, financeiro, portaria.
- Registro de ações: cancelamentos, cortesias, mudanças de preço etc.
- Backup diário por e-mail (rotina do n8n).

## Para colocar 100% no ar

1. **Supabase → Vercel:** copie a chave `service_role` (Supabase › Project Settings › API Keys)
   e crie a variável `SUPABASE_SERVICE_ROLE_KEY` no projeto `glam-ingressos` da Vercel. Redeploy.
2. **Primeiro acesso:** abra `/admin/setup` e crie a conta do dono usando o código de instalação
   (variável `GLAM_SETUP_TOKEN` na Vercel). Ative a verificação em 2 etapas logo no primeiro login (obrigatória). Depois, em `/admin/config`,
   preencha WhatsApp do dono, e-mail do dono, remetente e a instância do Evolution.
3. **PagBank:** gere o token (PagBank › Integrações) e crie `PAGBANK_TOKEN` na Vercel.
   Comece com `PAGBANK_ENV=sandbox`; para vender de verdade troque para `production`.
   Sem token o site funciona em **modo demonstração** (botão "Simular pagamento").
4. **n8n** (os dois fluxos já estão criados, desativados):
   - Credencial **Header Auth** "GLAM Segredo (x-glam-secret)": nome `x-glam-secret`,
     valor = `GLAM_AUTOMACAO_SECRET` da Vercel. Use nos nós Webhook e HTTP.
   - Credencial **SMTP** "Resend SMTP (GLAM)": host `smtp.resend.com`, porta 465, SSL,
     usuário `resend`, senha = API key do Resend (domínio do remetente verificado no Resend).
   - Nos nós **Enviar WhatsApp**, escolha a credencial da Evolution onde está a instância da GLAM.
   - Confira o fuso do n8n (Settings › Timezone = America/Sao_Paulo) e publique os dois fluxos.
5. **Domínio:** adicione o domínio da GLAM no projeto da Vercel e atualize `NEXT_PUBLIC_SITE_URL`
   (e as URLs dos nós HTTP do fluxo de rotinas).

## Variáveis de ambiente
Veja `.env.example`.

## Desenvolvimento
```bash
npm install
cp .env.example .env.local   # preencha
npm run dev
```
Migrações do banco: `supabase/migrations/`.

O antigo redirecionamento para o WhatsApp do "Baile das Atléticas" continua em `/baile`.
