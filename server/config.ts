export interface Config {
  port: number;
  production: boolean;
  secret: string;
  cronSecret: string;
  databaseUrl?: string;
  dataDir: string;
  memoryDb: boolean;
  staticDir: string;
  seed: boolean;
  devOtp: boolean;
  mailFrom: string;
  smtp?: { host: string; port: number; user?: string; pass?: string };
  /** Injectable clock (tests). */
  now: () => Date;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, over: Partial<Config> = {}): Config {
  const production = env['NODE_ENV'] === 'production';
  const secret = env['AUTH_SECRET'] ?? '';
  if (production && secret.length < 16) {
    throw new Error('AUTH_SECRET (16+ chars) is required in production');
  }
  const smtpHost = env['SMTP_HOST'];
  return {
    port: Number(env['PORT'] ?? 3000),
    production,
    secret: secret || 'dev-secret-change-me',
    cronSecret: env['CRON_SECRET'] ?? '',
    databaseUrl: env['DATABASE_URL'],
    dataDir: env['DATA_DIR'] ?? './data/pg',
    memoryDb: false,
    staticDir: env['STATIC_DIR'] ?? 'www',
    seed: env['SEED_DEMO'] === '1' || (!production && env['SEED_DEMO'] !== '0'),
    // Without SMTP (dev) the OTP is also returned in the response so the demo works without an inbox. Never in production.
    devOtp: !production && !smtpHost,
    mailFrom: env['MAIL_FROM'] ?? 'VanDesk <no-reply@vandesk.test>',
    smtp: smtpHost
      ? { host: smtpHost, port: Number(env['SMTP_PORT'] ?? 587), user: env['SMTP_USER'], pass: env['SMTP_PASS'] }
      : undefined,
    now: () => new Date(),
    ...over,
  };
}
