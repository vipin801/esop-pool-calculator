export function Hero() {
  return (
    <div className="mx-auto max-w-page px-5 pt-6">
      <nav aria-label="Breadcrumb" className="text-2xs text-faint">
        <span>Resources</span> <span aria-hidden="true">›</span> <span>Tools</span>{' '}
        <span aria-hidden="true">›</span>{' '}
        <span aria-current="page" className="text-sub">
          ESOP Pool Sizing
        </span>
      </nav>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">
        How big should your ESOP pool be?
      </h1>
      <p className="mt-2 text-[15px] leading-6 text-sub">
        Size your pool against your hiring plan, not a rule of thumb.
      </p>
    </div>
  );
}
