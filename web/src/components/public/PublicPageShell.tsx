import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function PublicPageShell({ children, className = "" }: Props) {
  return (
    <div className={`min-h-screen bg-[#0d1b2a] text-[#e0e1dd] antialiased flex flex-col ${className}`}>
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
