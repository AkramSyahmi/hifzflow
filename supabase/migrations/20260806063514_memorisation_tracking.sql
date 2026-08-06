-- Track which pages a user has memorised
create table public.memorised_pages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  page_number int  not null check (page_number between 1 and 604),
  memorised_at timestamptz not null default now(),
  unique (user_id, page_number)
);

alter table public.memorised_pages enable row level security;

create policy "Users manage own memorised pages"
  on public.memorised_pages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Atomic gap-filling: toggle a page and return the new full set
create or replace function public.toggle_memorised_page(p_page_number int)
returns setof public.memorised_pages
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert or delete atomically
  if exists (
    select 1 from public.memorised_pages
    where user_id = auth.uid() and page_number = p_page_number
  ) then
    delete from public.memorised_pages
    where user_id = auth.uid() and page_number = p_page_number;
  else
    insert into public.memorised_pages (user_id, page_number)
    values (auth.uid(), p_page_number);
  end if;

  -- Return full updated set
  return query
    select * from public.memorised_pages
    where user_id = auth.uid()
    order by page_number;
end;
$$;

-- Lock down direct execution
revoke execute on function public.toggle_memorised_page(int) from public;
grant execute on function public.toggle_memorised_page(int) to authenticated;