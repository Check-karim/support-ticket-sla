import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.js";
import { LoginPage } from "./pages/LoginPage.js";
import { NewTicketPage } from "./pages/NewTicketPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { TicketDetailPage } from "./pages/TicketDetailPage.js";
import { TicketsPage } from "./pages/TicketsPage.js";

export function App() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={token ? <TicketsPage /> : <Navigate to="/login" replace />} />
      <Route
        path="/tickets/new"
        element={token ? <NewTicketPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/tickets/:id"
        element={token ? <TicketDetailPage /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
