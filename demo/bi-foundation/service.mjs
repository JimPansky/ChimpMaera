import http from "node:http";

const reply = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(`${JSON.stringify(body)}\n`);
};

export function createBiServer({ role, dependencyUrl, fetchDependency = fetch }) {
  return http.createServer(async (request, response) => {
    if (request.method !== 'GET') return reply(response, 405, { status: 'DENY', code: 'METHOD_DENIED' });
    if (request.url === '/healthz') return reply(response, 200, { status: 'UP', role });
    if (request.url !== '/readyz' || role !== 'service') return reply(response, 404, { status: 'DENY', code: 'ROUTE_DENIED' });
    try {
      const dependency = await fetchDependency(dependencyUrl, { signal: AbortSignal.timeout(500) });
      if (!dependency.ok) throw new Error('dependency unavailable');
      return reply(response, 200, { status: 'READY', dependency: 'READY' });
    } catch {
      return reply(response, 503, { status: 'NOT_READY', dependency: 'UNAVAILABLE' });
    }
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const role = process.env.CM_BI_ROLE;
  const port = Number(process.env.CM_BI_PORT);
  const dependencyUrl = process.env.CM_BI_DEPENDENCY_URL;
  if (!['service', 'dependency'].includes(role) || !Number.isInteger(port) || port < 1 || port > 65535) {
    process.stderr.write('BI_CONFIG_DENIED\n'); process.exit(64);
  }
  if (role === 'service' && dependencyUrl !== 'http://bi-dependency:8090/healthz') {
    process.stderr.write('BI_DEPENDENCY_CONFIG_DENIED\n'); process.exit(64);
  }
  createBiServer({ role, dependencyUrl }).listen(port, '0.0.0.0');
}
