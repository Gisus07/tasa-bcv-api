export type Currency = 'USD' | 'EUR';

/** Normalized rate record produced by parsers and the daily scraper. */
export interface RateRecord {
  /** Date the rate applies on, ISO YYYY-MM-DD. */
  date: string;
  currency: Currency;
  /** Numeric value serialized as string to preserve full precision for the DB. */
  rate: string;
  /** Provenance: filename + sheet, or 'scraper:home'. Used for auditability. */
  sourceFile: string;
  /** When known (EUR XLS provides this), the date BCV published the rate. */
  publishedAt?: string;
}
