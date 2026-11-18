import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  activitiesBetween,
  bestPace,
  currentWeek,
  distanceRecords,
  filterActivities,
  monthDistance,
  totals,
  type ActivityFilter,
} from '@/features/history/stats';
import { useActivities } from '@/hooks/use-live-activity';
import type { Activity } from '@/types/domain';
import { addDays, formatClock, formatDayMonth, formatDistanceKm, formatPace, mondayOf } from '@/utils/format';

const filters: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'free', label: 'Corridas' },
  { id: 'guided', label: 'Treinos' },
];

export function Progress() {
  const query = useActivities();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const activities = filterActivities(query.data ?? [], filter);
  const month = totals(activities.filter((activity) => inThisMonth(activity)));
  const week = activitiesBetween(activities, mondayOf(new Date()), addDays(mondayOf(new Date()), 7));
  const weekSummary = totals(week);
  const days = currentWeek(activities);
  const activeDays = days.filter((day) => day.ran).length;
  const records = distanceRecords(activities);
  const latest = showAll ? activities : activities.slice(0, 3);

  return (
    <main className="screen evo">
      <div>
        <p className="brand">DADOS DE CORRIDA</p>
        <h1>Seu progresso</h1>
      </div>
      <div className="evo-filters">
        {filters.map((item) => (
          <button key={item.id} className={filter === item.id ? 'on' : undefined} type="button" onClick={() => setFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {query.isPending ? <p className="muted">Carregando histórico.</p> : null}
      {query.isError ? <p className="error">Não foi possível carregar o histórico.</p> : null}
      {!query.isPending && !query.isError ? (
        <>
          <section className="evo-month">
            <div>
              <p>
                {formatDistanceKm(monthDistance(activities), 1)}
                <small>km</small>
              </p>
              <span>distância neste mês</span>
            </div>
            <div>
              <p>{month.count}</p>
              <span>{month.count === 1 ? 'corrida' : 'corridas'}</span>
              <p>{monthClock(month.movingSeconds)}</p>
              <span>tempo total</span>
            </div>
          </section>

          <section className="evo-block">
            <header>
              <h2>Esta semana</h2>
              <span>{activeDays === 1 ? '1 dia ativo' : `${activeDays} dias ativos`}</span>
            </header>
            <div className="evo-week">
              {days.map((day) => (
                <div key={day.key} className={day.today ? 'today' : day.ran ? 'ran' : undefined}>
                  <span>{day.label}</span>
                  {day.today ? <strong>{day.number}</strong> : day.ran ? <strong><Check /></strong> : <i />}
                </div>
              ))}
            </div>
            <div className="evo-paces">
              <article>
                <span>Ritmo médio</span>
                <strong>
                  {formatPace(weekSummary.averagePaceSecondsPerKm)}
                  <small>/km</small>
                </strong>
              </article>
              <article>
                <span>Melhor ritmo</span>
                <strong>
                  {formatPace(bestPace(week))}
                  <small>/km</small>
                </strong>
              </article>
            </div>
          </section>

          <section className="evo-block">
            <p className="brand">RECORDES PESSOAIS</p>
            <div className="evo-records">
              {records.map((record) => (
                <article key={record.label} className={record.seconds == null ? 'locked' : undefined}>
                  <header>
                    <span>{record.label.toUpperCase()}</span>
                    {record.seconds == null ? <Lock /> : <Trophy />}
                  </header>
                  <strong>{record.seconds == null ? 'Em aberto' : shortClock(record.seconds)}</strong>
                  <p>{record.seconds == null ? `corra ${record.label}` : 'seu melhor tempo'}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="evo-block">
            <header>
              <h2>Últimas corridas</h2>
              {activities.length > 3 ? (
                <button type="button" onClick={() => setShowAll((open) => !open)}>
                  {showAll ? 'Ver menos' : 'Ver todas'}
                </button>
              ) : null}
            </header>
            {activities.length === 0 ? (
              <p className="muted">Quando você finalizar um treino, ele aparece aqui.</p>
            ) : (
              <ul className="evo-runs">
                {latest.map((activity) => (
                  <li key={activity.clientId}>
                    <Link to={`/atividade/${activity.clientId}`}>
                      <i aria-hidden="true">{activityIcon(activity)}</i>
                      <div>
                        <strong>{activity.title}</strong>
                        <span>{formatDayMonth(activity.startedAt.slice(0, 10))}</span>
                      </div>
                      <div>
                        <strong>{formatDistanceKm(activity.distanceMeters, 2)} km</strong>
                        <span>{formatPace(activity.averagePaceSecondsPerKm)}/km</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

function inThisMonth(activity: Activity, today = new Date()): boolean {
  const date = new Date(activity.startedAt);
  return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

function monthClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.round((safe % 3600) / 60);
  if (hours <= 0) return `${minutes}min`;
  return `${hours}h${String(minutes).padStart(2, '0')}min`;
}

function shortClock(totalSeconds: number): string {
  return formatClock(totalSeconds).replace(/^00:/, '').replace(/^0(?=\d:)/, '');
}

function activityIcon(activity: Activity) {
  if (/tiro/i.test(activity.title)) return <Bolt />;
  return <Route />;
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 12 4 4 8-8" />
    </svg>
  );
}

function Trophy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 6H5.5A2.5 2.5 0 0 0 8 10" />
      <path d="M16 6h2.5A2.5 2.5 0 0 1 16 10" />
      <path d="M12 13v3" />
      <path d="M9 20h6" />
      <path d="M10 17h4v3h-4Z" />
    </svg>
  );
}

function Lock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="11" width="12" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function Route() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 7c4 0 4 5 8 5" />
      <path d="M8 12c4 0 4 5 8 5" />
    </svg>
  );
}

function Bolt() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 3 5 14h7l-1 7 8-11h-7l1-7Z" />
    </svg>
  );
}
