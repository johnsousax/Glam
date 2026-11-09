import { exigirStaff } from "@/lib/staff";
import { Titulo } from "@/components/admin/Titulo";
import { Mfa } from "./Mfa";

export default async function Seguranca() {
  await exigirStaff();
  return (
    <>
      <Titulo sup="Conta" titulo="Minha segurança" />
      <Mfa />
    </>
  );
}
