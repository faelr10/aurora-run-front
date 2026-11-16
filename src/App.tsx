import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Shell } from '@/components/shell';
import { ActivityDetail, ActivityDone, Notifications } from '@/pages/activity';
import { Login, Register } from '@/pages/auth';
import { FreeRun } from '@/pages/free';
import { Onboarding } from '@/pages/onboarding';
import { Guided } from '@/pages/guided';
import { Home } from '@/pages/home';
import { Plan } from '@/pages/plan';
import { Profile } from '@/pages/profile';
import { Progress } from '@/pages/progress';
import { Workout } from '@/pages/workout';
import { useSession } from '@/stores/session';

export default function App() {
  const ready = useSession((state) => state.ready);
  const hydrate = useSession((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!ready) {
    return (
      <div className="boot">
        <p className="brand">AURORA RUN</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Navigate to="/inicio" replace />} />
        <Route element={<Shell />}>
          <Route path="/inicio" element={<Home />} />
          <Route path="/plano" element={<Plan />} />
          <Route path="/evolucao" element={<Progress />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/atividade/:activityId" element={<ActivityDetail />} />
          <Route path="/atividade/:activityId/concluida" element={<ActivityDone />} />
        </Route>
        <Route path="/entrar" element={<Login />} />
        <Route path="/criar-conta" element={<Register />} />
        <Route path="/avaliacao" element={<Onboarding />} />
        <Route path="/corrida" element={<FreeRun />} />
        <Route path="/treino/:sessionId" element={<Workout />} />
        <Route path="/treino/:sessionId/guiado" element={<Guided />} />
        <Route path="/avisos" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </div>
  );
}
