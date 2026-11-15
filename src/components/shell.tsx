import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { primeLocation } from '@/services/location';

export function Shell() {
  const location = useLocation();
  const evolution = location.pathname === '/evolucao' || location.pathname.startsWith('/atividade');

  return (
    <div className="shell">
      <Outlet />
      <nav className="tabbar" aria-label="Principal">
        <NavLink to="/inicio" className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          <HomeIcon />
          <span>Início</span>
        </NavLink>
        <NavLink to="/plano" className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          <PlanIcon />
          <span>Plano</span>
        </NavLink>
        <NavLink to="/corrida" className="run-tab" aria-label="Correr" onClick={() => primeLocation()}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6.8v10.4L18 12z" />
          </svg>
        </NavLink>
        <NavLink to="/evolucao" className={evolution ? 'tab active' : 'tab'}>
          <ChartIcon />
          <span>Evolução</span>
        </NavLink>
        <NavLink to="/perfil" className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          <UserIcon />
          <span>Perfil</span>
        </NavLink>
      </nav>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M4 10h16" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19h16M7 16v-4M12 16V7M17 16v-7" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19c1.4-3 3.8-4.5 7-4.5S17.6 16 19 19" />
    </svg>
  );
}
