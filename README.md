# VanDesk: fees module (Angular 19 + Ionic 8, NgModule)

```bash
npm install
npm start          # http://localhost:4200
npm run build      # output: dist/vandesk/browser  (serve this folder from Node)
```

- **NgModule** project (not standalone). Components use `standalone: false`.
- Fees feature: `src/app/fees/` (lazy `FeesModule`). Data comes from `FeesRepo`; today `MockFeesRepo` (dummy data).
- Go live: write `HttpFeesRepo` (same 4 methods, money in paise) and change `useClass` in `fees.module.ts`.
- Routing is hash-based with a catch-all to `/fees`, so refresh or a wrong URL never gives a blank page.
