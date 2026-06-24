import { describe, it, expect } from 'vitest';
import { parseInterventionHtml } from './intervention.scraper.js';

// Mirrors the real BCV page: an intervention history table followed by a
// per-bank buy/sell breakdown table that must be ignored.
const SAMPLE_HTML = `
<table class="views-table cols-3 table table-striped">
  <thead>
    <tr>
      <th class="views-field views-field-field-fecha-del-indicador">Fecha de Intervencion</th>
      <th class="views-field views-field-field-nro-de-intervencion">Nro. de Intervencion</th>
      <th class="views-field views-field-field-monto-intervencion">Tipo de Cambio Bs./EUR</th>
    </tr>
  </thead>
  <tbody>
    <tr class="odd">
      <td class="views-field views-field-field-fecha-del-indicador">
        <span class="date-display-single" property="dc:date" datatype="xsd:dateTime" content="2026-05-21T00:00:00-04:00">21-05-2026</span>
      </td>
      <td class="views-field views-field-field-nro-de-intervencion">011-26</td>
      <td class="views-field views-field-field-monto-intervencion">710,95</td>
    </tr>
    <tr class="even">
      <td class="views-field views-field-field-fecha-del-indicador">
        <span class="date-display-single" content="2026-05-20T00:00:00-04:00">20-05-2026</span>
      </td>
      <td class="views-field views-field-field-nro-de-intervencion">011-26</td>
      <td class="views-field views-field-field-monto-intervencion">708,64</td>
    </tr>
    <tr class="odd">
      <td class="views-field views-field-field-fecha-del-indicador">
        <span class="date-display-single" content="2019-05-13T00:00:00-04:00">13-05-2019</span>
      </td>
      <td class="views-field views-field-field-nro-de-intervencion">014-19</td>
      <td class="views-field views-field-field-monto-intervencion">5.849,72</td>
    </tr>
  </tbody>
</table>
<table class="views-table cols-3 table">
  <thead>
    <tr>
      <th class="views-field views-field-views-conditional">Banco</th>
      <th class="views-field views-field-field-tasa-compra">Compra</th>
      <th class="views-field views-field-field-tasa-venta">Venta</th>
    </tr>
  </thead>
  <tbody>
    <tr class="odd">
      <td class="views-field views-field-views-conditional">Banesco</td>
      <td class="views-field views-field-field-tasa-compra">566,2635</td>
      <td class="views-field views-field-field-tasa-venta">627,5695</td>
    </tr>
  </tbody>
</table>
`;

describe('parseInterventionHtml', () => {
  it('parses intervention rows: ISO date from the content attr, number, Bs./EUR rate', () => {
    const records = parseInterventionHtml(SAMPLE_HTML);
    expect(records).toHaveLength(3);
    expect(records[0]).toEqual({
      date: '2026-05-21',
      interventionNumber: '011-26',
      rate: '710.95000000',
    });
    expect(records[1]).toEqual({
      date: '2026-05-20',
      interventionNumber: '011-26',
      rate: '708.64000000',
    });
  });

  it('handles thousands separators in older rates (5.849,72 -> 5849.72)', () => {
    const old = parseInterventionHtml(SAMPLE_HTML).find(
      (r) => r.date === '2019-05-13',
    );
    expect(old?.rate).toBe('5849.72000000');
    expect(old?.interventionNumber).toBe('014-19');
  });

  it('ignores the per-bank breakdown table (different view classes)', () => {
    const records = parseInterventionHtml(SAMPLE_HTML);
    expect(records).toHaveLength(3); // no Banesco / compra / venta rows
    expect(records.some((r) => r.interventionNumber === 'Banesco')).toBe(false);
  });

  it('throws UpstreamFormatError when there are no intervention rows', () => {
    expect(() =>
      parseInterventionHtml('<table><tbody></tbody></table>'),
    ).toThrowError(/no intervention rows/);
  });
});
