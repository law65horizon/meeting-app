import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { Box, CircularProgress } from '@mui/material';
import { auth } from './lib/firebase';
import { useAuthStore } from './store/authStore';
import AuthPage from './pages/auth/AuthPage';
import HomePage from './pages/home/HomePage';
import MeetingRoom from './pages/meeting/MeetingRoom';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
 
export default function App() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, [setUser, setLoading]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<AuthGuard><HomePage /></AuthGuard>} />
        <Route path="/meeting/:roomId" element={<MeetingRoom /> } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}