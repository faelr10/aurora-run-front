import { useState } from 'react';
import { Link } from 'react-router-dom';

import { distanceRecords, filterActivities, monthDistance, totals, weeklyPace, type ActivityFilter } from '@/features/history/stats';
import { useActivities } from '@/hooks/use-live-activity';
import { formatClock, formatDayMonth, formatDistanceKm, formatDuration, formatPace } from '@/utils/format';

const filters: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'free', label: 'Corridas' },
  { id: 'guided', label: 'Treinos' },
];

export function Progress() {
  const query = useActivities();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const activities = filterActivities(query.data ?? [], filter);
  const summary = totals(activities);
  const records = distanceRecords(activities);
  const weeks = weeklyPace(activities);
  const paces = weeks.map((point) => point.pace).filter((pace): pace is number => pace != null);
  const max = Math.max(...paces, 1);
  const min = Math.min(...paces, max);

  return (
    <main className="screen">
      <div>
        <p className="brand">DADOS DE CORRIDA</p>
        <h1>Seu progresso</h1>
      </div>
      <div className="filters">
        {filters.map((item) => (
          <button key={item.id} className={filter === item.id ? 'chip on' : 'chip'} type="button" onClick={() => setFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {query.isPending ? <p className="muted">Carregando histórico.</p> : null}
      {query.isError ? <p className="error">Não foi possível carregar o histórico.</p> : null}
      {!query.isPending && !query.isError ? (
        <>
          <section className="progress-metrics">
            <div>
              <p className="big">
                {formatDistanceKm(monthDistance(activities), 1)}
                <small>KM</small>
              </p>
              <p className="metric-label">DISTÂNCIA NESTE MÊS</p>
            </div>
            <div className="side">
              <div>
                <strong>{summary.count}</strong>
                <p className="metric-label">CORRIDAS</p>
              </div>
              <div>
                <strong>{formatDuration(summary.movingSeconds)}</strong>
                <p className="metric-label">TEMPO TOTAL</p>
              </div>
            </div>
          </section>
          <section className="chart-card">
            <p className="eyebrow">RITMO MÉDIO</p>
            <h2>Últimas 8 semanas</h2>
            <div className="chart">
              {weeks.map((point, index) => {
                const height = point.pace == null ? 6 : 18 + ((max - point.pace) / Math.max(1, max - min)) * 72;
                return (
                  <div key={`${point.label}-${index}`}>
                    <span style={{ height }} />
                    <small>{point.label}</small>
                  </div>
                );
              })}
            </div>
          </section>
          <p className="brand">RECORDES PESSOAIS</p>
          <div className="records">
            {records.map((record) => (
              <article key={record.label}>
                <p>{record.label.toUpperCase()}</p>
                <strong>{record.seconds == null ? '—' : formatClock(record.seconds).replace(/^00:/, '')}</strong>
              </article>
            ))}
          </div>
          {activities.length === 0 ? (
            <section className="block">
              <h2>Nenhuma corrida ainda</h2>
              <p className="muted">Quando você finalizar um treino, ele aparece aqui.</p>
            </section>
          ) : (
            <>
              <p className="brand">ÚLTIMAS CORRIDAS</p>
              <ul className="activity-list">
                {activities.map((activity, index) => (
                  <li key={activity.clientId}>
                    <Link to={`/atividade/${activity.clientId}`}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{activity.title}</strong>
                        <p className="muted">{formatDayMonth(activity.startedAt.slice(0, 10))}</p>
                      </div>
                      <div className="end">
                        <strong>{formatDistanceKm(activity.distanceMeters, 2)} km</strong>
                        <p className="muted">{formatPace(activity.averagePaceSecondsPerKm)}/km</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : null}
    </main>
  );
}
