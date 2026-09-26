-- RLS / RPC verification for FlatMatch.
-- Run against a database with migrations applied (and, locally, local_shim.sql).
-- Every check raises an exception on failure; success prints "ALL RLS CHECKS PASSED".
-- Everything runs in one transaction that is rolled back, so it is safe to run
-- against a real project too (it leaves no data behind).
\set ON_ERROR_STOP 1
begin;

-- Test users (as a privileged role)
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'riya.test@example.com',   '{"display_name":"Riya"}'),
  ('00000000-0000-0000-0000-00000000000b', 'meera.test@example.com',  '{"display_name":"Meera"}'),
  ('00000000-0000-0000-0000-00000000000c', 'kavita.test@example.com', '{"display_name":"Kavita"}'),
  ('00000000-0000-0000-0000-00000000000d', 'outsider.test@example.com', '{"display_name":"Outsider"}');

create temporary table t (k text primary key, v text) on commit drop;
grant all on t to authenticated, anon;

-- 1. Riya creates a group ------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
insert into t select 'group', public.create_search_group('Pune flat hunt', 'Riya')::text;
do $$ begin
  assert (select count(*) from public.invitations) = 2, 'coordinator should see 2 invitations';
  assert (select count(*) from public.group_members) = 1, 'coordinator should see herself';
end $$;
insert into t select 'tok1', token from public.invitations order by label limit 1;
insert into t select 'tok2', token from public.invitations order by label desc limit 1;

-- 2. Outsider can see nothing of it ---------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
do $$ begin
  assert (select count(*) from public.search_groups) = 0, 'outsider must not see group';
  assert (select count(*) from public.group_members) = 0, 'outsider must not see members';
  assert (select count(*) from public.invitations) = 0, 'outsider must not see invitations';
  assert (select count(*) from public.profiles where display_name = 'Riya') = 0, 'outsider must not see Riya profile';
end $$;
do $$ begin
  perform public.get_group_requirements_for_analysis((select v::uuid from t where k = 'group'));
  raise exception 'outsider should not read requirements';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.group_members (group_id, user_id, role, display_name)
  values ((select v::uuid from t where k = 'group'), '00000000-0000-0000-0000-00000000000d', 'participant', 'Sneaky');
  raise exception 'outsider should not insert membership directly';
exception when insufficient_privilege then null;
end $$;

-- 3. Meera and Kavita accept invitations ---------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
do $$ begin
  assert (select count(*) from public.get_invitation((select v from t where k = 'tok1'))) = 1, 'invite preview should work';
end $$;
select public.accept_invitation((select v from t where k = 'tok1'), 'Meera');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
select public.accept_invitation((select v from t where k = 'tok2'), 'Kavita');
do $$ begin
  assert (select count(*) from public.group_members) = 3, 'member should see full roster';
  assert (select count(*) from public.invitations) = 0, 'participant must not see invitation tokens';
end $$;

-- 4. Group is full; used tokens can't be reused ----------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
do $$ begin
  perform public.accept_invitation((select v from t where k = 'tok1'), 'Outsider');
  raise exception 'used invitation must not be accepted again';
exception when invalid_parameter_value then null;
end $$;

-- 5. Each person saves requirements; others can't read them before analysis ------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
select public.save_requirements((select v::uuid from t where k = 'group'), '{"name":"Meera"}', '[{"key":"lift","priority":"DEALBREAKER","value":{"required":true,"aboveFloor":2}}]', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
select public.save_requirements((select v::uuid from t where k = 'group'), '{"name":"Kavita"}', '[{"key":"pet_friendly","priority":"DEALBREAKER","value":true}]', true);
do $$ begin
  assert (select count(*) from public.participant_requirements) = 1, 'Kavita should only see her own requirements before analysis';
  assert (select count(*) from public.requirement_items) = 1, 'Kavita should only see her own items before analysis';
end $$;
do $$ begin
  assert (select count(*) from public.get_group_progress((select v::uuid from t where k = 'group')) where status = 'submitted') = 2, 'progress shows 2 submitted without revealing contents';
end $$;
do $$ begin
  update public.participant_requirements set profile = '{"name":"hacked"}'
  where user_id = '00000000-0000-0000-0000-00000000000b';
  assert not found, 'Kavita must not update Meera''s requirements';
end $$;

-- 6. Participants cannot run or save analysis ------------------------------------
do $$ begin
  perform public.save_match_run((select v::uuid from t where k = 'group'), '{}', '[]');
  raise exception 'participant should not save results';
exception when insufficient_privilege then null;
end $$;

-- 7. Coordinator can't save before all 3 submit, then can ------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$ begin
  perform public.save_match_run((select v::uuid from t where k = 'group'), '{}', '[]');
  raise exception 'save should fail until all submitted';
exception when invalid_parameter_value then null;
end $$;
select public.save_requirements((select v::uuid from t where k = 'group'), '{"name":"Riya"}', '[{"key":"commute","priority":"STRONG_PREFERENCE","value":20}]', true);
do $$ begin
  assert (select count(*) from public.get_group_requirements_for_analysis((select v::uuid from t where k = 'group'))) = 3, 'coordinator reads 3 profiles for analysis';
end $$;
select public.save_match_run(
  (select v::uuid from t where k = 'group'),
  '{"providerName":"test"}',
  '[{"listing_id":"x","bucket":"shortlist","rank":1,"viable":true,"group_score":90,"individual_scores":{},"result":{},"explanation":{"source":"fallback","model":null,"fallback_reason":"test","content":{}}}]'
);

-- 8. After analysis: members see results + each other's requirements; edits locked
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
do $$ begin
  assert (select count(*) from public.match_results) = 1, 'member sees results';
  assert (select count(*) from public.match_explanations) = 1, 'member sees explanations';
  assert (select count(*) from public.participant_requirements) = 3, 'after analysis members see all requirements';
end $$;
do $$ begin
  perform public.save_requirements((select v::uuid from t where k = 'group'), '{"name":"Kavita"}', '[]', true);
  raise exception 'edits must be locked after analysis';
exception when invalid_parameter_value then null;
end $$;
do $$ begin
  insert into public.match_results (group_id, run_id, listing_id, bucket, viable, group_score, individual_scores, result)
  values ((select v::uuid from t where k = 'group'), gen_random_uuid(), 'fake', 'shortlist', true, 100, '{}', '{}');
  raise exception 'direct result inserts must be blocked';
exception when insufficient_privilege then null;
end $$;

-- 9. Outsider still sees nothing -------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
do $$ begin
  perform public.get_group_progress((select v::uuid from t where k = 'group'));
  raise exception 'outsider should not read progress';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  assert (select count(*) from public.match_results) = 0, 'outsider sees no results';
  assert (select count(*) from public.participant_requirements) = 0, 'outsider sees no requirements';
end $$;

-- 10. Anonymous: listings readable, private tables not ----------------------------
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  perform count(*) from public.search_groups;
  raise exception 'anon must not read groups';
exception when insufficient_privilege then null;
end $$;

reset role;
select 'ALL RLS CHECKS PASSED' as result;
rollback;
