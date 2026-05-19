import { load } from 'cheerio';
import { UpstreamFormatError, UpstreamUnavailableError } from '../../lib/errors.js';
import { fetchBcv } from './client.js';
import { bcvHomeUrl } from './urls.js';
import type { RateRecord } from './types.js';

/**
 * Fetches and parses today's USD/EUR rate from the BCV homepage.
 *
 * This is the source of truth for the daily update because:
 * 1. The homepage is updated by BCV before the XLS files are republished.
 * 2. The XLS files lag by hours and sometimes by a full day.
 *
 * The homepage publishes the rate that applies the *next* business day
 * (e.g. content="2026-05-19T...") even when fetched today. The scraper
 * trusts that "Fecha Valor" as the canonical application date.
 */
export async function scrapeBcvHomepage(): Promise<RateRecord[]> {
  const result = await fetchBcv(bcvHomeUrl());
  if (!result) {
    throw new UpstreamUnavailableError('BCV homepage returned no body');
  }
  const html = result.body.toString('utf-8');
  return parseBcvHomeHtml(html);
}

/** Pure, testable: takes the homepage HTML and returns USD + EUR records. */
export function parseBcvHomeHtml(html: string): RateRecord[] {
  const $ = load(html);

  const usdText = $('#dolar strong').first().text();
  const eurText = $('#euro strong').first().text();
  if (!usdText || !eurText) {
    throw new UpstreamFormatError(
      'BCV homepage: USD or EUR rate selector returned empty',
      {
        usdFound: Boolean(usdText),
        eurFound: Boolean(eurText),
      },
    );
  }

  const dateAttr = $('.pull-right.dinpro.center .date-display-single')
    .first()
    .attr('content');
  if (!dateAttr) {
    throw new UpstreamFormatError(
      'BCV homepage: "Fecha Valor" date-display-single attr missing',
    );
  }

  const applicationDate = parseIsoFromAttr(dateAttr);

  return [
    {
      date: applicationDate,
      currency: 'USD',
      rate: parseBcvDecimal(usdText, 'USD'),
      sourceFile: 'scraper:bcv-home',
    },
    {
      date: applicationDate,
      currency: 'EUR',
      rate: parseBcvDecimal(eurText, 'EUR'),
      sourceFile: 'scraper:bcv-home',
    },
  ];
}

/**
 * BCV publishes numbers with "." as thousands separator and "," as decimal.
 * Example: "510,78730000". Strip thousands separators, swap comma for dot.
 */
function parseBcvDecimal(input: string, currency: string): string {
  const cleaned = input.trim().replace(/\./g, '').replace(',', '.');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) {
    throw new UpstreamFormatError(`Invalid ${currency} rate on homepage: "${input}"`);
  }
  return value.toFixed(8);
}

/** Accepts "YYYY-MM-DDT..." and returns the date portion. */
function parseIsoFromAttr(attr: string): string {
  const match = attr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) {
    throw new UpstreamFormatError(`Invalid date attribute on homepage: "${attr}"`);
  }
  return match[1]!;
}
