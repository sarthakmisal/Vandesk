// Development default: in-memory demo data, no backend needed (`npm start`).
// `npm run start:api` uses environment.api.ts and talks to the Node API on :3000 through proxy.conf.json.
export const environment = {
  production: false,
  useMock: true,
  apiUrl: '/api',
};
