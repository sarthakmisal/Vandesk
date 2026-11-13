-- VanDesk schema (PostgreSQL). Money is integer paise. Idempotent: safe to run on every start.
create table if not exists vehicle (id text primary key, label text not null, short text not null, cap int not null check (cap > 0));
create table if not exists app_user (
  id text primary key, email text not null unique, name text not null,
  role text not null check (role in ('admin','driver','parent')),
  vehicle_id text references vehicle(id), phone text, active boolean not null default true);
create table if not exists stop (
  id text primary key, vehicle_id text not null references vehicle(id), name text not null, seq int not null, typical text,
  unique (vehicle_id, seq));
create table if not exists student (
  id text primary key, name text not null, cls text not null default '',
  vehicle_id text not null references vehicle(id), stop_id text references stop(id),
  guardian_id text not null references app_user(id),
  status text not null default 'active' check (status in ('active','paused','left')),
  joined text not null, created_at timestamptz not null default now());
create table if not exists fee_plan (
  id text primary key, vehicle_id text not null references vehicle(id),
  amount int not null check (amount >= 0), effective_from date not null, unique (vehicle_id, effective_from));
create table if not exists fee_due (
  id text primary key, student_id text not null references student(id), period text not null,
  amount int not null, unique (student_id, period));
create table if not exists payment (
  id text primary key, student_id text not null references student(id),
  kind text not null check (kind in ('payment','reversal')), amount int not null check (amount > 0),
  mode text not null, paid_on date not null, by_user text, rev_of text references payment(id), note text,
  client_uuid text unique, created_at timestamptz not null default now());
create table if not exists payment_allocation (
  id serial primary key, payment_id text not null references payment(id), due_id text not null references fee_due(id), amount int not null);
create table if not exists trip (
  id text primary key, vehicle_id text not null references vehicle(id), trip_date date not null,
  direction text not null check (direction in ('pickup','drop')), status text not null,
  started_at timestamptz, ended_at timestamptz, unique (vehicle_id, trip_date, direction));
create table if not exists trip_event (
  id text primary key, trip_id text not null references trip(id), student_id text not null references student(id),
  kind text not null check (kind in ('boarded','skipped')), at timestamptz not null default now(),
  lat double precision, lng double precision, accuracy real, flag text, unique (trip_id, student_id));
create table if not exists attendance_intent (
  student_id text not null references student(id), trip_date date not null, direction text not null,
  going boolean not null, is_late boolean not null default false, set_at timestamptz not null default now(),
  primary key (student_id, trip_date, direction));
create table if not exists notification_log (
  id serial primary key, user_id text, student_id text, channel text not null default 'email', template text not null,
  dedupe_key text not null unique, subject text, body text, status text not null default 'queued',
  attempts int not null default 0, error text, queued_at timestamptz not null default now(), sent_at timestamptz);
create table if not exists otp_challenge (
  id serial primary key, email text not null, code_hash text not null, expires_at timestamptz not null,
  attempts int not null default 0, consumed boolean not null default false, created_at timestamptz not null default now());
create table if not exists audit_log (
  id serial primary key, actor text, action text not null, entity text, entity_id text, detail text, at timestamptz not null default now());
create index if not exists idx_student_vehicle on student(vehicle_id);
create index if not exists idx_student_guardian on student(guardian_id);
create index if not exists idx_due_student on fee_due(student_id);
create index if not exists idx_alloc_due on payment_allocation(due_id);
create index if not exists idx_payment_student on payment(student_id);
