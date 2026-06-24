import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { db } from '../../db/client.js';
import { codeSamplesFor } from '../../i18n/codeSamples.js';
import { defaultZodHook } from '../../middleware/zodHook.js';
import { ErrorResponse } from '../../schemas/common.js';
import { InterventionLatest } from '../../schemas/intervention.js';
import { getInterventionLatest } from '../../services/intervention.service.js';

const route = createRoute({
  method: 'get',
  path: '/intervention/latest',
  tags: ['intervention'],
  summary: 'Última intervención cambiaria del BCV',
  description:
    'Última intervención cambiaria publicada por el BCV, con su tipo de cambio en Bs./EUR. Es una serie INDEPENDIENTE de la tasa oficial USD/EUR. Para saber si hubo intervención hoy, compara el campo `date` con la fecha actual. Solo ocurre en días hábiles; no se propaga.',
  ...({
    'x-codeSamples': codeSamplesFor({ path: '/v1/intervention/latest' }),
  } as Record<string, unknown>),
  responses: {
    200: {
      description: 'Última intervención registrada',
      content: { 'application/json': { schema: InterventionLatest } },
    },
    404: {
      description: 'Aún no hay intervenciones registradas',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export const interventionLatest = new OpenAPIHono({
  defaultHook: defaultZodHook,
});
interventionLatest.openapi(route, async (c) => {
  return c.json(await getInterventionLatest(db()), 200);
});
