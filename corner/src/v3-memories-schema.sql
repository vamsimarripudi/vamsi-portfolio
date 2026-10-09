-- Phase 2: additive personal memories, never changes the post or media tables.
CREATE TABLE IF NOT EXISTS v3_milestones (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
 occurred_on TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'personal',
 post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
 state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','archived')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_v3_milestones_public ON v3_milestones(state,occurred_on DESC,id DESC);
CREATE TABLE IF NOT EXISTS v3_albums (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
 summary TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'draft'
 CHECK(state IN ('draft','published','archived')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_v3_albums_public ON v3_albums(state,published_at DESC);
CREATE TABLE IF NOT EXISTS v3_album_items (
 album_id TEXT NOT NULL REFERENCES v3_albums(id) ON DELETE CASCADE,
 media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
 sort_order INTEGER NOT NULL CHECK(sort_order BETWEEN 0 AND 99),
 PRIMARY KEY(album_id,media_id)
);
CREATE INDEX IF NOT EXISTS idx_v3_album_order ON v3_album_items(album_id,sort_order);
CREATE TABLE IF NOT EXISTS v3_collections (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
 summary TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT 'draft'
 CHECK(state IN ('draft','published','archived')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_v3_collections_public ON v3_collections(state,published_at DESC);
CREATE TABLE IF NOT EXISTS v3_collection_items (
 collection_id TEXT NOT NULL REFERENCES v3_collections(id) ON DELETE CASCADE,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 sort_order INTEGER NOT NULL CHECK(sort_order BETWEEN 0 AND 99),
 PRIMARY KEY(collection_id,post_id)
);
CREATE INDEX IF NOT EXISTS idx_v3_collection_order ON v3_collection_items(collection_id,sort_order);
CREATE TABLE IF NOT EXISTS v3_now_history (
 id TEXT PRIMARY KEY, version INTEGER NOT NULL UNIQUE, label TEXT NOT NULL,
 detail TEXT NOT NULL, icon TEXT NOT NULL,
 is_active INTEGER NOT NULL CHECK(is_active IN (0,1)),
 active_from TEXT, active_until TEXT, changed_at TEXT NOT NULL,
 actor_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_v3_now_history_time ON v3_now_history(is_active,changed_at DESC);
