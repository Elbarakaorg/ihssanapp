import { Route, Routes } from 'react-router-dom';

import CaseWorkspace from './CaseWorkspace';
import CasesList from './CasesList';
import CommentsPage from './CommentsPage';
import NewCase from './NewCase';
import OverviewPage from './OverviewPage';

export default function DonationsRoutes() {
  return (
    <Routes>
      <Route element={<OverviewPage />} index />
      <Route element={<CasesList />} path="cases" />
      <Route element={<NewCase />} path="cases/new" />
      <Route element={<CaseWorkspace />} path="cases/:id" />
      <Route element={<CommentsPage />} path="comments" />
    </Routes>
  );
}
