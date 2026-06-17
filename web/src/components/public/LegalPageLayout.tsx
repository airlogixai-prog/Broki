import { PublicPageShell } from "./PublicPageShell";

interface Props {
  title: string;
  children: React.ReactNode;
}

export function LegalPageLayout({ title, children }: Props) {
  return (
    <PublicPageShell>
      <section className="container mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold text-white mb-8">{title}</h1>
        <div className="prose prose-invert max-w-none space-y-4 text-[#a8b2d1] leading-relaxed">
          {children}
        </div>
      </section>
    </PublicPageShell>
  );
}
