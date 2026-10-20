-- 011_storage.sql
-- Private buckets for personal content. Object path convention: '<user_id>/<file>'.
-- Nothing is public; the app serves images through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',         'avatars',         false, 2097152, array['image/jpeg','image/png','image/webp']),
  ('progress-photos', 'progress-photos', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic']),
  ('food-scans',      'food-scans',      false, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "personal_buckets_select_own" on storage.objects for select to authenticated
  using (bucket_id in ('avatars','progress-photos','food-scans')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "personal_buckets_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars','progress-photos','food-scans')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "personal_buckets_update_own" on storage.objects for update to authenticated
  using (bucket_id in ('avatars','progress-photos','food-scans')
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('avatars','progress-photos','food-scans')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "personal_buckets_delete_own" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars','progress-photos','food-scans')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
