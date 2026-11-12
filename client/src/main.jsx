import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import Shell from './components/Shell.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ExamDetail from './pages/ExamDetail.jsx';
import Instructions from './pages/Instructions.jsx';
import TestEngine from './pages/TestEngine.jsx';
import Result from './pages/Result.jsx';
import Analytics from './pages/Analytics.jsx';
import Report from './pages/Report.jsx';
import Admin from './pages/Admin.jsx';
import './styles.css';
import './exam.css';
import { Provider } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { store } from './store/store.js';

function Protected({ children, adminOnly }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ padding: 40 }} className="muted">Loading your account…</div>;
  if (!user) return <Navigate to="/sign-in" state={{ from: location }} replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<Login />} />
      {/* The test engine and its instructions run outside the product shell —
          on exam day there is no navigation, so there is none here either. */}
      <Route path="/mock/:mockTestId/instructions" element={<Protected><Instructions /></Protected>} />
      <Route path="/mock/:mockTestId/live" element={<Protected><TestEngine /></Protected>} />
      <Route element={<Protected><Shell /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/exam/:examId" element={<ExamDetail />} />
        <Route path="/attempt/:attemptId" element={<Result />} />
        <Route path="/exam/:examId/analysis" element={<Analytics />} />
        <Route path="/exam/:examId/report" element={<Report />} />
        <Route path="/admin/*" element={<Protected adminOnly><Admin /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <ToastContainer position="top-right" autoClose={3500} newestOnTop closeOnClick pauseOnFocusLoss theme="light" />
        </AuthProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
