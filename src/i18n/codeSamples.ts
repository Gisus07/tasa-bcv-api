/**
 * Helpers to generate the `x-codeSamples` block for each route.
 *
 * Scalar already renders auto-generated request snippets in many languages,
 * but the auto-generated versions don't know our canonical hostname. The
 * snippets here include the production URL so a reader can copy-paste
 * straight into their terminal.
 *
 * Keep these in English-style code (variable names, comments) regardless of
 * the surrounding i18n — code conventions are international.
 */

const API_BASE = 'https://tasa-bcv-api-production.up.railway.app';

export interface SampleOptions {
  /** Path including leading slash, e.g. `/v1/rates/2026-05-14`. Query string included if any. */
  path: string;
  /** HTTP method (default GET). */
  method?: 'GET' | 'POST';
  /** When true, include an `Authorization: Bearer ...` header. */
  bearer?: boolean;
  /** When set, include this JSON body in the request. */
  body?: Record<string, unknown>;
}

export interface CodeSample {
  lang: string;
  label: string;
  source: string;
}

export function codeSamplesFor(options: SampleOptions): CodeSample[] {
  return [
    { lang: 'curl', label: 'cURL', source: curlSample(options) },
    { lang: 'javascript', label: 'JavaScript (fetch)', source: jsFetchSample(options) },
    { lang: 'typescript', label: 'TypeScript', source: tsSample(options) },
    { lang: 'python', label: 'Python (requests)', source: pythonSample(options) },
    { lang: 'php', label: 'PHP (cURL)', source: phpSample(options) },
    { lang: 'go', label: 'Go (net/http)', source: goSample(options) },
  ];
}

function curlSample(o: SampleOptions): string {
  const lines = [`curl -X ${o.method ?? 'GET'} "${API_BASE}${o.path}"`];
  if (o.bearer) lines.push(`  -H "Authorization: Bearer $ADMIN_TOKEN"`);
  if (o.body) {
    lines.push(`  -H "Content-Type: application/json"`);
    lines.push(`  -d '${JSON.stringify(o.body)}'`);
  }
  return lines.join(' \\\n');
}

function jsFetchSample(o: SampleOptions): string {
  const method = o.method ?? 'GET';
  const headers: string[] = [];
  if (o.bearer) headers.push(`'Authorization': 'Bearer ' + ADMIN_TOKEN`);
  if (o.body) headers.push(`'Content-Type': 'application/json'`);

  const init: string[] = [`method: '${method}'`];
  if (headers.length > 0) init.push(`headers: { ${headers.join(', ')} }`);
  if (o.body) init.push(`body: JSON.stringify(${JSON.stringify(o.body)})`);

  return [
    `const res = await fetch('${API_BASE}${o.path}', {`,
    `  ${init.join(',\n  ')},`,
    `});`,
    `const data = await res.json();`,
    `console.log(data);`,
  ].join('\n');
}

function tsSample(o: SampleOptions): string {
  const method = o.method ?? 'GET';
  return [
    `// Tipos sugeridos (válidos con Zod o tu validador favorito)`,
    `interface RateRecord { date: string; currency: 'USD' | 'EUR'; rate: number; is_propagated?: true; propagated_from?: string }`,
    ``,
    `const res = await fetch('${API_BASE}${o.path}', { method: '${method}' });`,
    `if (!res.ok) throw new Error(\`HTTP \${res.status}\`);`,
    `const data = await res.json();`,
  ].join('\n');
}

function pythonSample(o: SampleOptions): string {
  const method = o.method ?? 'GET';
  const lines: string[] = [`import requests`, ``];
  if (o.bearer) lines.push(`headers = {"Authorization": f"Bearer {ADMIN_TOKEN}"}`);
  const args: string[] = [`"${API_BASE}${o.path}"`];
  if (o.bearer) args.push(`headers=headers`);
  if (o.body) args.push(`json=${pythonRepr(o.body)}`);
  lines.push(`r = requests.${method.toLowerCase()}(${args.join(', ')})`);
  lines.push(`r.raise_for_status()`);
  lines.push(`print(r.json())`);
  return lines.join('\n');
}

function phpSample(o: SampleOptions): string {
  const method = o.method ?? 'GET';
  const lines: string[] = [
    `<?php`,
    `$ch = curl_init();`,
    `curl_setopt($ch, CURLOPT_URL, '${API_BASE}${o.path}');`,
    `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');`,
    `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);`,
  ];
  const headers: string[] = [];
  if (o.bearer) headers.push(`'Authorization: Bearer ' . $ADMIN_TOKEN`);
  if (o.body) headers.push(`'Content-Type: application/json'`);
  if (headers.length > 0) {
    lines.push(`curl_setopt($ch, CURLOPT_HTTPHEADER, [${headers.join(', ')}]);`);
  }
  if (o.body) {
    lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(${phpRepr(o.body)}));`);
  }
  lines.push(`$response = curl_exec($ch);`);
  lines.push(`curl_close($ch);`);
  lines.push(`$data = json_decode($response, true);`);
  return lines.join('\n');
}

function goSample(o: SampleOptions): string {
  const method = o.method ?? 'GET';
  const lines: string[] = [
    `package main`,
    ``,
    `import (`,
    `  "encoding/json"`,
    `  "fmt"`,
    `  "net/http"`,
  ];
  if (o.body) lines.push(`  "bytes"`);
  lines.push(`)`);
  lines.push(``);
  lines.push(`func main() {`);

  if (o.body) {
    lines.push(`  body := bytes.NewBufferString(${JSON.stringify(JSON.stringify(o.body))})`);
    lines.push(`  req, _ := http.NewRequest("${method}", "${API_BASE}${o.path}", body)`);
  } else {
    lines.push(`  req, _ := http.NewRequest("${method}", "${API_BASE}${o.path}", nil)`);
  }
  if (o.bearer) lines.push(`  req.Header.Set("Authorization", "Bearer " + adminToken)`);
  if (o.body) lines.push(`  req.Header.Set("Content-Type", "application/json")`);
  lines.push(`  res, _ := http.DefaultClient.Do(req)`);
  lines.push(`  defer res.Body.Close()`);
  lines.push(`  var data map[string]any`);
  lines.push(`  json.NewDecoder(res.Body).Decode(&data)`);
  lines.push(`  fmt.Println(data)`);
  lines.push(`}`);
  return lines.join('\n');
}

function pythonRepr(value: unknown): string {
  return JSON.stringify(value)
    .replace(/: true/g, ': True')
    .replace(/: false/g, ': False')
    .replace(/: null/g, ': None');
}

function phpRepr(value: unknown): string {
  // Naive but enough for our shallow request bodies: { key: scalar }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `'${k}' => ${typeof v === 'string' ? `'${v}'` : String(v)}`,
    );
    return `['${entries.join(", '")}']`.replace(`['`, `[`).replace(`']`, `]`);
  }
  return JSON.stringify(value);
}
