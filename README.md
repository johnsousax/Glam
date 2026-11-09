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

## Situação da instalação

Já feito automaticamente:
- Banco (tabelas `glam_*`, segurança, auditoria, rotinas agendadas no pg_cron com segredo no Vault).
- Conta do dono vinculada ao login existente de lucasbenicio3110@gmail.com (mesma senha); 2 etapas pedida no 1º acesso.
- n8n: **GLAM | Eventos do site** (WhatsApp + alerta de site fora do ar) e **GLAM | Conexão do WhatsApp**, ativos, com endereços secretos.
- Vercel: todas as variáveis, exceto as duas abaixo.

Falta:
1. `SUPABASE_SERVICE_ROLE_KEY` na Vercel (chave secreta do Supabase).
2. `PAGBANK_TOKEN` na Vercel (sem ele o site fica em modo demonstração).
3. No painel › Configurações › WhatsApp da casa: “Conectar WhatsApp” e ler o QR com o celular da GLAM.
4. Opcional: e-mails — criar conta no Resend, credencial SMTP no n8n e reativar o nó “Enviar E-mail”.

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
