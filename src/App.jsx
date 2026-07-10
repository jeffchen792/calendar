import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import { useEffect } from "react";

function App() {
  const { user, loading, setUser } = useAuth();

  // Mock auth — replace with Supabase later
  useEffect(() => {
    const saved = localStorage.getItem("cosmic_user");
    if (saved) setUser(JSON.parse(saved));
    else setUser(null);
  }, []);

  if (loading) return <div className="min-h-screen bg-cosmic-bg flex items-center justify-center"><p className="text-star-dim animate-pulse">Loading...</p></div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Home />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
