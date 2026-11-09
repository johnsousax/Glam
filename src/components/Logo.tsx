export function Logo({ className = "w-32" }: { className?: string; animado?: boolean }) {
  return <div role="img" aria-label="GLAM" className={`logo-glam ${className}`} />;
}
