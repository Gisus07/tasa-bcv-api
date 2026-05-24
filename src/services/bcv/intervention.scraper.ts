import { load } from 'cheerio';
import { UpstreamFormatError, UpstreamUnavailableError } from '../../lib/errors.js';
import { fetchBcv } from './client.js';
import { interventionUrl } from './urls.js';

export interface InterventionRecord {
  /** Day the intervention took place, ISO YYYY-MM-DD. */
  date: string;
  /** BCV intervention number, e.g. "011-26". */
  interventionNumber: string;
  /** Settlement rate Bs./EUR as a fixed-8 decimal string. */
  rate: string;
}

/**
 * Fetches and parses the BCV intervention history table.
 *
 * The page has two tables: the intervention history (Fecha | Nro | Bs./EUR) and
 * a per-bank buy/sell breakdown. We only want the first; rows are selected by
 * the intervention-specific Drupal view classes, so the bank table (which uses
 * different classes) is ignored automatically.
 */
export async function scrapeInterventions(): Promise<InterventionRecord[]> {
  const result = await fetchBcv(interventionUrl());
  if (!result) {
    throw new UpstreamUnavailableError('BCV intervention page returned no body');
  }
  return parseInterventionHtml(result.body.toString('utf-8'));
}

/** Pure, testable: takes the page HTML and returns every intervention row. */
export function parseInterventionHtml(html: string): InterventionRecord[] {
  const $ = load(html);
  const records: InterventionRecord[] = [];

  $('tr').each((_, tr) => {
    const row = $(tr);
    // These three classes only appear on intervention rows; the per-bank table
    // and the <thead> (no date span) are filtered out.
    const dateSpan = row.find('.views-field-field-fecha-del-indicador .date-display-single');
    const numCell = row.find('.views-field-field-nro-de-intervencion');
    const rateCell = row.find('.views-field-field-monto-intervencion');
    if (dateSpan.length === 0 || numCell.length === 0 || rateCell.length === 0) return;

    // The date span carries the canonical ISO date in its `content` attribute
    // (e.g. content="2026-05-21T00:00:00-04:00").
    const iso = (dateSpan.attr('content') ?? '').slice(0, 10);
    const interventionNumber = numCell.text().trim();
    const rateText = rateCell.text().trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !interventionNumber || !rateText) return;

    records.push({ date: iso, interventionNumber, rate: parseInterventionRate(rateText) });
  });

  if (records.length === 0) {
    throw new UpstreamFormatError('BCV intervention page: no intervention rows parsed');
  }
  return records;
}

/**
 * BCV numbers use "." as thousands separator and "," as decimal.
 * "710,95" → "710.95000000"; "5.849,72" → "5849.72000000".
 */
function parseInterventionRate(input: string): string {
  const cleaned = input.replace(/\./g, '').replace(',', '.');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) {
    throw new UpstreamFormatError(`Invalid intervention rate: "${input}"`);
  }
  return value.toFixed(8);
}
