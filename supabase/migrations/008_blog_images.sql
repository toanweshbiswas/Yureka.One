-- Public blog images. Safe to re-run.
-- Uploads go through the admin API with SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
-- Landing pages read objects via the public URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  8388608,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read blog images" on storage.objects;
create policy "Public read blog images"
  on storage.objects
  for select
  using (bucket_id = 'blog-images');
