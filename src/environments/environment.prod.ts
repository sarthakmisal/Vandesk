// npm run build / build:back: the web app is served by the backend itself, so /api is the same origin.
export const environment = {
  production: true,
  useMock: false,
  apiUrl: '/api',
};
