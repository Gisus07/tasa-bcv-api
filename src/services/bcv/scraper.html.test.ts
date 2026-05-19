import { describe, it, expect } from 'vitest';
import { parseBcvHomeHtml } from './scraper.html.js';

const SAMPLE_HTML = `
<html>
<body>
  <div id="euro" class="col-sm-12 col-xs-12 ">
    <div class="field-content">
      <div class="row recuadrotsmc">
        <div class="col-sm-6 col-xs-6"><span>EUR</span></div>
        <div class="col-sm-6 col-xs-6 centrado textp">
          <strong class="strong-tb"> 602,18768455</strong>
        </div>
      </div>
    </div>
  </div>
  <div id="dolar" class="col-sm-12 col-xs-12 ">
    <div class="field-content">
      <div class="row recuadrotsmc">
        <div class="col-sm-6 col-xs-6"><span>USD</span></div>
        <div class="col-sm-6 col-xs-6 centrado textp">
          <strong class="strong-tb">517,96190000</strong>
        </div>
      </div>
    </div>
  </div>
  <div class="pull-right dinpro center">
    Fecha Valor:
    <span class="date-display-single" property="dc:date" datatype="xsd:dateTime"
          content="2026-05-19T00:00:00-04:00">Martes, 19 Mayo 2026</span>
  </div>
  <!-- unrelated dates further down the page; the scraper must not pick these -->
  <span class="date-display-single" content="2025-01-01T00:00:00-04:00">Reservas</span>
</body>
</html>
`;

describe('parseBcvHomeHtml', () => {
  it('extracts both USD and EUR from a realistic homepage snippet', () => {
    const records = parseBcvHomeHtml(SAMPLE_HTML);
    expect(records).toHaveLength(2);
    const usd = records.find((r) => r.currency === 'USD');
    const eur = records.find((r) => r.currency === 'EUR');
    expect(usd).toEqual({
      date: '2026-05-19',
      currency: 'USD',
      rate: '517.96190000',
      sourceFile: 'scraper:bcv-home',
    });
    expect(eur).toEqual({
      date: '2026-05-19',
      currency: 'EUR',
      rate: '602.18768455',
      sourceFile: 'scraper:bcv-home',
    });
  });

  it('uses the Fecha Valor date and ignores other .date-display-single nodes', () => {
    const records = parseBcvHomeHtml(SAMPLE_HTML);
    for (const r of records) expect(r.date).toBe('2026-05-19');
  });

  it('throws UpstreamFormatError when the USD selector is missing', () => {
    const html = SAMPLE_HTML.replace('id="dolar"', 'id="x"');
    expect(() => parseBcvHomeHtml(html)).toThrowError(/USD/);
  });

  it('throws UpstreamFormatError when the date attr is missing', () => {
    const html = SAMPLE_HTML.replace('content="2026-05-19T00:00:00-04:00"', '');
    expect(() => parseBcvHomeHtml(html)).toThrowError(/Fecha Valor/);
  });

  it('throws when a rate is non-numeric', () => {
    const html = SAMPLE_HTML.replace('517,96190000', '---');
    expect(() => parseBcvHomeHtml(html)).toThrowError(/USD rate/);
  });

  it('handles thousand separators correctly (e.g. "1.234,56")', () => {
    const html = SAMPLE_HTML.replace('517,96190000', '1.234,56789012');
    const usd = parseBcvHomeHtml(html).find((r) => r.currency === 'USD');
    expect(usd?.rate).toBe('1234.56789012');
  });
});
