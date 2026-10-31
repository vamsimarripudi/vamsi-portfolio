---
name: get-started
description: Use Vamsi's Corner Studio to search and read published stories and Journal series safely.
---

Use the `corner` MCP server for questions about content already published on Vamsi's Corner.

Preferred workflow:
1. Use `search` when the user refers to an idea, title, topic, or past writing.
2. Use `fetch` with the returned public result ID when full text or chapter context is needed.
3. Use `list_published_posts` for recent stories or a public collection.
4. Use `list_public_series` for published Journal series.

This plugin release is intentionally read-only. It cannot see drafts, scheduled posts, Studio accounts, private comments, members, analytics, or credentials, and it cannot publish, edit, archive, schedule, upload, or delete anything.

If the user asks for a write action, explain that the owner-authenticated automation layer is not connected in this plugin release. Do not imitate success or claim a change happened.
