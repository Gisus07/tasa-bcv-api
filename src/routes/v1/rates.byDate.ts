import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { db } from '../../db/client.js';
import { ErrorResponse } from '../../schemas/common.js';
import { ByDateParams, RatesPair } from '../../schemas/rates.js';
import { getPairByDate } from '../../services/rates.service.js';

const route = createRoute({
  method: 'get',
  path: '/rates/{date}',
  tags: ['rates'],
  summary: 'Tasas USD y EUR para una fecha específica',
  description:
    'Devuelve ambas monedas para la fecha indicada. Fines de semana y feriados se devuelven con `propagated_currencies` indicando qué monedas se heredaron del último día hábil.',
  request: { params: ByDateParams },
  responses: {
    200: {
      description: 'Tasas para la fecha solicitada',
      content: {
        'application/json': {
          schema: RatesPair,
          examples: {
            normal: {
              summary: 'Día hábil con publicación real',
              value: {
                date: '2026-05-14',
                usd: 510.7873,
                eur: 598.12171255,
              },
            },
            weekend: {
              summary: 'Fin de semana (ambas tasas propagadas)',
              value: {
                date: '2026-05-16',
                usd: 510.7873,
                eur: 601.4520428,
                propagated_currencies: ['USD', 'EUR'],
              },
            },
            partial_propagation: {
              summary: 'Solo USD propagado (EUR sí publicó)',
              value: {
                date: '2026-05-19',
                usd: 510.7873,
                eur: 602.18768455,
                propagated_currencies: ['USD'],
              },
            },
            pre_redenomination: {
              summary: 'Pre-redenominación 2021 (Bs.S, magnitudes ~10^5)',
              value: {
                date: '2020-03-27',
                usd: 73830.1638,
                eur: 81349.02768139,
              },
            },
          },
        },
      },
    },
    400: {
      description: 'Fecha fuera de rango o anterior al histórico disponible',
      content: {
        'application/json': {
          schema: ErrorResponse,
          examples: {
            out_of_range: {
              summary: 'Fecha futura',
              value: {
                error: 'La fecha 2027-01-01 está en el futuro. Máxima permitida: 2026-05-20.',
                code: 'DATE_OUT_OF_RANGE',
                details: { date: '2027-01-01', maxDate: '2026-05-20' },
              },
            },
            before_history: {
              summary: 'Fecha anterior al histórico',
              value: {
                error: 'No hay datos históricos para USD antes de 2016-01-04. Solicitado: 2015-12-31.',
                code: 'DATE_BEFORE_HISTORY',
                details: { date: '2015-12-31', minDate: '2016-01-04', currency: 'USD' },
              },
            },
            invalid_format: {
              summary: 'Formato inválido',
              value: {
                error: 'Entrada inválida',
                code: 'VALIDATION_ERROR',
                details: {
                  issues: [
                    {
                      path: 'date',
                      message:
                        'La fecha debe estar en formato YYYY-MM-DD y ser un día válido del calendario gregoriano',
                      code: 'custom',
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    404: {
      description: 'No hay tasas para esa fecha (datos aún no ingresados)',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const ratesByDate = new OpenAPIHono({ defaultHook: defaultZodHook });
ratesByDate.openapi(route, async (c) => {
  const { date } = c.req.valid('param');
  const data = await getPairByDate(db(), date);
  return c.json(data, 200);
});
