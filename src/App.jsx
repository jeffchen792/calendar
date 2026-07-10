import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth, initAuth } from "./store";
import { supabase } from "./lib/supabase";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import { useEffect } from "react";

function App() {
  const { user, loading } = useAuth();

  useEffect(() => {
    initAuth();
    if (!supabase) return;
    // OAuth 轉址回來（SIGNED_IN）或登出時重新推導身分
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") initAuth();
    });
    return () => sub.subscription.unsubscribe();
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
