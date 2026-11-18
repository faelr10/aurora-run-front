import { useState } from 'react';

import { syncFirebaseActivities } from '@/services/firebase/activities';
import { saveCompletedActivity } from '@/services/storage/database';
import type { Activity, ActivityStage } from '@/types/domain';
import { formatClock, formatDistanceKm } from '@/utils/format';
import { estimateCalories } from '@/utils/geo';

const statuses: Array<[ActivityStage['status'], string]> = [
  ['done', 'Feito'],
  ['skipped', 'Pulado'],
];

export function ActivityEditor({ activity, onClose, onSaved }: { activity: Activity; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(activity.title);
  const [distance, setDistance] = useState(formatDistanceKm(activity.distanceMeters));
  const [time, setTime] = useState(editClock(activity.movingSeconds));
  const [paces, setPaces] = useState(activity.splits.map((split) => editClock(split.paceSecondsPerKm)));
  const [stages, setStages] = useState(activity.stages ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    const distanceMeters = parseDistance(distance);
    const movingSeconds = parseClock(time);
    const parsedPaces = paces.map(parseClock);
    if (!title.trim()) {
      setError('Dê um nome para a corrida.');
      return;
    }
    if (distanceMeters == null || distanceMeters <= 0) {
      setError('Informe a distância em quilômetros.');
      return;
    }
    if (movingSeconds == null) {
      setError('Informe o tempo como 41:20.');
      return;
    }
    if (parsedPaces.some((pace) => pace == null)) {
      setError('Informe cada parcial como 6:53.');
      return;
    }
    const fullKilometers = Math.floor(distanceMeters / 1000);
    const splits = activity.splits.slice(0, fullKilometers).map((split, index) => {
      const pace = parsedPaces[index] ?? split.paceSecondsPerKm;
      return { ...split, kilometer: index + 1, durationSeconds: pace, paceSecondsPerKm: pace };
    });
    setSaving(true);
    setError(null);
    try {
      await saveCompletedActivity({
        ...activity,
        title: title.trim(),
        distanceMeters,
        movingSeconds,
        averagePaceSecondsPerKm: distanceMeters >= 10 ? Math.round(movingSeconds / (distanceMeters / 1000)) : 0,
        calories: estimateCalories(distanceMeters),
        splits,
        stages,
        syncedAt: null,
      });
      if (!activity.demo) await syncFirebaseActivities(activity.ownerEmail).catch(() => undefined);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.');
      setSaving(false);
    }
  }

  return (
    <div className="edit-sheet" role="dialog" aria-label="Editar corrida">
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h2>Editar corrida</h2>
        <label>
          Nome
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Distância (km)
          <input inputMode="decimal" value={distance} onChange={(event) => setDistance(event.target.value)} />
        </label>
        <label>
          Tempo
          <input inputMode="numeric" value={time} onChange={(event) => setTime(event.target.value)} placeholder="41:20" />
        </label>
        {paces.length > 0 ? (
          <fieldset>
            <legend>Parciais por km</legend>
            {paces.map((pace, index) => (
              <label key={activity.splits[index]?.kilometer ?? index}>
                KM {index + 1}
                <input
                  inputMode="numeric"
                  value={pace}
                  onChange={(event) => setPaces((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                />
              </label>
            ))}
          </fieldset>
        ) : null}
        {stages.length > 0 ? (
          <fieldset>
            <legend>Etapas</legend>
            {stages.map((stage) => (
              <div key={stage.id} className="edit-stage">
                <span>{stage.label}</span>
                <div>
                  {statuses.map(([value, label]) => (
                    <button key={value} type="button" className={stage.status === value ? 'on' : undefined} aria-pressed={stage.status === value} onClick={() => setStageStatus(stage.id, value)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>
        ) : null}
        <p>O ritmo e as calorias são recalculados ao salvar.</p>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button className="btn text" type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
      </form>
    </div>
  );

  function setStageStatus(id: string, status: ActivityStage['status']) {
    setStages((current) => current.map((stage) => (stage.id === id ? { ...stage, status } : stage)));
  }
}

function editClock(totalSeconds: number): string {
  return formatClock(totalSeconds).replace(/^00:/, '').replace(/^0(?=\d:)/, '');
}

function parseDistance(value: string): number | null {
  const trimmed = value.trim();
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed * 1000;
}

function parseClock(value: string): number | null {
  const parts = value.trim().split(':').map((part) => Number(part));
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) return null;
  const [first, second, third] = parts;
  const seconds = parts.length === 2 ? first * 60 + second : first * 3600 + second * 60 + (third ?? 0);
  return seconds >= 0 ? seconds : null;
}
