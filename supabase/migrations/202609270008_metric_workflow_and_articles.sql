create function public.submit_metric_content_for_review(target_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_ihssan_permission('metrics.edit')) then
    raise exception 'Metric editing permission required' using errcode = '42501';
  end if;

  update public.metric_content_versions
  set status = 'in_review'
  where id = target_version_id
    and authored_by = (select auth.uid())
    and status = 'draft';

  if not found then
    raise exception 'Only your own draft can be submitted for review' using errcode = '55000';
  end if;
end;
$$;

create function public.review_metric_content_version(target_version_id uuid, approve boolean, notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_ihssan_permission('metrics.review'))
     or not (select public.is_verified_ihssan_clinician((select auth.uid()))) then
    raise exception 'A verified clinician with metric review permission is required' using errcode = '42501';
  end if;

  update public.metric_content_versions
  set status = case when approve then 'approved' else 'draft' end,
      reviewed_by = case when approve then (select auth.uid()) else null end,
      review_notes = nullif(trim(notes), '')
  where id = target_version_id
    and status = 'in_review'
    and authored_by <> (select auth.uid());

  if not found then
    raise exception 'Metric version is not awaiting an eligible review' using errcode = '55000';
  end if;
end;
$$;

create function public.publish_metric_definition(target_definition_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_ihssan_permission('metrics.publish')) then
    raise exception 'Metric publishing permission required' using errcode = '42501';
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
  set is_active = true
  where id = target_definition_id and not is_active;

  if not found then
    raise exception 'Metric definition is already active or was not found' using errcode = '55000';
  end if;
end;
$$;

create table public.blog_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  version smallint not null check (version > 0),
  locale text not null check (locale in ('ar', 'fr', 'en')),
  category text not null check (category in ('nutrition', 'fitness', 'sleep', 'vitamins', 'general_health')),
  title text not null check (char_length(trim(title)) between 4 and 180),
  summary text not null check (char_length(trim(summary)) between 20 and 500),
  body_markdown text not null check (char_length(trim(body_markdown)) between 50 and 50000),
  source_urls text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'approved', 'published', 'retired')),
  effective_from timestamptz,
  effective_to timestamptz,
  authored_by uuid not null references auth.users (id),
  reviewed_by uuid references auth.users (id),
  published_by uuid references auth.users (id),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reviewed_by is null or reviewed_by <> authored_by),
  check (status <> 'published' or (reviewed_by is not null and published_by is not null and effective_from is not null)),
  unique (slug, locale, version)
);

create unique index blog_articles_one_current_published_version
  on public.blog_articles (slug, locale)
  where status = 'published' and effective_to is null;

create index blog_articles_publication_feed
  on public.blog_articles (locale, category, effective_from desc)
  where status = 'published' and effective_to is null;

create trigger blog_articles_set_updated_at
  before update on public.blog_articles
  for each row execute function public.set_updated_at();

create trigger blog_articles_audit
  after insert or update on public.blog_articles
  for each row execute function public.audit_admin_change();

alter table public.blog_articles enable row level security;

create policy "published_articles_readable"
  on public.blog_articles for select to anon, authenticated
  using (status = 'published' and effective_from <= now() and (effective_to is null or now() < effective_to));

create policy "article_staff_read_editorial_queue"
  on public.blog_articles for select to authenticated
  using (
    (select public.has_ihssan_permission('articles.edit'))
    or (select public.has_ihssan_permission('articles.review'))
    or (select public.has_ihssan_permission('articles.publish'))
  );

create policy "article_editors_create_drafts"
  on public.blog_articles for insert to authenticated
  with check (
    (select public.has_ihssan_permission('articles.edit'))
    and authored_by = (select auth.uid())
    and status = 'draft'
    and reviewed_by is null
    and published_by is null
  );

create policy "article_editors_update_own_drafts"
  on public.blog_articles for update to authenticated
  using (
    (select public.has_ihssan_permission('articles.edit'))
    and authored_by = (select auth.uid())
    and status = 'draft'
  )
  with check (
    (select public.has_ihssan_permission('articles.edit'))
    and authored_by = (select auth.uid())
    and status = 'draft'
  );

grant select on public.blog_articles to anon, authenticated;
grant insert, update on public.blog_articles to authenticated;

create function public.review_blog_article_version(target_article_id uuid, approve boolean, notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_ihssan_permission('articles.review'))
     or not (select public.is_verified_ihssan_clinician((select auth.uid()))) then
    raise exception 'A verified clinician with article review permission is required' using errcode = '42501';
  end if;

  update public.blog_articles
  set status = case when approve then 'approved' else 'draft' end,
      reviewed_by = case when approve then (select auth.uid()) else null end,
      review_notes = nullif(trim(notes), '')
  where id = target_article_id
    and status = 'in_review'
    and authored_by <> (select auth.uid());

  if not found then
    raise exception 'Article is not awaiting an eligible review' using errcode = '55000';
  end if;
end;
$$;

create function public.publish_blog_article_version(target_article_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_article public.blog_articles%rowtype;
begin
  if not (select public.has_ihssan_permission('articles.publish')) then
    raise exception 'Article publishing permission required' using errcode = '42501';
  end if;

  select * into target_article
  from public.blog_articles
  where id = target_article_id
  for update;

  if not found or target_article.status <> 'approved' then
    raise exception 'Only an approved article can be published' using errcode = '55000';
  end if;

  if target_article.reviewed_by is null
     or target_article.reviewed_by = target_article.authored_by
     or not (select public.is_verified_ihssan_clinician(target_article.reviewed_by)) then
    raise exception 'A different verified clinician must approve health content' using errcode = '42501';
  end if;

  update public.blog_articles
  set effective_to = now()
  where slug = target_article.slug
    and locale = target_article.locale
    and status = 'published'
    and effective_to is null;

  update public.blog_articles
  set status = 'published',
      effective_from = now(),
      effective_to = null,
      published_by = (select auth.uid())
  where id = target_article_id;
end;
$$;

revoke all on function public.submit_metric_content_for_review(uuid) from public;
revoke all on function public.review_metric_content_version(uuid, boolean, text) from public;
revoke all on function public.publish_metric_content_version(uuid) from public;
revoke all on function public.publish_metric_definition(uuid) from public;
revoke all on function public.review_blog_article_version(uuid, boolean, text) from public;
revoke all on function public.publish_blog_article_version(uuid) from public;

grant execute on function public.submit_metric_content_for_review(uuid) to authenticated;
grant execute on function public.review_metric_content_version(uuid, boolean, text) to authenticated;
grant execute on function public.publish_metric_content_version(uuid) to authenticated;
grant execute on function public.publish_metric_definition(uuid) to authenticated;
grant execute on function public.review_blog_article_version(uuid, boolean, text) to authenticated;
grant execute on function public.publish_blog_article_version(uuid) to authenticated;