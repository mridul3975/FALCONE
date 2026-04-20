import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import Dashboard from "./pages/Dashboard";
import * as auth from "./api/auth";
import type { JSX } from "react";

// Protected Route Wrapper
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { data: session, isPending } = auth.useSession();

  if (isPending) return <div className="h-screen flex items-center justify-center bg-zinc-900 text-zinc-100">Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Redirect root to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}