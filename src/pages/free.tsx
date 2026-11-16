import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { RouteMap } from '@/components/route-map';
import { useLiveActivity, useRecording } from '@/hooks/use-live-activity';
import { locationBlock, primeLocation } from '@/services/location';
import { bindScreenAwake, lockedTrackingActive, onLockedTracking, screenLockStopsTracking } from '@/services/run-presence';
import { deleteActivity } from '@/services/storage/database';
import { useSession } from '@/stores/session';
import type { Split } from '@/types/domain';
import type { GeoPoint } from '@/utils/geo';
import { isReliableFix } from '@/utils/geo';
import { formatClock, formatDistanceKm, formatPace } from '@/utils/format';

const COUNTDOWN_SECONDS = 10;

export function FreeRun() {
  const recording = useRecording();
  const startedAt = useRef<number | null>(null);
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [armed, setArmed] = useState(() => Boolean(recording.data));
  const live = useLiveActivity({ source: 'free', title: 'Corrida livre', enabled: armed });
  const name = useSession((state) => state.name);
  const navigate = useNavigate();
  const [fix, setFix] = useState<GeoPoint | null>(null);
  const paused = live.activity?.status === 'paused';
  const initial = (name?.split(' ')[0] ?? 'A').slice(0, 1).toUpperCase();
  const distance = live.activity?.distanceMeters ?? 0;
  const splits = live.activity?.splits ?? [];
  const precise = isReliableFix(fix ?? { accuracy: null });
  const [lockedTracking, setLockedTracking] = useState(lockedTrackingActive);

  useEffect(() => onLockedTracking(setLockedTracking), []);
  useEffect(() => bindScreenAwake(), []);

  useEffect(() => {
    if (recording.isPending || armed) return;
    if (recording.data) {
      setArmed(true);
      return;
    }
    if (startedAt.current == null) startedAt.current = Date.now();
    const origin = startedAt.current;
    const timer = window.setInterval(() => {
      const left = COUNTDOWN_SECONDS - Math.floor((Date.now() - origin) / 1000);
      if (left <= 0) {
        setCount(0);
        setArmed(true);
        window.clearInterval(timer);
        return;
      }
      setCount(left);
    }, 200);
    return () => window.clearInterval(timer);
  }, [armed, recording.data, recording.isPending]);

  async function finish() {
    const activity = await live.finish();
    if (!activity) return;
    navigate(`/atividade/${activity.clientId}/concluida`, { replace: true });
  }

  async function discard() {
    if (live.activity) {
      await live.pause();
      await deleteActivity(live.activity.clientId);
    }
    navigate('/inicio');
  }

  const block = locationBlock();
  const gps =
    block === 'http'
      ? 'O celular bloqueia a localização em links http. Abra o app em um endereço https.'
      : block === 'in-app'
        ? 'Este aplicativo bloqueia o GPS. Abra o link no Chrome ou no Safari.'
        : live.permission === 'denied'
          ? 'Localização bloqueada. Permita o acesso nas configurações do navegador e toque em permitir.'
          : precise && lockedTracking
            ? 'Pode bloquear a tela. A distância continua sendo medida.'
            : precise && screenLockStopsTracking()
              ? null
              : precise
                ? 'GPS preciso. Mantenha o app aberto para medir o percurso.'
                : fix
                  ? 'Localização aproximada. A distância entra quando o GPS ficar preciso.'
                  : 'Buscando a localização.';

  return (
    <main className="live-run">
      <div className="live-map">
        <RouteMap
          points={live.activity?.points ?? []}
          follow
          dark
          height="fill"
          searching={live.permission === 'unknown' || live.permission === 'granted'}
          onLive={setFix}
        />
        <header className="live-bar">
          <button
            className="live-icon"
            type="button"
            onClick={() => {
              void live.pause().then(() => navigate('/inicio'));
            }}
            aria-label="Voltar"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <p>Corrida livre</p>
          <div className="avatar" aria-hidden="true">
            {initial}
          </div>
        </header>
        {gps ? (
          <div className="gps-anchor">
            <svg className="gps-stem" viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true">
              <line x1="64" y1="78" x2="100" y2="2" />
            </svg>
            <div className="gps-chip">
              <i />
              <span>{gps}</span>
              {live.permission === 'denied' && !block ? (
                <button className="gps-allow" type="button" onClick={() => primeLocation()}>
                  Permitir localização
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <section className="live-sheet">
        <p className={paused ? 'live-status paused' : 'live-status'}>
          <i />
          {paused ? 'Pausada' : 'Em movimento'}
        </p>
        <p className="live-distance">
          {formatDistanceKm(distance)}
          <small>km</small>
        </p>
        <div className="live-stats">
          <div>
            <span>Tempo</span>
            <strong>{formatClock(live.movingSeconds)}</strong>
          </div>
          <div>
            <span>Ritmo/km</span>
            <strong>{formatPace(live.currentPace)}</strong>
          </div>
          <div>
            <span>Média/km</span>
            <strong>{formatPace(live.averagePace)}</strong>
          </div>
        </div>
        {distance > 0 || splits.length > 0 ? <Partials distance={distance} splits={splits} /> : null}
        <div className="live-actions">
          <button className="live-pause" type="button" onClick={() => (paused ? void live.resume() : void live.pause())}>
            {paused ? <PlayIcon /> : <PauseIcon />}
            {paused ? 'Retomar' : 'Pausar'}
          </button>
          <button className="live-finish" type="button" onClick={() => void finish()}>
            <StopIcon />
            Finalizar
          </button>
        </div>
        <button className="live-discard" type="button" onClick={() => void discard()}>
          Descartar atividade
        </button>
      </section>
      {armed ? null : (
        <div className="countdown" role="status" aria-live="assertive">
          <button className="summary-icon" type="button" onClick={() => navigate('/inicio')} aria-label="Voltar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14.5 6.5 9 12l5.5 5.5" />
            </svg>
          </button>
          <p>A corrida começa em</p>
          <strong>{count}</strong>
        </div>
      )}
    </main>
  );
}

function Partials({ distance, splits }: { distance: number; splits: Split[] }) {
  const partial = distance % 1000;
  const currentKm = Math.floor(distance / 1000) + 1;
  const showPartial = partial >= 1 && currentKm > splits.length;
  const fastest = splits.reduce((best, split) => Math.min(best, split.paceSecondsPerKm), Number.POSITIVE_INFINITY);
  const slowest = splits.reduce((worst, split) => Math.max(worst, split.paceSecondsPerKm), 0);
  const rows = [...splits].reverse();

  return (
    <div className="partials">
      <div className="partials-head">
        <p>Parciais</p>
        <span>ritmo por km</span>
      </div>
      {showPartial ? (
        <div className="partial current">
          <span>km {currentKm}</span>
          <i>
            <b style={{ width: `${Math.max(12, Math.round((partial / 1000) * 100))}%` }} />
          </i>
          <strong>{formatDistanceKm(partial)} km</strong>
        </div>
      ) : null}
      {rows.map((split) => {
        const best = splits.length > 1 && split.paceSecondsPerKm === fastest;
        const width = slowest <= fastest ? 70 : Math.round(28 + ((slowest - split.paceSecondsPerKm) / (slowest - fastest)) * 62);
        return (
          <div className={best ? 'partial best' : 'partial'} key={split.kilometer}>
            <span>km {split.kilometer}</span>
            <i>
              <b style={{ width: `${width}%` }} />
            </i>
            <strong>
              {formatPace(split.paceSecondsPerKm)}
              {best ? <em>Melhor</em> : null}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h3v12H8zM13 6h3v12h-3z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5v11l9-5.5z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
  );
}
