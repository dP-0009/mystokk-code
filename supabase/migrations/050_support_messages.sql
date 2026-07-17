-- Support / contact-form submissions. Rows are inserted server-side by the
-- send-support-message Edge Function (service role) so nothing is ever lost even
-- if the outbound email fails. RLS is enabled with NO policies: the table is
-- locked to clients; only the service role (which bypasses RLS) reads/writes it.
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  topic text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.support_messages enable row level security;

create index if not exists support_messages_created_at_idx
  on public.support_messages (created_at desc);
