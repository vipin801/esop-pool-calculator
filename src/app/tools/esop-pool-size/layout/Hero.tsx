export function Hero() {
  return (
    <div className="mx-auto flex max-w-page flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pt-4">
      <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-ink sm:text-[26px]">
        How big should your ESOP pool be?
      </h1>
      <p className="text-[13px] leading-5 text-sub">Sized against your hiring plan, not a rule of thumb.</p>
      <nav aria-label="Breadcrumb" className="w-full text-2xs text-faint">
        <span>Resources</span> <span aria-hidden="true">›</span> <span>Tools</span>{' '}
        <span aria-hidden="true">›</span>{' '}
        <span aria-current="page" className="text-sub">
          ESOP Pool Sizing
        </span>
      </nav>
    </div>
  );
}
