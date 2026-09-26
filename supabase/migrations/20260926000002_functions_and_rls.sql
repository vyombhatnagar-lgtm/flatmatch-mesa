-- FlatMatch: helper functions, RPCs and Row Level Security.
-- Principle: a user can only see data for groups they belong to. Participants'
-- requirements stay private to their author until the group has been analyzed
-- (so each person answers independently).

-- ---------------------------------------------------------------------------
-- Profile bootstrap
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Member'), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer to avoid RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_group_coordinator(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.search_groups g
    where g.id = p_group and g.coordinator_id = (select auth.uid())
  );
$$;

create or replace function public.group_is_analyzed(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select g.status = 'analyzed' from public.search_groups g where g.id = p_group), false);
$$;

create or replace function public.shares_group_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- RPC: create a search group, add the coordinator, create 2 invitations
-- ---------------------------------------------------------------------------
create or replace function public.create_search_group(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if coalesce(char_length(trim(p_name)), 0) not between 1 and 80 then
    raise exception 'Group name must be 1-80 characters' using errcode = '22023';
  end if;
  if coalesce(char_length(trim(p_display_name)), 0) not between 1 and 40 then
    raise exception 'Display name must be 1-40 characters' using errcode = '22023';
  end if;

  insert into public.search_groups (name, coordinator_id)
  values (trim(p_name), v_uid)
  returning id into v_group;

  insert into public.group_members (group_id, user_id, role, display_name)
  values (v_group, v_uid, 'coordinator', trim(p_display_name));

  insert into public.invitations (group_id, invited_by, label)
  values (v_group, v_uid, 'Invite 1'), (v_group, v_uid, 'Invite 2');

  return v_group;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: preview an invitation by token (safe subset only)
-- ---------------------------------------------------------------------------
create or replace function public.get_invitation(p_token text)
returns table (
  group_id uuid,
  group_name text,
  coordinator_name text,
  status public.invitation_status,
  expired boolean,
  member_count integer,
  already_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.group_id,
    g.name,
    (select m.display_name from public.group_members m where m.group_id = g.id and m.role = 'coordinator' limit 1),
    i.status,
    i.expires_at < now(),
    (select count(*)::int from public.group_members m where m.group_id = g.id),
    exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = (select auth.uid()))
  from public.invitations i
  join public.search_groups g on g.id = i.group_id
  where i.token = p_token;
$$;

-- ---------------------------------------------------------------------------
-- RPC: accept an invitation
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations%rowtype;
  v_count int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if coalesce(char_length(trim(p_display_name)), 0) not between 1 and 40 then
    raise exception 'Display name must be 1-40 characters' using errcode = '22023';
  end if;

  select * into v_inv from public.invitations where token = p_token for update;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.group_members where group_id = v_inv.group_id and user_id = v_uid) then
    return v_inv.group_id;
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'This invitation has already been used' using errcode = '22023';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'This invitation has expired' using errcode = '22023';
  end if;

  select count(*) into v_count from public.group_members where group_id = v_inv.group_id;
  if v_count >= 3 then
    raise exception 'This group already has 3 members' using errcode = '22023';
  end if;

  insert into public.group_members (group_id, user_id, role, display_name)
  values (v_inv.group_id, v_uid, 'participant', trim(p_display_name));

  update public.invitations
  set status = 'accepted', accepted_by = v_uid, accepted_at = now()
  where id = v_inv.id;

  return v_inv.group_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: save the caller's own requirements atomically (security invoker, RLS applies)
-- ---------------------------------------------------------------------------
create or replace function public.save_requirements(
  p_group uuid,
  p_profile jsonb,
  p_items jsonb,
  p_submit boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pr uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not public.is_group_member(p_group) then
    raise exception 'Not a member of this group' using errcode = '42501';
  end if;
  if public.group_is_analyzed(p_group) then
    raise exception 'This group has already been analyzed. Ask the coordinator to reopen it.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Invalid items' using errcode = '22023';
  end if;

  insert into public.participant_requirements (group_id, user_id, profile, status, submitted_at, updated_at)
  values (
    p_group, v_uid, p_profile,
    case when p_submit then 'submitted'::public.requirements_status else 'draft'::public.requirements_status end,
    case when p_submit then now() else null end,
    now()
  )
  on conflict (group_id, user_id) do update
    set profile = excluded.profile,
        status = excluded.status,
        submitted_at = excluded.submitted_at,
        updated_at = now()
  returning id into v_pr;

  delete from public.requirement_items where participant_requirement_id = v_pr;

  insert into public.requirement_items (participant_requirement_id, key, priority, value)
  select v_pr, item ->> 'key', (item ->> 'priority')::public.requirement_priority, item -> 'value'
  from jsonb_array_elements(p_items) as item;

  return v_pr;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: completion status per member (no requirement contents)
-- ---------------------------------------------------------------------------
create or replace function public.get_group_progress(p_group uuid)
returns table (
  user_id uuid,
  display_name text,
  role public.member_role,
  status public.requirements_status,
  submitted_at timestamptz,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_group_member(p_group) then
    raise exception 'Not a member of this group' using errcode = '42501';
  end if;
  return query
    select m.user_id, m.display_name, m.role, r.status, r.submitted_at, m.joined_at
    from public.group_members m
    left join public.participant_requirements r on r.group_id = m.group_id and r.user_id = m.user_id
    where m.group_id = p_group
    order by m.joined_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: coordinator reads every member's requirements for analysis.
-- Requires all 3 members to have submitted.
-- ---------------------------------------------------------------------------
create or replace function public.get_group_requirements_for_analysis(p_group uuid)
returns table (user_id uuid, display_name text, profile jsonb, status public.requirements_status)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_group_coordinator(p_group) then
    raise exception 'Only the coordinator can run the analysis' using errcode = '42501';
  end if;
  return query
    select m.user_id, m.display_name, r.profile, r.status
    from public.group_members m
    left join public.participant_requirements r on r.group_id = m.group_id and r.user_id = m.user_id
    where m.group_id = p_group
    order by m.joined_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: store a completed match run and mark the group analyzed (atomic)
-- p_results: [{listing_id, bucket, rank, viable, group_score, individual_scores,
--              result, explanation: {source, model, fallback_reason, content} | null}]
-- ---------------------------------------------------------------------------
create or replace function public.save_match_run(p_group uuid, p_meta jsonb, p_results jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run uuid := gen_random_uuid();
  v_row jsonb;
  v_result_id uuid;
  v_members int;
  v_submitted int;
begin
  if not public.is_group_coordinator(p_group) then
    raise exception 'Only the coordinator can save results' using errcode = '42501';
  end if;
  select count(*) into v_members from public.group_members where group_id = p_group;
  select count(*) into v_submitted from public.participant_requirements where group_id = p_group and status = 'submitted';
  if v_members <> 3 or v_submitted <> 3 then
    raise exception 'All 3 members must submit requirements first' using errcode = '22023';
  end if;
  if jsonb_typeof(p_results) <> 'array' then
    raise exception 'Invalid results' using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_results) loop
    insert into public.match_results (group_id, run_id, listing_id, bucket, rank, viable, group_score, individual_scores, result)
    values (
      p_group, v_run,
      v_row ->> 'listing_id',
      v_row ->> 'bucket',
      nullif(v_row ->> 'rank', '')::smallint,
      (v_row ->> 'viable')::boolean,
      (v_row ->> 'group_score')::smallint,
      v_row -> 'individual_scores',
      v_row -> 'result'
    )
    returning id into v_result_id;

    if v_row ? 'explanation' and jsonb_typeof(v_row -> 'explanation') = 'object' then
      insert into public.match_explanations (match_result_id, source, model, fallback_reason, content)
      values (
        v_result_id,
        v_row -> 'explanation' ->> 'source',
        v_row -> 'explanation' ->> 'model',
        v_row -> 'explanation' ->> 'fallback_reason',
        v_row -> 'explanation' -> 'content'
      );
    end if;
  end loop;

  update public.search_groups
  set status = 'analyzed', latest_run_id = v_run, latest_run_meta = p_meta, analyzed_at = now()
  where id = p_group;

  return v_run;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: coordinator reopens a group so members can edit requirements again
-- ---------------------------------------------------------------------------
create or replace function public.reopen_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_coordinator(p_group) then
    raise exception 'Only the coordinator can reopen the group' using errcode = '42501';
  end if;
  update public.search_groups set status = 'collecting' where id = p_group;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: nothing callable by anon except the invite preview
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_group_member(uuid) from public, anon;
revoke execute on function public.is_group_coordinator(uuid) from public, anon;
revoke execute on function public.group_is_analyzed(uuid) from public, anon;
revoke execute on function public.shares_group_with(uuid) from public, anon;
revoke execute on function public.create_search_group(text, text) from public, anon;
revoke execute on function public.accept_invitation(text, text) from public, anon;
revoke execute on function public.save_requirements(uuid, jsonb, jsonb, boolean) from public, anon;
revoke execute on function public.get_group_requirements_for_analysis(uuid) from public, anon;
revoke execute on function public.save_match_run(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.reopen_group(uuid) from public, anon;
revoke execute on function public.get_group_progress(uuid) from public, anon;
revoke execute on function public.get_invitation(text) from public;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_coordinator(uuid) to authenticated;
grant execute on function public.group_is_analyzed(uuid) to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;
grant execute on function public.create_search_group(text, text) to authenticated;
grant execute on function public.accept_invitation(text, text) to authenticated;
grant execute on function public.save_requirements(uuid, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.get_group_requirements_for_analysis(uuid) to authenticated;
grant execute on function public.save_match_run(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.reopen_group(uuid) to authenticated;
grant execute on function public.get_group_progress(uuid) to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.search_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.invitations enable row level security;
alter table public.participant_requirements enable row level security;
alter table public.requirement_items enable row level security;
alter table public.property_listings enable row level security;
alter table public.match_results enable row level security;
alter table public.match_explanations enable row level security;

-- Anonymous users get nothing from the private tables.
revoke all on public.profiles, public.search_groups, public.group_members, public.invitations,
  public.participant_requirements, public.requirement_items, public.match_results,
  public.match_explanations from anon;

-- profiles
create policy "profiles: read self and group-mates" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- search_groups (inserts only via create_search_group RPC)
create policy "groups: members read" on public.search_groups
  for select to authenticated
  using (public.is_group_member(id));
create policy "groups: coordinator updates name" on public.search_groups
  for update to authenticated
  using (coordinator_id = (select auth.uid()))
  with check (coordinator_id = (select auth.uid()));

-- Only the group name may be changed directly; everything else goes through RPCs.
revoke update on public.search_groups from authenticated;
grant update (name) on public.search_groups to authenticated;

-- group_members (writes only via RPCs)
create policy "members: members read roster" on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

-- invitations: only the coordinator sees/creates/revokes links
create policy "invitations: coordinator reads" on public.invitations
  for select to authenticated
  using (public.is_group_coordinator(group_id));
create policy "invitations: coordinator creates" on public.invitations
  for insert to authenticated
  with check (public.is_group_coordinator(group_id) and invited_by = (select auth.uid()) and status = 'pending');
create policy "invitations: coordinator revokes" on public.invitations
  for update to authenticated
  using (public.is_group_coordinator(group_id))
  with check (public.is_group_coordinator(group_id));
revoke update on public.invitations from authenticated;
grant update (status) on public.invitations to authenticated;

-- participant_requirements: own rows always; others only after analysis
create policy "requirements: read own, or group's after analysis" on public.participant_requirements
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (public.is_group_member(group_id) and public.group_is_analyzed(group_id))
  );
create policy "requirements: insert own before analysis" on public.participant_requirements
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_group_member(group_id)
    and not public.group_is_analyzed(group_id)
  );
create policy "requirements: update own before analysis" on public.participant_requirements
  for update to authenticated
  using (user_id = (select auth.uid()) and not public.group_is_analyzed(group_id))
  with check (user_id = (select auth.uid()) and not public.group_is_analyzed(group_id));

-- requirement_items follow their parent row
create policy "items: read with parent" on public.requirement_items
  for select to authenticated
  using (exists (
    select 1 from public.participant_requirements r
    where r.id = participant_requirement_id
  ));
create policy "items: write own before analysis" on public.requirement_items
  for all to authenticated
  using (exists (
    select 1 from public.participant_requirements r
    where r.id = participant_requirement_id
      and r.user_id = (select auth.uid())
      and not public.group_is_analyzed(r.group_id)
  ))
  with check (exists (
    select 1 from public.participant_requirements r
    where r.id = participant_requirement_id
      and r.user_id = (select auth.uid())
      and not public.group_is_analyzed(r.group_id)
  ));

-- property_listings: public read-only catalog
create policy "listings: anyone reads active" on public.property_listings
  for select to anon, authenticated
  using (is_active);
revoke insert, update, delete on public.property_listings from anon, authenticated;

-- match results: group members read; writes only via save_match_run
create policy "results: members read" on public.match_results
  for select to authenticated
  using (public.is_group_member(group_id));
create policy "explanations: members read" on public.match_explanations
  for select to authenticated
  using (exists (
    select 1 from public.match_results mr
    where mr.id = match_result_id and public.is_group_member(mr.group_id)
  ));

revoke insert, update, delete on public.match_results, public.match_explanations from authenticated;
revoke insert, update, delete on public.group_members from authenticated;
revoke insert, delete on public.search_groups from authenticated;
