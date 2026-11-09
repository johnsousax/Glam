export function Logo({ className = "w-32", dourado = false }: { className?: string; dourado?: boolean }) {
  return <div role="img" aria-label="GLAM" className={`logo-glam ${dourado ? "logo-ouro" : ""} ${className}`} />;
}
