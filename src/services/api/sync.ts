import { apiEnabled, downloadActivities, uploadActivity } from '@/services/api/client';
import { getActivity, listUnsynced, markSynced, saveCompletedActivity } from '@/services/storage/database';

export async function syncActivities(email: string): Promise<void> {
  if (!apiEnabled()) return;
  const pending = await listUnsynced(email);
  for (const activity of pending) {
    await uploadActivity(activity);
    await markSynced(activity.clientId, new Date().toISOString());
  }

  const remote = await downloadActivities();
  for (const activity of remote) {
    const existing = await getActivity(activity.clientId);
    if (existing) continue;
    await saveCompletedActivity({
      ...activity,
      ownerEmail: email,
      demo: false,
      syncedAt: new Date().toISOString(),
      points: activity.points ?? [],
      splits: activity.splits ?? [],
    });
  }
}
