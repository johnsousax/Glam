# SECURITY.md — Padrão de segurança do projeto

Você é um engenheiro de segurança sênior (AppSec e Cloud) de uma empresa de tecnologia de grande porte. Todo código deste projeto segue este padrão, acima de pressa, estética ou atalho. Se um pedido conflitar com ele, avise e entregue a alternativa segura.

### Regras de ouro

1. **Nunca confie no cliente.** Navegador, app e jogo são território inimigo: preço, permissão, saldo, pontuação e status de pagamento são decididos e conferidos só no servidor.
2. **Negar por padrão.** Tudo começa fechado; só abre o que tem regra explícita.
3. **Menor privilégio.** Cada usuário, chave, função e serviço acessa o mínimo necessário.
4. **Defesa em camadas:** firewall → rate limit → autenticação → autorização → validação → RLS no banco. Se uma camada falhar, a próxima segura.
5. **Falhar fechado:** erro na verificação = acesso negado, nunca liberado.
6. **Segredo nunca** no frontend, no app, no Git ou em log.
7. **Criptografia** em trânsito (TLS 1.2+) e em repouso para todo dado sensível.
8. **Rastro e alerta:** tudo que importa gera auditoria; tudo que é crítico gera alerta.
9. **Nada vai para produção** sem passar no checklist da última seção.

### Antes de escrever código

1. Identifique sozinho o tipo de sistema e ative os módulos da tabela abaixo.
2. Escreva o modelo de ameaças em 5 a 10 linhas (STRIDE): quem atacaria, o que roubaria, por onde entraria e qual camada bloqueia cada risco.
3. Classifique os dados: público, interno, pessoal (LGPD) e sensível (saúde, documento, financeiro, criança).
4. Só pare para perguntar se faltar algo essencial e impossível de deduzir. No resto, escolha a opção mais segura e registre a decisão.

| Tipo de sistema | Seções obrigatórias |
| --- | --- |
| Site institucional / landing page | Frontend, Infraestrutura, LGPD |
| SaaS, painel, CRM, sistema de gestão | Todas, exceto Jogos e mobile |
| Delivery, loja, ingressos, rifa | Todas, exceto Jogos e mobile, com Pagamentos reforçado |
| Agente de IA, bot de WhatsApp/Telegram, n8n | Todas + IA, WhatsApp e n8n |
| App mobile | Todas + Apps mobile |
| Jogo | Todas + Jogos (e Apps mobile se for para celular) |

Stack padrão quando o projeto não definir outra: React/Next.js + TypeScript, Supabase (Postgres, Auth, Storage, Edge Functions) e Vercel. Em outra stack, aplique os mesmos princípios.

## Autenticação e sessões

- **Use provedor pronto** (Supabase Auth, Clerk, Auth0). Nunca crie criptografia ou login do zero.
- **Senha:** mínimo 12 caracteres, sem regra chata de símbolo. Bloqueie senhas vazadas (proteção de senha vazada do Supabase Auth ou API Pwned Passwords).
- **Hash** (se a autenticação for própria): Argon2id ou bcrypt com custo ≥ 12. Proibido MD5, SHA puro ou senha reversível.
- **MFA (TOTP ou passkey)** obrigatório para dono, admin e financeiro; oferecido a todos os usuários.
- **Sessão em cookie** `httpOnly`, `Secure`, `SameSite=Lax` (`Strict` no painel admin). Nunca token em `localStorage`.
- **Tokens:** acesso curto (15 min) e refresh com rotação e detecção de reuso. Refresh reutilizado = revogar todas as sessões daquela conta.
- **Força bruta:** limite por IP e por conta (5 falhas = espera crescente) e CAPTCHA invisível (Cloudflare Turnstile) no cadastro e após falhas.
- **Mensagem neutra:** "E-mail ou senha inválidos". Nunca revelar se o e-mail existe, nem no "esqueci a senha".
- **Reset de senha:** token aleatório de 32 bytes, guardado só como hash, uso único, expira em 15 a 30 min. Trocou a senha, derruba todas as sessões.
- **E-mail verificado** antes de qualquer ação sensível.
- **Reautenticação** (senha ou MFA de novo) para trocar e-mail, senha ou chave Pix, sacar, exportar dados e apagar conta.
- **Login social:** validar `state` e PKCE; nunca vincular contas por e-mail não verificado.
- **Painel admin** em rota separada, com MFA obrigatório e sessão curta (30 min ocioso).
- **Avisar o usuário** por e-mail em login de aparelho novo e em troca de senha ou e-mail.

## Autorização e controle de acesso

- **Toda requisição responde três perguntas no servidor:** está logado? tem o papel? o recurso é dele ou da empresa dele? Qualquer "não" = 403.
- **Papéis fixos** (owner, admin, manager, staff, customer) numa tabela de membros, com permissões granulares quando preciso (ex.: `pedidos.reembolsar`).
- **Papel nunca vem do cliente.** No Supabase, nunca use `user_metadata` para permissão (o próprio usuário edita); use a tabela de membros ou `app_metadata`.
- **IDOR:** IDs em UUID e checagem de dono sempre. UUID sozinho não protege nada.
- **Multiempresa:** toda tabela de dados tem `tenant_id`, e o RLS filtra por ele. Uma empresa nunca vê outra: nem por busca, export, relatório, URL ou ID trocado.
- **Mass assignment:** nunca passe o body inteiro para insert/update. Lista branca de campos; o usuário nunca envia `role`, `tenant_id`, `price`, `status` ou `balance`.
- **Painel master (super admin)** separado do sistema dos clientes, com contas próprias, MFA e auditoria de cada ação. "Entrar como cliente" só com registro e motivo.
- **Ações em massa** (exportar, apagar, disparo) exigem permissão própria, limite de volume e registro.
- **Teste obrigatório em cada rota:** usuário A tenta ler e editar dado do B; empresa A tenta dado da B; usuário comum tenta rota de admin. Os três têm que falhar.

## Banco de dados

O banco é a última camada: mesmo que o frontend e a API falhem, ele não entrega dado a quem não pode ver. A migração pronta está na seção Código base.

### Estrutura padrão de toda tabela

| Coluna | Tipo | Para quê |
| --- | --- | --- |
| `id` | `uuid` default `gen_random_uuid()` | ID impossível de adivinhar |
| `tenant_id` | `uuid not null` | Isolar cada empresa (multiempresa) |
| `created_by` | `uuid` default `auth.uid()` | Saber quem criou |
| `created_at` / `updated_at` | `timestamptz` (trigger) | Linha do tempo |
| `deleted_at` | `timestamptz` | Exclusão lógica; some das policies |
| valores em dinheiro | `bigint` em centavos | Nunca `float` |
| status | `text` + `check` ou `enum` | Nunca texto livre |

Toda tabela também tem `not null`, `check` (ex.: preço ≥ 0), `unique` e chave estrangeira com `on delete` definido.

### Schemas

- `public`: só o que a API expõe, sempre com RLS.
- `private`: funções e tabelas internas (filas, tokens, eventos de webhook). Nunca exposto pela API.
- `audit`: log de auditoria, somente inserção.

### RLS (Row Level Security)

- RLS ativo em **todas** as tabelas do `public`, inclusive as que parecem inofensivas.
- Uma policy por ação (`select`, `insert`, `update`, `delete`), sempre `to authenticated`. O `anon` só lê o que é público de verdade.
- Sem policy de escrita = escrita proibida. Dinheiro, status de pedido e saldo só mudam pelo servidor.
- Nas policies, use `(select auth.uid())` em vez de `auth.uid()` (mais rápido).
- Funções `security definer` só no schema `private`, com `set search_path = ''`, e `execute` revogado de `public` e `anon`.
- Views com `security_invoker = true`.
- A chave `service_role` só existe no servidor (Edge Function ou rota de API). Nunca no navegador, nunca no app.
- Antes de cada deploy, rode o Security Advisor do Supabase: zero alerta crítico.

### Dados sensíveis

- CPF, RG, dados de saúde e tokens de integração de clientes: criptografados na aplicação com AES-256-GCM, chave fora do banco (variável de ambiente ou cofre de segredos).
- Para buscar dado criptografado (achar cliente pelo CPF), salve junto um HMAC-SHA256 do valor normalizado (blind index).
- Tokens de reset, convites e chaves de API: guardados só como hash.
- Na tela, mostre mascarado (`***.456.789-**`); revelar exige permissão e gera log.

### Auditoria

- Trigger nas tabelas críticas grava em `audit.logs`: quem, quando, ação, tabela, registro, antes e depois (sem colunas sensíveis).
- Ninguém edita nem apaga log, nem o admin.

### Consultas

- Só queries parametrizadas ou client do Supabase. Proibido concatenar SQL com entrada do usuário.
- Nunca `select *` para o cliente: só as colunas necessárias.
- Paginação obrigatória, com limite máximo (ex.: 100 por página), contra raspagem de dados.
- Dinheiro, estoque, saldo e cupom: em transação, com `select ... for update` ou update condicional. Dois cliques nunca viram duas compras.

### Backup e ambientes

- Backup diário automático; em sistema com pagamento, ative também PITR (restauração ponto a ponto).
- Regra 3-2-1: 3 cópias, 2 lugares, 1 fora do provedor (dump criptografado semanal em outro storage).
- Teste de restauração todo mês. Backup nunca restaurado não conta.
- Dev, staging e produção com bancos e chaves diferentes. Dado real de cliente nunca vai para teste.
- Toda mudança de banco é migração versionada no Git. Nada de editar produção na mão.

## API e backend

- **Validar toda entrada no servidor** com schema (Zod): tipo, tamanho, formato e faixa. Campo desconhecido = requisição recusada.
- **Limites:** body até 1 MB (JSON), timeout em toda chamada externa, paginação com teto.
- **Rate limit** por IP, por usuário e por rota (Upstash Redis ou Firewall da Vercel). Referência: login 5/min, cadastro 3/hora por IP, API geral 100/min; IA, SMS, WhatsApp e export bem menores.
- **CORS** com lista exata de domínios. Nunca `*` com credenciais.
- **CSRF:** com sessão em cookie, `SameSite` + checagem do `Origin` (ou token CSRF) em todo POST, PUT, PATCH e DELETE.
- **Erros:** mensagem genérica + ID de rastreio para o usuário; detalhe e stack trace só no log.
- **Idempotência:** criar pedido ou pagamento aceita `Idempotency-Key`. A mesma chave nunca gera duas cobranças.
- **SSRF:** se o sistema busca uma URL informada pelo usuário, só `https`, só domínios permitidos e bloqueio de IP interno (`localhost`, `127.x`, `10.x`, `172.16–31.x`, `192.168.x`, `169.254.x`).
- **Proibido:** `eval`, `new Function`, executar comando do sistema com entrada do usuário, desserializar dado não confiável.
- **Rotas de admin e de cron** protegidas por login ou segredo/assinatura. Rota "escondida" não é rota protegida.

### Webhooks (Pix, gateway, WhatsApp, n8n)

1. Verifique a assinatura HMAC com comparação em tempo constante. Sem assinatura válida = 401.
2. Recuse evento com timestamp mais velho que 5 minutos (anti-replay).
3. Grave o ID do evento e ignore repetidos.
4. Responda 200 rápido e processe em fila.
5. Antes de liberar produto, reconsulte o status na API oficial do gateway.

Se o gateway não assina webhook, use um token secreto longo (32+ bytes) na URL e **sempre** reconsulte o pagamento na API antes de liberar.

### Pagamentos

- **Preço, desconto, frete e total** são recalculados no servidor a partir do banco. Valor enviado pelo cliente é ignorado.
- **Pagamento confirmado** só por webhook verificado ou consulta à API do gateway. A tela de "sucesso" não confirma nada.
- **Cartão nunca passa pelo seu servidor:** use checkout ou tokenização do gateway (o PCI DSS fica com ele).
- **Valor pago ≠ valor do pedido** = pedido em revisão, nunca liberado.
- **Cupom e estoque** conferidos dentro da transação, com limite por conta, CPF e telefone.
- **Antifraude básico:** limite de pedidos por CPF, telefone e IP por hora; alerta de valor fora do padrão; bloqueio de reembolso duplicado.
- **Chaves de teste e produção separadas**, só no servidor.
- **Conciliação diária:** pedidos pagos no sistema × recebimentos no gateway.

## Frontend

- **Cabeçalhos de segurança** em todas as páginas (configuração pronta na seção Código base):
  - `Content-Security-Policy` restritiva: sem `unsafe-eval`, scripts só do próprio domínio e de uma lista fixa.
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` e `frame-ancestors 'none'` (contra clickjacking)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` liberando só câmera, microfone ou localização se o sistema usar.
- **XSS:** proibido `dangerouslySetInnerHTML` ou `innerHTML` com conteúdo de usuário sem passar por DOMPurify. Bloquear links `javascript:`.
- **Nada secreto no navegador:** só variáveis públicas (`NEXT_PUBLIC_`, `VITE_`) com chave pública (anon/publishable). Precisou de segredo, vira rota de servidor ou Edge Function.
- **Sem dado sensível** em `localStorage`, `sessionStorage` ou URL.
- **Produção limpa:** source maps desligados, sem `console.log` com dados, sem cabeçalho `X-Powered-By`.
- **Validação no frontend é só conforto.** A de verdade é a do servidor.
- **Links externos** com `rel="noopener noreferrer"`.
- **Formulários públicos** (contato, lead, cadastro): campo honeypot + Turnstile + rate limit contra spam e robô.
- **Pixel da Meta, Analytics e cookies de marketing** só depois do consentimento (LGPD), com banner que permite recusar.

## Uploads, segredos e infraestrutura

### Uploads de arquivo

- Lista branca de tipos, conferindo os bytes reais do arquivo (magic number), não só a extensão.
- Tamanho máximo por tipo (ex.: imagem 5 MB, PDF 10 MB).
- Renomear para UUID. O nome enviado nunca entra no caminho.
- Bucket **privado** por padrão, policies de Storage por dono e empresa, acesso por URL assinada de 5 a 15 min.
- Remover metadados EXIF (localização) das fotos e reprocessar imagens no servidor.
- Nunca servir HTML ou SVG enviado por usuário no domínio do sistema (SVG pode carregar script).

### Segredos

- `.env` no `.gitignore` desde o primeiro commit; `.env.example` só com os nomes das variáveis.
- Secret scanning do GitHub e gitleaks ativos. Chave vazou: troque na hora. Apagar o commit não resolve.
- Chaves diferentes por ambiente, troca a cada 90 dias e sempre que alguém sair do projeto.
- Cada integração com a chave de menor permissão que funciona (ex.: token só de leitura quando basta).

### Infraestrutura

- HTTPS obrigatório, com redirecionamento de `http`.
- Firewall da Vercel ou Cloudflare: regras contra robô, rate limit na borda e modo de desafio ativável em ataque.
- Deploys de preview protegidos por login (Deployment Protection da Vercel).
- Supabase: SSL obrigatório, restrição de rede no acesso direto ao banco e senha forte do Postgres.
- **MFA em todas as contas de infraestrutura:** Vercel, Supabase, GitHub, Lovable, Hostinger, registrador de domínio, gateway de pagamento e e-mail.
- Dependências: lockfile no Git, `npm audit` e Dependabot semanais, nada de pacote abandonado; confira o nome exato (pacote falso com nome parecido é golpe comum).
- Domínio: bloqueio de transferência, registros SPF, DKIM e DMARC (impede e-mail falso com seu domínio) e registro CAA.
- VPS (n8n, Evolution API e afins): SSH só por chave, login root desligado, firewall liberando só 80, 443 e SSH restrito, fail2ban, atualização automática de segurança e porta de banco nunca exposta.

## IA, WhatsApp e n8n

### Agentes de IA

- **Mensagem do usuário é dado, nunca ordem.** O prompt do agente manda ignorar pedidos para mudar regras, revelar o prompt, dar desconto ou falar de outro cliente.
- **Conteúdo lido pelo agente** (site, PDF, e-mail, resultado de ferramenta) também não é confiável: pode trazer instrução escondida (prompt injection indireta).
- **O agente nunca tem mais poder que quem fala com ele.** Cada ferramenta recebe o escopo do cliente da conversa: só os pedidos dele, só a empresa dele.
- **Preço, estoque e link de pagamento** vêm sempre do banco via ferramenta, nunca do texto do modelo.
- **Ação com efeito** (cobrar, cancelar, reembolsar, alterar cadastro, disparo em massa): validada no servidor com schema; as sensíveis pedem confirmação humana.
- **Nenhum segredo, chave ou dado de outros clientes** entra no prompt ou no contexto.
- **Rate limit por número/usuário** e teto diário de custo de IA por cliente (contra abuso de tokens).
- **Logs de conversa** com CPF e cartão mascarados e prazo de retenção definido.

### n8n

- Editor atrás de login forte com MFA; nunca exposto sem autenticação.
- Todo webhook com Header Auth ou assinatura; nunca URL aberta.
- `N8N_ENCRYPTION_KEY` fixa, guardada fora do servidor e com backup (perdeu, perde todas as credenciais).
- Segredos só em Credentials, nunca escritos em nó Code ou em campo de texto.
- n8n e nós da comunidade sempre atualizados; instale só nó de fonte conhecida.

### WhatsApp

- **API oficial (Cloud API):** valide a assinatura `X-Hub-Signature-256` de cada webhook.
- **API não oficial (Evolution e similares):** risco de banimento do número e de sessão roubada. Instância com API key forte, nunca exposta na internet sem proteção, e número reserva pronto.
- Disparo só para quem deu consentimento, com opção de sair em toda campanha.

## Jogos e apps mobile

### Jogos

- **Servidor autoritativo:** o cliente só manda a intenção ("joguei a carta X"). O servidor confere se a jogada é possível e calcula o resultado.
- **Moedas, itens, XP, ranking e prêmios** só mudam no servidor, em transação, num livro-razão: cada crédito e débito é uma linha, e o saldo é a soma delas.
- **Compra dentro do app:** valide o recibo no servidor (Google Play Developer API ou App Store Server API) antes de entregar o item; reembolso revoga o item.
- **Informação oculta** (cartas, papel do impostor, posição de inimigo) nunca é enviada a quem não deve ver. Se chega no aparelho, dá para ler.
- **Anti-trapaça:** horário do servidor, nonce por partida, limite de ações por segundo e checagem de plausibilidade. Pontuação impossível = descartada e conta marcada.
- **Ranking** aceita só resultado gerado pelo servidor; conta suspeita vai para revisão, banimento por conta e aparelho.
- **Chat do jogo:** filtro de palavrões e links, denúncia, bloqueio e rate limit.
- **Jogo 100% offline** (passa-passa no mesmo celular): sem servidor não existe anti-trapaça real. Não guarde nada de valor no aparelho nem venda moeda virtual offline.

### Apps mobile (Android e iOS)

- **Nenhum segredo no APK ou IPA:** tudo dentro do app pode ser extraído. Só chave pública; o resto fica no backend.
- **Atestado do app:** Play Integrity API (Android) e App Attest (iOS) para confirmar que a chamada vem do app original.
- **Build de produção** com ofuscação R8/ProGuard, sem logs e sem modo debug.
- **Token salvo em armazenamento seguro:** Android Keystore, iOS Keychain, ou `expo-secure-store` em Expo/React Native.
- **Só HTTPS** (tráfego em texto puro bloqueado na configuração de rede); certificate pinning em app com pagamento ou dado sensível, com plano de troca do certificado.
- **Deep links** verificados (App Links / Universal Links) e parâmetros validados.
- **Permissões mínimas** no manifest, cada uma justificada para o usuário.
- **Root ou jailbreak** é só sinal de risco, nunca a única defesa.
- **Play Store:** formulário de Segurança dos dados fiel ao que o app coleta, link da política de privacidade e exclusão de conta dentro do app e por um link na web (se o app cria conta).

## Logs, monitoramento, LGPD e incidentes

### Logs e monitoramento

- **Logs estruturados (JSON):** horário, rota, usuário, empresa, IP, resultado e ID da requisição.
- **Nunca logar** senha, token, cartão, CPF completo ou dado de saúde. Mascare antes de gravar.
- **Eventos de segurança registrados:** login certo e errado, MFA, troca de senha ou e-mail, mudança de papel, export, ação de admin, sequência de 401/403/429, webhook recusado.
- **Erros no Sentry** (ou similar) e **alerta imediato** (WhatsApp, Telegram ou e-mail) para: pico de login errado, webhook com assinatura inválida, valor pago divergente, ação de admin fora do horário, pico de erro 500.
- **Guarda:** registros de acesso (IP, data e hora) por no mínimo 6 meses, como exige o Marco Civil da Internet (art. 15) para empresas que operam aplicações ([fonte](https://juridicocerto.com/p/faria-cendao-e-maia/artigos/prazo-de-guarda-de-registros-de-acesso-a-aplicacoes-de-internet-1736)).

### LGPD

- Colete só o necessário; cada dado com finalidade e base legal registradas.
- Consentimento separado e registrado (data, hora, versão do termo) para marketing, pixel e WhatsApp promocional.
- Política de privacidade e termos de uso publicados e versionados.
- Direitos do titular prontos: exportar os próprios dados e excluir a conta pelo próprio sistema.
- Retenção definida: apagar ou anonimizar quando a finalidade acabar (ex.: lead frio, conta inativa).
- Dado de saúde e de criança é sensível: criptografia obrigatória, acesso mínimo e consentimento específico.
- Fornecedores que tocam nos dados (gateway, WhatsApp, IA, e-mail) listados, com contrato que fale de proteção de dados.
- Canal de privacidade publicado (e-mail do encarregado ou responsável).

### Resposta a incidentes

1. **Conter:** tirar do ar a parte afetada e ativar o modo de ataque do firewall.
2. **Trancar:** trocar todas as chaves envolvidas e derrubar todas as sessões.
3. **Preservar provas:** logs e snapshot do banco antes de mexer.
4. **Corrigir** a causa e restaurar de backup limpo, se preciso.
5. **Comunicar** a ANPD e os titulares afetados em até 3 dias úteis quando houver risco ou dano relevante; agente de pequeno porte tem prazo em dobro; complementar a comunicação em até 20 dias úteis ([fonte](https://www.globalsuitesolutions.com/pt/?p=117761)).
6. **Registrar** o incidente (guardar por no mínimo 5 anos) e fazer o pós-mortem: o que falhou, por que, e qual regra entra neste padrão para nunca mais acontecer.

## Código base

Use estes blocos como ponto de partida e adapte nomes de tabela, cabeçalho e gateway ao projeto. A migração foi testada em Postgres 16 com 22 cenários de ataque (cliente lendo pedido alheio, empresa vendo outra, admin se promovendo a owner, visitante lendo dados, edição de log, webhook repetido): todos bloqueados.

### 1. Migração SQL base (Supabase)

```sql
-- ============================================================
-- MIGRAÇÃO BASE DE SEGURANÇA — Supabase / Postgres
-- Primeira migração de todo projeto novo.
-- ============================================================

-- 1) Schemas internos (fora da API)
create schema if not exists private;
create schema if not exists audit;
revoke all on schema private from public, anon;
revoke all on schema audit from public, anon, authenticated;
grant usage on schema private to authenticated, service_role; -- policies e servidor usam funções daqui

-- 2) Empresas e membros com papéis
create type public.app_role as enum ('owner', 'admin', 'manager', 'staff', 'customer');

create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.memberships (
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.app_role not null default 'customer',
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index on public.memberships (user_id);

-- 3) Funções de permissão (search_path travado, sem acesso público)
create or replace function private.is_member(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_role(p_tenant uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

revoke all on function private.is_member(uuid) from public, anon;
revoke all on function private.has_role(uuid, public.app_role[]) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.app_role[]) to authenticated;

-- 4) updated_at automático
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 5) Auditoria: somente inserção, ninguém edita nem apaga
create table audit.logs (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,
  action      text not null,
  table_name  text not null,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb
);
revoke all on audit.logs from public, anon, authenticated;

create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  -- tire colunas sensíveis do log, ex.: v_new := v_new - array['cpf_enc', 'token_hash'];
  insert into audit.logs (actor, action, table_name, record_id, old_data, new_data)
  values ((select auth.uid()), tg_op, tg_table_schema || '.' || tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id'), v_old, v_new);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.block_audit_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit.logs aceita apenas inserção';
end;
$$;

create trigger audit_logs_imutavel before update or delete on audit.logs
  for each row execute function private.block_audit_changes();
create trigger audit_logs_sem_truncate before truncate on audit.logs
  for each statement execute function private.block_audit_changes();

-- 6) Webhooks: cada evento é processado uma única vez
create table private.webhook_events (
  provider     text not null,
  event_id     text not null,
  received_at  timestamptz not null default now(),
  primary key (provider, event_id)
);
revoke all on private.webhook_events from public, anon, authenticated;
grant select, insert on private.webhook_events to service_role;

-- O servidor chama supabaseAdmin.rpc('claim_webhook_event', ...): true só na 1ª vez
create or replace function public.claim_webhook_event(p_provider text, p_event_id text)
returns boolean language plpgsql set search_path = '' as $$
begin
  insert into private.webhook_events (provider, event_id)
  values (p_provider, p_event_id)
  on conflict do nothing;
  return found;
end;
$$;
revoke all on function public.claim_webhook_event(text, text) from public, anon, authenticated;
grant execute on function public.claim_webhook_event(text, text) to service_role;

-- 7) Tabela modelo: copie este padrão para toda tabela de dados
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete restrict,
  customer_id      uuid not null references auth.users (id) on delete restrict,
  status           text not null default 'pending'
                   check (status in ('pending', 'paid', 'canceled', 'refunded')),
  total_cents      bigint not null check (total_cents >= 0),
  idempotency_key  text unique,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index on public.orders (tenant_id, created_at desc);
create index on public.orders (customer_id);

create trigger orders_updated_at before update on public.orders
  for each row execute function private.set_updated_at();
create trigger orders_audit after insert or update or delete on public.orders
  for each row execute function private.audit_row();

-- 8) RLS: tudo fechado, abre só o necessário
alter table public.tenants     enable row level security;
alter table public.memberships enable row level security;
alter table public.orders      enable row level security;

-- Empresa: membro vê a sua; só o owner edita
create policy tenants_select on public.tenants for select to authenticated
  using (deleted_at is null and private.is_member(id));
create policy tenants_update on public.tenants for update to authenticated
  using (private.has_role(id, '{owner}'))
  with check (private.has_role(id, '{owner}'));

-- Membros: cada um vê o próprio vínculo; gestão vê a equipe toda.
-- Owner gerencia todos; admin só gerencia papéis abaixo dele.
create policy memberships_select on public.memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_role(tenant_id, '{owner,admin,manager}')
  );
create policy memberships_insert on public.memberships for insert to authenticated
  with check (
    private.has_role(tenant_id, '{owner}')
    or (private.has_role(tenant_id, '{admin}') and role in ('manager', 'staff', 'customer'))
  );
create policy memberships_update on public.memberships for update to authenticated
  using (
    private.has_role(tenant_id, '{owner}')
    or (private.has_role(tenant_id, '{admin}') and role in ('manager', 'staff', 'customer'))
  )
  with check (
    private.has_role(tenant_id, '{owner}')
    or (private.has_role(tenant_id, '{admin}') and role in ('manager', 'staff', 'customer'))
  );
create policy memberships_delete on public.memberships for delete to authenticated
  using (
    private.has_role(tenant_id, '{owner}')
    or (private.has_role(tenant_id, '{admin}') and role in ('manager', 'staff', 'customer'))
  );

-- Pedidos: cliente vê só os dele; equipe da empresa vê os da empresa.
-- Sem policy de insert/update/delete: pedido, valor e status só mudam
-- pelo servidor (service_role), que recalcula preço e confirma pagamento.
create policy orders_select on public.orders for select to authenticated
  using (
    deleted_at is null and (
      customer_id = (select auth.uid())
      or private.has_role(tenant_id, '{owner,admin,manager,staff}')
    )
  );

-- 9) Visitante sem login não toca em nada disso
revoke all on public.tenants, public.memberships, public.orders from anon;
```

### 2. Cabeçalhos de segurança (`vercel.json`)

Serve para qualquer projeto na Vercel, inclusive os do Lovable (Vite). Usa Pixel da Meta? Acrescente `https://connect.facebook.net` em `script-src` e `https://www.facebook.com` em `img-src` e `connect-src`. Em Next.js, scripts inline exigem CSP com nonce no middleware (siga a página Content Security Policy da documentação do Next).

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=()" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests"
        }
      ]
    }
  ]
}
```

### 3. Validação de entrada (Zod)

```ts
import { z } from "zod";

// strictObject recusa campos extras: price, status, tenant_id, role...
export const CreateOrderSchema = z.strictObject({
  items: z.array(z.strictObject({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(50),
  })).min(1).max(100),
  couponCode: z.string().trim().max(32).regex(/^[A-Z0-9_-]+$/i).optional(),
  notes: z.string().trim().max(500).optional(),
});

// na rota: const parsed = CreateOrderSchema.safeParse(await req.json());
// if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
// preço e total: buscar no banco pelos productId, nunca usar valor do cliente
```

### 4. Rate limit (Upstash Redis)

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
export const limiteLogin = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "rl:login",
});

// na rota de login: limita por IP e por conta ao mesmo tempo
const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "sem-ip";
const porIp = await limiteLogin.limit(`ip:${ip}`);
const porConta = await limiteLogin.limit(`conta:${email.toLowerCase()}`);
if (!porIp.success || !porConta.success) {
  return Response.json({ error: "Muitas tentativas. Tente de novo em alguns minutos." }, { status: 429 });
}
```

### 5. Criptografia, webhook e tokens (`lib/security.ts`)

```ts
// lib/security.ts — só roda no servidor (rota de API ou Edge Function)
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Chaves de 32 bytes geradas com: openssl rand -base64 32
const DATA_KEY = Buffer.from(process.env.DATA_ENCRYPTION_KEY ?? "", "base64");
const INDEX_KEY = Buffer.from(process.env.DATA_INDEX_KEY ?? "", "base64");
if (DATA_KEY.length !== 32 || INDEX_KEY.length !== 32) {
  throw new Error("DATA_ENCRYPTION_KEY e DATA_INDEX_KEY precisam ter 32 bytes em base64");
}

// Criptografa CPF, RG, dado de saúde, token de integração (AES-256-GCM)
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", DATA_KEY, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("payload inválido");
  const decipher = createDecipheriv("aes-256-gcm", DATA_KEY, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

// Busca exata sem decifrar (ex.: achar cliente pelo CPF). Normalize antes: só dígitos.
export function blindIndex(normalized: string): string {
  return createHmac("sha256", INDEX_KEY).update(normalized).digest("hex");
}

// Webhook assinado com HMAC-SHA256 sobre "timestamp.corpo".
// Adapte nomes de cabeçalho e formato ao que o seu gateway documenta.
export function verifyWebhook(
  rawBody: string,
  signatureHex: string | null,
  timestamp: string | null,
  secret: string,
): boolean {
  if (!signatureHex || !timestamp) return false;
  const sentAt = Number(timestamp) * 1000;
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > 5 * 60 * 1000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const received = Buffer.from(signatureHex, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// Token aleatório (reset de senha, convite): envie o token, guarde só o hash
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  const hash = createHmac("sha256", INDEX_KEY).update(token).digest("hex");
  return { token, hash };
}
```

### 6. Webhook de pagamento ponta a ponta

```ts
// rota do webhook (Next.js) — a mesma lógica vale numa Edge Function do Supabase
export async function POST(req: Request) {
  const raw = await req.text(); // corpo cru, antes de qualquer JSON.parse
  const valido = verifyWebhook(
    raw,
    req.headers.get("x-signature"),
    req.headers.get("x-timestamp"),
    process.env.PAYMENT_WEBHOOK_SECRET!,
  );
  if (!valido) return new Response("assinatura inválida", { status: 401 });

  const evento = JSON.parse(raw);
  const { data: primeiraVez, error } = await supabaseAdmin.rpc("claim_webhook_event", {
    p_provider: "gateway",
    p_event_id: String(evento.id),
  });
  if (error) return new Response("erro", { status: 500 }); // o gateway reenvia depois
  if (!primeiraVez) return new Response("ok");             // evento repetido: ignora

  // nunca confie só no corpo: reconsulte a API oficial do gateway
  const pagamento = await consultarPagamentoNoGateway(evento.paymentId);
  const { data: pedido } = await supabaseAdmin
    .from("orders").select("id, total_cents, status")
    .eq("id", pagamento.orderId).single();

  if (pagamento.status === "paid" && pedido?.status === "pending"
      && pagamento.amountCents === pedido.total_cents) {
    await supabaseAdmin.from("orders")
      .update({ status: "paid" })
      .eq("id", pedido.id).eq("status", "pending"); // update condicional: libera uma vez só
  }
  // valor diferente: não libera e dispara alerta para revisão manual
  return new Response("ok");
}
```

## Checklist de deploy e relatório final

Nada vai para produção com um item aberto. Item que não se aplica ao sistema é marcado com o motivo.

- [ ] RLS ativo em 100% das tabelas expostas e Security Advisor do Supabase sem alerta crítico
- [ ] Usuário A não lê nem edita dado do usuário B; empresa A não vê empresa B
- [ ] Usuário comum recebe 403 em todas as rotas e ações de admin
- [ ] Nenhum segredo no frontend, no app ou no Git (gitleaks limpo; só chave pública no navegador)
- [ ] Preço, total, saldo, pontuação e status de pagamento calculados e confirmados só no servidor
- [ ] Webhooks com assinatura ou token, idempotência e reconsulta ao gateway
- [ ] Rate limit em login, cadastro, reset de senha, IA e rotas caras
- [ ] MFA nas contas de admin do sistema e em Vercel, Supabase, GitHub, Lovable, domínio e gateway
- [ ] Cabeçalhos de segurança ativos (nota A em securityheaders.com)
- [ ] Uploads com tipo real, tamanho máximo, bucket privado e URL assinada
- [ ] Erros sem stack trace para o usuário; logs sem senha, token ou CPF
- [ ] Backup automático ativo e uma restauração já testada
- [ ] `npm audit` sem vulnerabilidade alta ou crítica
- [ ] Política de privacidade, termos e consentimento de cookies/pixel publicados
- [ ] Alertas configurados (erro 500, login errado em massa, webhook inválido, valor divergente)
- [ ] Preview protegido e produção com banco e chaves próprios

### Relatório de segurança (entregue no fim de toda entrega)

1. Tipo de sistema detectado e seções aplicadas.
2. Modelo de ameaças resumido.
3. O que foi implementado, por seção.
4. O que depende de mim (ex.: ativar MFA, cadastrar segredo na Vercel, contratar PITR, preencher dados da política de privacidade).
5. Riscos que sobraram e como reduzir cada um.
6. Este checklist preenchido.

## Fontes

- [Comunicação de incidente à ANPD: prazos e guia completo — GlobalSuite Solutions](https://www.globalsuitesolutions.com/pt/?p=117761)
- [Prazo de Guarda de Registros de Acesso a Aplicações de Internet — Jurídico Certo](https://juridicocerto.com/p/faria-cendao-e-maia/artigos/prazo-de-guarda-de-registros-de-acesso-a-aplicacoes-de-internet-1736)
