import { lazy } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConfirmHost, Toaster } from '@/components/layout/Overlays';
import { EmptyState, ButtonLink } from '@/components/ui';
import LoginPage from '@/features/auth/LoginPage';
import { SearchX } from 'lucide-react';

// Seiten werden bei Bedarf geladen (kleineres Start-Bundle)
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const CandidatesPage = lazy(() => import('@/features/candidates/CandidatesPage'));
const CandidateDetailPage = lazy(() => import('@/features/candidates/CandidateDetailPage'));
const CompaniesPage = lazy(() => import('@/features/companies/CompaniesPage'));
const CompanyDetailPage = lazy(() => import('@/features/companies/CompanyDetailPage'));
const JobsPage = lazy(() => import('@/features/jobs/JobsPage'));
const JobDetailPage = lazy(() => import('@/features/jobs/JobDetailPage'));
const PipelinePage = lazy(() => import('@/features/pipeline/PipelinePage'));
const AssignmentsPage = lazy(() => import('@/features/assignments/AssignmentsPage'));
const AssignmentDetailPage = lazy(() => import('@/features/assignments/AssignmentDetailPage'));
const TimesheetsPage = lazy(() => import('@/features/assignments/TimesheetsPage'));
const InvoicesPage = lazy(() => import('@/features/billing/InvoicesPage'));
const InvoiceDetailPage = lazy(() => import('@/features/billing/InvoiceDetailPage'));
const ActivitiesPage = lazy(() => import('@/features/activities/ActivitiesPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

function NotFound() {
  return (
    <EmptyState
      icon={<SearchX size={24} />}
      title="Seite nicht gefunden"
      text="Die aufgerufene Seite existiert nicht oder der Datensatz wurde gelöscht."
      action={<ButtonLink to="/" variant="primary">Zum Dashboard</ButtonLink>}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="kandidaten" element={<CandidatesPage />} />
          <Route path="kandidaten/:id" element={<CandidateDetailPage />} />
          <Route path="unternehmen" element={<CompaniesPage />} />
          <Route path="unternehmen/:id" element={<CompanyDetailPage />} />
          <Route path="vakanzen" element={<JobsPage />} />
          <Route path="vakanzen/:id" element={<JobDetailPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="einsaetze" element={<AssignmentsPage />} />
          <Route path="einsaetze/:id" element={<AssignmentDetailPage />} />
          <Route path="rapporte" element={<TimesheetsPage />} />
          <Route path="rechnungen" element={<InvoicesPage />} />
          <Route path="rechnungen/:id" element={<InvoiceDetailPage />} />
          <Route path="aktivitaeten" element={<ActivitiesPage />} />
          <Route path="berichte" element={<ReportsPage />} />
          <Route path="einstellungen" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster />
      <ConfirmHost />
      <Link to="/" className="hidden" aria-hidden />
    </BrowserRouter>
  );
}
