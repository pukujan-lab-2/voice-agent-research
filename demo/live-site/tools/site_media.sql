-- Octo tables behind the home page's pictures and films (GET /api/site-media).
-- site_media_files: one row per uploaded file, with the public URL Octo gave it when the file was published.
create table if not exists site_media_files (
  name text primary key,           -- e.g. frank-ask.jpg
  file_id text,                    -- Octo file id (the upload is named maybe-page/<name>)
  url text,                        -- public HTTPS URL from POST /api/files/<id>/publish
  mime text,
  bytes bigint,
  updated_at timestamptz default now());

-- site_media: one row per place on the page. `file`, `mobile_file` and `poster_file` are names in site_media_files.
create table if not exists site_media (
  slot text primary key,           -- hero.woman, film.frank, story.3, turn.man ...
  kind text not null,              -- image | video
  file text not null,
  mobile_file text,                -- a tall version shown on phones, when the wide one would lose the subject
  poster_file text,                -- the frame shown before a film plays
  alt text not null default '',
  pos text,                        -- object-position on wide screens, e.g. '45% 30%'
  mpos text,                       -- object-position on phones
  cuts text,                       -- film only: seconds where the subtitle changes, e.g. '1.8,3.7'
  updated_at timestamptz default now());
