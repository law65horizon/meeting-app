import { createBrowserRouter, RouterProvider, Navigate, useLocation, Outlet } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import theme from '../theme';
import AppLayout from '../components/layout/AppLayout';
import AuthPage from '../pages/auth/AuthPage';
import HomePage from '../pages/home/HomePage';
import MeetingsPage from '../pages/meetings/MeetingsPage';
import StartMeetingPage from '../pages/start-meeting/StartMeetingPage';
import MeetingRoom from '../pages/meeting/MeetingRoom';
import SettingsPage from '../pages/settings/SettingsPage';
import ProfilePage from '../pages/profile/ProfilePage';
import SupportPage from '../pages/support/SupportPage';
import useAuthStore from '../store/authStore';
import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import NewMeetingRoom from '../pages/newMeeting/newMeeting';

// ProtectedRoute component to restrict access to authenticated users
const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

const PublicRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return user ? <Navigate to="/" replace /> : <Outlet />;
};
 
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'meetings', element: <MeetingsPage /> },
          { path: 'start-meeting', element: <StartMeetingPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'support', element: <SupportPage /> },
        ],
      },
      {
        element: <PublicRoute />,
        children: [
          { path: 'auth', element: <AuthPage /> },
        ],
      },
      {
        path: 'meeting/:roomId',
        element: <MeetingRoom />,
      },
      {
        path: 'meetingxx/:id',
        element: <NewMeetingRoom />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

const Routes = () => {
  const { checkAuth } = useAuthStore();
  // const { user: firebaseUser } = useAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
};

export default Routes;