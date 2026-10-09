-- Additive human-reviewed language variants, never rewrite the source article.
CREATE TABLE IF NOT EXISTS v3_language_variants (
 id TEXT PRIMARY KEY,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 language TEXT NOT NULL CHECK(language IN ('te','hi')),
 title TEXT NOT NULL,excerpt TEXT NOT NULL DEFAULT '',body TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published')),
 revision INTEGER NOT NULL DEFAULT 1,
 source_version INTEGER NOT NULL,
 reviewed_at TEXT,reviewed_by TEXT,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 UNIQUE(post_id,language)
);
CREATE INDEX IF NOT EXISTS idx_v3_locales_public ON v3_language_variants(post_id,state,source_version);
