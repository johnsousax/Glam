# GLAM House · Sistema de Ingressos

Siga o SECURITY.md em todo código deste projeto.

- Stack: Next.js 16 (App Router, `src/`), Supabase (tabelas `glam_*`, RLS fechado, acesso só pelo servidor com service role), Vercel, PagBank, n8n.
- Toda mudança de banco é uma migração nova em `supabase/migrations/`.
- Rotas de API públicas: `origemValida` + `dentroDoLimite` + schema Zod (`src/lib/esquemas.ts`).
- Painel: `exigirStaff(recurso)` em toda página e ação; MFA obrigatório para dono, gerente e financeiro.
- Relatório de segurança atualizado em `docs/RELATORIO-SEGURANCA.md`.
