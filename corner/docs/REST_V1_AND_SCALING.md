# Vamsi's Corner — REST v1 and scaling architecture

## Working production topology
- Public site: https://vamsimarripudi.me/corner through Vercel HTTPS/reverse proxy.
- Railway: one Node.js 22 API instance with a persistent /data volume.
- SQLite WAL is the single source of truth for posts, owner sessions, comments, analytics, rate limits and SSE replay. Media bytes are also on the /data volume.
- The in-process scheduler publishes with occurrence deduplication; SSE uses durable replay from SQLite.

**Current production is NOT horizontally load-balanced. Increasing Railway replicas against this local SQLite and media storage is unsafe.** Edge routing is not the same as independent API replicas.

## REST interface and contracts
- Versioned API index: GET /corner/api/v1
- OpenAPI 3.1: GET /corner/api/v1/openapi.json
- Liveness: GET /corner/api/v1/live; database and storage readiness: GET /corner/api/v1/ready
- Public GET routes: posts, post detail, status, search, comments and event streaming.
- Owner REST CRUD: GET/POST /api/v1/admin/posts and GET/PATCH/DELETE /api/v1/admin/posts/:id.
- Deleting a post **archives** it reversibly. It does not erase its data.
- Owner comment resources support GET/PATCH/DELETE. Media supports listing, upload, metadata read/update and delete.
- PUT /api/v1/posts/:id/reactions sets a reaction idempotently, DELETE clears it. POST preserves older toggle behavior.
- New v1 create returns HTTP 201 and Location. Original unversioned /api/* endpoints remain in use by the current frontend.
- Responses: success {data,meta}; errors {error:{code,message}}; every response carries an X-Request-ID header.
- Admin security: HttpOnly/Secure/SameSite=Strict owner cookie, origin validation, permissions and request limits.

## Required migration before load balancing
Client -> Vercel TLS/CDN -> L7 balancer -> at least two **stateless** API replicas.
Shared infrastructure required:
1. Separate Corner PostgreSQL schema/database (do not reuse or overwrite the portfolio Enquiry Tracker).
2. S3-compatible private/public media storage; signed access and correct Range delivery.
3. Distributed rate-limit and SSE replay/fanout layer (Redis or managed equivalent).
4. Queue-backed scheduler with unique durable job IDs, leases/leader election, retries, idempotency and dead-letter handling.
5. Replicated sessions, tracing and metrics, bounded connection pools, graceful draining, security tests.

### Safe delivery gates
1. Take checksum-verifiable SQLite-plus-media backup and export it offsite. Rehearse restore into an isolated environment.
2. Port the SQLite Store to a transactional PostgreSQL adapter; migrate *all* relevant rows, owner sessions, occurrences, media metadata, event sequence and audit records. Verify counts, data correctness and rollback.
3. Migrate files to the shared object bucket with checksum and private-media access validation.
4. Introduce distributed job coordination, shared rate limits and multi-instance SSE replay, then pass concurrent write and failover tests.
5. Enable 2+ Railway replicas ONLY after the migration and staging tests pass. Perform an actual load-balanced failover test and measure p50/p95/p99, error rates, connection saturation and queue lag.

### Authorization and costs
Dedicated database, object storage, cache/queue and additional replicas have not been authorized or provisioned for Corner. Provisioning them may incur ongoing charges. Preserve the working single-instance deployment until those resources and a production cutover are approved. A small concurrent-read test proves endpoint behavior, **not** load-balanced production capacity.
