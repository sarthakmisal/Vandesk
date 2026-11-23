// Default (npm start / ng serve): the real VanDesk API. proxy.conf.json forwards /api to http://localhost:3000 (the ../back server).
export const environment = {
  production: false,
  useMock: false,
  apiUrl: '/api',
};
