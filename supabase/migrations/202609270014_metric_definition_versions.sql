create function public.create_metric_definition_draft(
  target_definition_id uuid,
  requested_display_names jsonb,
  requested_supported_units text[],
  requested_value_shape jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_definition public.metric_definitions%rowtype;
  next_version smallint;
  draft_definition_id uuid;
begin
  if not (select public.has_ihssan_permission('metrics.edit')) then
    raise exception 'Metric editing permission required' using errcode = '42501';
  end if;

  select * into source_definition
  from public.metric_definitions
  where id = target_definition_id;

  if not found then
    raise exception 'Metric definition not found' using errcode = 'P0002';
  end if;

  if jsonb_typeof(requested_display_names) <> 'object'
     or jsonb_typeof(requested_value_shape) <> 'object'
     or requested_supported_units is null
     or cardinality(requested_supported_units) = 0 then
    raise exception 'Metric labels, units, and value shape are required' using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.metric_definitions
  where metric_key = source_definition.metric_key;

  insert into public.metric_definitions (
    metric_key, version, display_names, value_kind, supported_units, value_shape, is_active, created_by
  ) values (
    source_definition.metric_key,
    next_version,
    requested_display_names,
    source_definition.value_kind,
    requested_supported_units,
    requested_value_shape,
    false,
    (select auth.uid())
  ) returning id into draft_definition_id;

  with content_to_copy as (
    select distinct on (locale)
      locale, content, reference_ranges, evidence_sources
    from public.metric_content_versions
    where metric_definition_id = source_definition.id
      and status <> 'retired'
    order by locale, (status = 'published' and effective_to is null) desc, created_at desc
  )
  insert into public.metric_content_versions (
    metric_definition_id, locale, content, reference_ranges, evidence_sources, status, authored_by
  )
  select draft_definition_id, locale, content, reference_ranges, evidence_sources, 'draft', (select auth.uid())
  from content_to_copy;

  return draft_definition_id;
end;
$$;

create or replace function public.publish_metric_definition(target_definition_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_definition public.metric_definitions%rowtype;
begin
  if not (select public.has_ihssan_permission('metrics.publish')) then
    raise exception 'Metric publishing permission required' using errcode = '42501';
  end if;

  select * into target_definition
  from public.metric_definitions
  where id = target_definition_id
  for update;

  if not found or target_definition.is_active then
    raise exception 'An inactive metric definition draft is required' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.metric_content_versions as content
    where content.metric_definition_id = target_definition_id
      and content.locale = 'en'
      and content.status = 'published'
      and content.effective_from <= now()
      and (content.effective_to is null or now() < content.effective_to)
  ) then
    raise exception 'Publish reviewed English metric content before activating this definition' using errcode = '55000';
  end if;

  update public.metric_definitions
  set is_active = false
  where metric_key = target_definition.metric_key
    and is_active
    and id <> target_definition_id;

  update public.metric_definitions
  set is_active = true
  where id = target_definition_id;
end;
$$;

revoke all on function public.create_metric_definition_draft(uuid, jsonb, text[], jsonb) from public;
grant execute on function public.create_metric_definition_draft(uuid, jsonb, text[], jsonb) to authenticated;