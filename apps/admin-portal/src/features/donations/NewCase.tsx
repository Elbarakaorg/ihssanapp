import { useNavigate } from 'react-router-dom';

import CaseForm from './CaseForm';
import { useNotice } from './ui';

export default function NewCase() {
  const nav = useNavigate();
  const notice = useNotice();
  return (
    <div className="dn-page">
      <header className="page-header"><div><p className="eyebrow">GIVING & COMMUNITY</p><h1>New case</h1></div></header>
      {notice.view}
      <section className="panel"><CaseForm onCancel={() => nav('/donations/cases')} onFail={notice.fail} onSaved={(id) => nav(`/donations/cases/${id}`)} /></section>
    </div>
  );
}
