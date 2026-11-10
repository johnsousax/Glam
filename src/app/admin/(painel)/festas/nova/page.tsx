import { exigirStaff } from "@/lib/staff";
import { Titulo } from "@/components/admin/Titulo";
import { SairPara } from "@/components/admin/Fechar";
import { FestaForm } from "../FestaForm";

export default async function NovaFesta() {
  await exigirStaff("festas");
  return (<><Titulo sup="Festas" titulo="Nova festa"><SairPara href="/admin/festas" rotulo="Cancelar e voltar" /></Titulo><FestaForm /><p className="mt-4 text-sm text-fumaca">Depois de criar, cadastre os lotes (pista, VIP, camarote, meia…).</p></>);
}
