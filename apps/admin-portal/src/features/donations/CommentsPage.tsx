import CommentsPanel from './CommentsPanel';

export default function CommentsPage() {
  return (
    <div className="dn-page">
      <header className="page-header">
        <div><p className="eyebrow">GIVING & COMMUNITY</p><h1>Donor comments</h1><p className="page-lede">Comments left with confirmed donations, across every case. Select several and approve or hide them in one go.</p></div>
      </header>
      <section className="panel"><CommentsPanel /></section>
    </div>
  );
}
