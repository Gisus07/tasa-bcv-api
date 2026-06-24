import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { Database } from './client.js';
import {
  interventions,
  type Intervention,
  type NewIntervention,
} from './schema.js';

/**
 * Idempotent batch upsert of intervention rows. On conflict (same date) it
 * updates only when the rate or number actually changed, so re-seeding the full
 * history or re-running the daily check is a no-op for unchanged rows.
 */
export async function upsertInterventions(
  d: Database,
  batch: NewIntervention[],
): Promise<number> {
  if (batch.length === 0) return 0;
  // Dedupe by date (last wins). The BCV table has one row per day, but guard
  // against a parsed batch containing a date twice (ON CONFLICT rejects dupes
  // inside a single VALUES list).
  const map = new Map<string, NewIntervention>();
  for (const row of batch) map.set(row.date, row);
  const deduped = [...map.values()];

  const inserted = await d
    .insert(interventions)
    .values(deduped)
    .onConflictDoUpdate({
      target: interventions.date,
      set: {
        interventionNumber: sql`excluded.intervention_number`,
        rate: sql`excluded.rate`,
        source: sql`excluded.source`,
      },
      setWhere: sql`${interventions.rate} IS DISTINCT FROM excluded.rate
                 OR ${interventions.interventionNumber} IS DISTINCT FROM excluded.intervention_number`,
    })
    .returning({ date: interventions.date });
  return inserted.length;
}

/** Most recent intervention. Events are punctual — there is no propagation. */
export async function getLatestIntervention(
  d: Database,
): Promise<Intervention | undefined> {
  const rows = await d
    .select()
    .from(interventions)
    .orderBy(desc(interventions.date))
    .limit(1);
  return rows[0];
}

/** Intervention for a specific date, if one happened that day. */
export async function getInterventionByDate(
  d: Database,
  date: string,
): Promise<Intervention | undefined> {
  const rows = await d
    .select()
    .from(interventions)
    .where(eq(interventions.date, date))
    .limit(1);
  return rows[0];
}

/** Interventions within [from, to] (inclusive), oldest first. */
export async function getInterventionHistory(
  d: Database,
  from: string,
  to: string,
): Promise<Intervention[]> {
  return d
    .select()
    .from(interventions)
    .where(and(gte(interventions.date, from), lte(interventions.date, to)))
    .orderBy(asc(interventions.date));
}
