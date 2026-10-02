create or replace function public.create_metric_definition_draft(
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
    metric_key, version, display_names, value_kind, supported_units, value_shape, is_active, created_by, category
  ) values (
    source_definition.metric_key,
    next_version,
    requested_display_names,
    source_definition.value_kind,
    requested_supported_units,
    requested_value_shape,
    false,
    (select auth.uid()),
    source_definition.category
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