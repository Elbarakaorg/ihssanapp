type Props = { title: string; eyebrow: string; description: string; detail: string };

export default function RestrictedPage({ title, eyebrow, description, detail }: Props) {
  return (
    <div className="page-stack">
      <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-lede">{description}</p></div></header>
      <section className="panel roadmap-panel"><div className="roadmap-mark" /><div><h2>Workspace boundary is in place</h2><p>{detail}</p></div></section>
    </div>
  );
}
