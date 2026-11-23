// npm run cap:sync (Android / iOS app). Inside the app there is no same-origin server, so the backend URL must be absolute.
//   Android emulator -> your computer:  http://10.0.2.2:3000/api   (also run: set CAP_CLEARTEXT=1 before `npm run cap:sync`)
//   Real phone on Wi-Fi:                http://<your-PC-LAN-IP>:3000/api  (same CAP_CLEARTEXT=1 note)
//   Production (https, recommended):    https://your-backend.example.com/api
export const environment = {
  production: true,
  useMock: false,
  apiUrl: 'http://10.0.2.2:3000/api',
};
