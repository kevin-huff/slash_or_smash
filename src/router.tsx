import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ControlDashboard } from './routes/ControlDashboard';
import { JudgeConsole } from './routes/JudgeConsole';
import { Landing } from './routes/Landing';
import { Leaderboard } from './routes/Leaderboard';
import { NotFound } from './routes/NotFound';
import { ProducerLogin } from './routes/ProducerLogin';
import { OverlayLeaderboard } from './routes/overlay/OverlayLeaderboard';
import { OverlayLayout } from './routes/overlay/OverlayLayout';
import { OverlayUnified } from './routes/overlay/OverlayUnified';
import { RequireAuth } from './components/RequireAuth';
import { AudienceVote } from './routes/AudienceVote';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/control/login',
    element: <ProducerLogin />,
  },
  {
    path: '/control',
    element: (
      <RequireAuth>
        <ControlDashboard />
      </RequireAuth>
    ),
  },
  {
    path: '/judge',
    element: <JudgeConsole />,
  },
  {
    path: '/leaderboard',
    element: <Leaderboard />,
  },
  {
    path: '/vote',
    element: <AudienceVote />,
  },
  {
    path: '/overlay',
    element: <OverlayLayout />,
    children: [
      {
        index: true,
        element: <OverlayUnified />,
      },
      {
        path: 'leaderboard',
        element: <OverlayLeaderboard />,
      },
      {
        path: '*',
        element: <Navigate to="/overlay" replace />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);
