import Link from 'next/link';

export function SecondaryAuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 py-2.5 text-[13.5px] font-semibold text-text transition-colors hover:bg-bg"
    >
      {children}
    </Link>
  );
}
