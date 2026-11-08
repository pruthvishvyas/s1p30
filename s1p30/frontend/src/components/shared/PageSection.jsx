export function PageSection({ title, subtitle, children }) {
  return (
    <section className="page-section">
      <div>
        <h2 className="page-title">{title}</h2>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
