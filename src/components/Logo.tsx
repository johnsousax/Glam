export function Logo({ className = "w-32", animado = false }: { className?: string; animado?: boolean }) {
  return <div role="img" aria-label="GLAM" className={`logo-glam ouro-gradiente ${animado ? "brilho-ouro" : ""} ${className}`} />;
}
