import { exigirStaff, staffAtual } from "@/lib/staff";
import { authClient } from "@/lib/supabase-server";
import { Titulo } from "@/components/admin/Titulo";
import { Mfa } from "./Mfa";

export const dynamic = "force-dynamic";

export default async function Seguranca() {
  await exigirStaff(undefined, { permitirSemMfa: true });
  const { semMfaCadastrado } = await staffAtual();
  const sb = await authClient();
  const { data } = await sb.auth.mfa.listFactors();
  const temMfa = (data?.totp || []).some((f) => f.status === "verified");
  return (
    <>
      <Titulo sup="Conta" titulo="Minha segurança" />
      <Mfa temMfa={temMfa} obrigatorio={semMfaCadastrado} />
    </>
  );
}
