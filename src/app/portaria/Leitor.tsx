"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Logo } from "@/components/Logo";

type Base = { base: Record<string, [string, string, number]>; vendidos: number; entraram: number; gerado_em: string };
type Resultado = { resultado: "ok" | "ja_utilizado" | "invalido" | "outra_festa" | "cancelado"; nome?: string; setor?: string; lote?: string; checkin_em?: string; offline?: boolean };

async function hash(codigo: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codigo));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
const ler = <T,>(k: string, p: T): T => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? p; } catch { return p; } };
const gravar = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function bip(ok: boolean) {
  try {
    const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220; o.type = ok ? "sine" : "square"; g.gain.value = 0.15;
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + (ok ? 0.15 : 0.45));
    navigator.vibrate?.(ok ? 80 : [200, 80, 200]);
  } catch {}
}

export function Leitor({ festas, festaInicial, nomeStaff, admin }: { festas: { id: string; titulo: string }[]; festaInicial: string; nomeStaff: string; admin: boolean }) {
  const [festa, setFesta] = useState(festaInicial);
  const [base, setBase] = useState<Base | null>(null);
  const [online, setOnline] = useState(true);
  const [fila, setFila] = useState<string[]>([]);
  const [usadosLocal, setUsadosLocal] = useState<Record<string, number>>({});
  const [res, setRes] = useState<Resultado | null>(null);
  const [camera, setCamera] = useState(false);
  const [aba, setAba] = useState<"qr" | "lista">("qr");
  const [manual, setManual] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const travado = useRef(false);
  const ultimo = useRef<{ c: string; t: number }>({ c: "", t: 0 });

  const kBase = `glam-portaria-base-${festa}`, kFila = `glam-portaria-fila-${festa}`, kUsados = `glam-portaria-usados-${festa}`;

  // Carrega base offline + estado salvo
  const atualizarBase = useCallback(async () => {
    if (!festa) return;
    try {
      const r = await fetch(`/api/portaria/base?festa=${festa}`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      const j: Base = await r.json();
      setBase(j); gravar(kBase, j); setOnline(true);
    } catch {
      setOnline(false);
      setBase((b) => b || ler<Base | null>(kBase, null));
    }
  }, [festa, kBase]);

  useEffect(() => {
    setBase(ler<Base | null>(kBase, null));
    setFila(ler<string[]>(kFila, []));
    setUsadosLocal(ler<Record<string, number>>(kUsados, {}));
    atualizarBase();
    const t = setInterval(atualizarBase, 20000);
    const on = () => { setOnline(true); atualizarBase(); }, off = () => setOnline(false);
    addEventListener("online", on); addEventListener("offline", off);
    return () => { clearInterval(t); removeEventListener("online", on); removeEventListener("offline", off); };
  }, [festa]); // eslint-disable-line

  // Sincroniza fila offline
  useEffect(() => {
    if (!online || fila.length === 0) return;
    (async () => {
      try {
        const r = await fetch("/api/portaria/checkin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ festa_id: festa, codigos: fila }) });
        if (r.ok) { setFila([]); gravar(kFila, []); atualizarBase(); }
      } catch {}
    })();
  }, [online, fila, festa, kFila, atualizarBase]);

  const mostrar = (r: Resultado) => {
    setRes(r); bip(r.resultado === "ok");
    setTimeout(() => { setRes(null); travado.current = false; }, r.resultado === "ok" ? 1600 : 2800);
  };

  const validar = useCallback(async (bruto: string) => {
    const codigo = bruto.replace(/^GLAM:/, "").trim();
    if (!codigo || travado.current) return;
    if (ultimo.current.c === codigo && Date.now() - ultimo.current.t < 4000) return;
    ultimo.current = { c: codigo, t: Date.now() };
    travado.current = true;
    const h = await hash(codigo);
    if (navigator.onLine) {
      try {
        const r = await fetch("/api/portaria/checkin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ festa_id: festa, codigo }), signal: AbortSignal.timeout(4000) });
        if (r.ok) {
          const j: Resultado = await r.json();
          if (j.resultado === "ok" && base) { setBase({ ...base, entraram: base.entraram + 1 }); }
          return mostrar(j);
        }
      } catch {}
    }
    // Modo offline: valida pela base baixada
    setOnline(false);
    const item = base?.base[h];
    if (!item) return mostrar({ resultado: "invalido", offline: true });
    if (item[2] || usadosLocal[h]) return mostrar({ resultado: "ja_utilizado", nome: item[0], setor: item[1], offline: true });
    const novosUsados = { ...usadosLocal, [h]: Date.now() };
    setUsadosLocal(novosUsados); gravar(kUsados, novosUsados);
    const novaFila = [...fila, codigo];
    setFila(novaFila); gravar(kFila, novaFila);
    mostrar({ resultado: "ok", nome: item[0], setor: item[1], offline: true });
  }, [base, festa, fila, kFila, kUsados, usadosLocal]); // eslint-disable-line

  // Câmera + leitura contínua
  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null, raf = 0, parar = false;
    const detector = "BarcodeDetector" in window ? new (window as any).BarcodeDetector({ formats: ["qr_code"] }) : null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
        if (!video.current) return;
        video.current.srcObject = stream; await video.current.play();
        let ultimoFrame = 0;
        const loop = async (t: number) => {
          if (parar) return;
          if (t - ultimoFrame > 120 && video.current && video.current.readyState >= 2 && !travado.current) {
            ultimoFrame = t;
            const v = video.current;
            try {
              if (detector) {
                const cods = await detector.detect(v);
                if (cods[0]?.rawValue) validar(cods[0].rawValue);
              } else if (canvas.current) {
                const c = canvas.current, w = 480, hgt = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
                c.width = w; c.height = hgt;
                const ctx = c.getContext("2d", { willReadFrequently: true })!;
                ctx.drawImage(v, 0, 0, w, hgt);
                const img = ctx.getImageData(0, 0, w, hgt);
                const q = jsQR(img.data, w, hgt, { inversionAttempts: "dontInvert" });
                if (q?.data) validar(q.data);
              }
            } catch {}
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch { alert("Não foi possível abrir a câmera. Libere a permissão no navegador."); setCamera(false); }
    })();
    return () => { parar = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [camera, validar]);

  const entraram = (base?.entraram || 0) + Object.keys(usadosLocal).filter((h) => base?.base[h] && !base.base[h][2]).length;
  const vendidos = base?.vendidos || 0;
  const cores: Record<string, string> = { ok: "bg-[#1f6b47]", ja_utilizado: "bg-[#8a2c22]", invalido: "bg-[#8a2c22]", outra_festa: "bg-[#8a5a22]", cancelado: "bg-[#8a2c22]" };
  const titulos: Record<string, string> = { ok: "Pode entrar", ja_utilizado: "Já utilizado", invalido: "QR inválido", outra_festa: "Outra festa", cancelado: "Cancelado" };

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-6">
      <header className="flex items-center justify-between py-4">
        <Logo className="w-20" />
        <div className="text-right text-[0.65rem] uppercase tracking-[0.2em]">
          <p className={online ? "text-sucesso" : "text-perigo"}>{online ? "● online" : "● offline"}{fila.length > 0 && ` · ${fila.length} p/ sincronizar`}</p>
          <p className="text-fumaca">{nomeStaff}{admin && <> · <a href="/admin" className="underline">painel</a></>}</p>
        </div>
      </header>

      <select value={festa} onChange={(e) => setFesta(e.target.value)} className="campo mb-4">
        {festas.length === 0 && <option value="">Nenhuma festa hoje</option>}
        {festas.map((f) => <option key={f.id} value={f.id}>{f.titulo}</option>)}
      </select>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[["Vendidos", vendidos], ["Entraram", entraram], ["Faltam", Math.max(0, vendidos - entraram)]].map(([r, v]) => (
          <div key={String(r)} className="cartao py-3"><p className="font-display text-3xl tabular-nums">{v}</p><p className="text-[0.6rem] uppercase tracking-[0.25em] text-fumaca">{r}</p></div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-full border border-linha bg-carvao p-1">
        {(["qr", "lista"] as const).map((a) => (
          <button key={a} onClick={() => setAba(a)} className={`rounded-full py-2 text-xs font-semibold uppercase tracking-[0.25em] ${aba === a ? "ouro-gradiente text-noir" : "text-fumaca"}`}>{a === "qr" ? "Ler QR" : "Lista de nomes"}</button>
        ))}
      </div>

      {aba === "qr" ? (
        <>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-ouro/40 bg-black">
            <video ref={video} playsInline muted className="h-full w-full object-cover" />
            <canvas ref={canvas} className="hidden" />
            {camera ? (
              <div className="scanner-mira pointer-events-none absolute left-1/2 top-1/2 h-3/5 w-3/5 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-ouro" />
            ) : (
              <button onClick={() => setCamera(true)} className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ouro">
                <span className="text-5xl">⌁</span><span className="text-xs uppercase tracking-[0.3em]">Toque para abrir a câmera</span>
              </button>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); validar(manual); setManual(""); }} className="mt-4 flex gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Digitar código" className="campo" />
            <button className="btn-linha">OK</button>
          </form>
          {base && <p className="mt-3 text-center text-[0.65rem] text-fumaca">Base offline atualizada às {new Date(base.gerado_em).toLocaleTimeString("pt-BR")} · funciona mesmo sem internet</p>}
        </>
      ) : (
        <BuscaLista festa={festa} online={online} />
      )}

      {res && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center text-white ${cores[res.resultado]}`} onClick={() => { setRes(null); travado.current = false; }}>
          <p className="text-7xl">{res.resultado === "ok" ? "✓" : "✕"}</p>
          <p className="mt-4 font-display text-5xl">{titulos[res.resultado]}</p>
          {res.nome && <p className="mt-4 text-2xl">{res.nome}</p>}
          {(res.setor || res.lote) && <p className="mt-1 text-sm uppercase tracking-[0.25em] opacity-80">{res.setor}{res.lote && !res.setor?.includes(res.lote) ? ` · ${res.lote}` : ""}</p>}
          {res.checkin_em && <p className="mt-3 text-sm opacity-80">Entrou às {new Date(res.checkin_em).toLocaleTimeString("pt-BR")}</p>}
          {res.offline && <p className="mt-6 text-[0.65rem] uppercase tracking-[0.3em] opacity-70">validado offline</p>}
        </div>
      )}
    </div>
  );
}

function BuscaLista({ festa, online }: { festa: string; online: boolean }) {
  const [q, setQ] = useState("");
  const [nomes, setNomes] = useState<any[]>([]);
  useEffect(() => {
    if (q.length < 2) { setNomes([]); return; }
    const t = setTimeout(async () => {
      try { const r = await fetch(`/api/portaria/lista?festa=${festa}&q=${encodeURIComponent(q)}`); setNomes((await r.json()).nomes || []); } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [q, festa]);
  async function entrar(id: string) {
    const r = await fetch("/api/portaria/lista", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    const j = await r.json(); bip(j.resultado === "ok");
    setNomes((n) => n.map((x) => (x.id === id ? { ...x, checkin_em: x.checkin_em || new Date().toISOString() } : x)));
  }
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={online ? "Buscar nome na lista…" : "Lista precisa de internet"} className="campo" autoFocus />
      <div className="mt-3 space-y-2">
        {nomes.map((n) => (
          <div key={n.id} className="cartao flex items-center justify-between p-3">
            <div><p className={n.checkin_em ? "text-fumaca line-through" : ""}>{n.nome}</p><p className="text-[0.6rem] uppercase tracking-[0.2em] text-fumaca">{n.tipo}</p></div>
            {n.checkin_em ? <span className="text-xs text-fumaca">já entrou</span> : <button onClick={() => entrar(n.id)} className="btn-ouro ouro-gradiente !px-4 !py-2">Entrou</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
