import crypto from 'node:crypto';

export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const sign = (secret, value) => crypto.createHmac('sha256', secret).update(value).digest();
const encode = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const xmlValue = (xml, name) => {
  const match = xml.match(new RegExp('<' + name + '>([\\s\\S]*?)<\\/' + name + '>'));
  return (match?.[1] || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
};

export class S3Bucket {
  constructor({ endpoint, bucket, region = 'auto', urlStyle = 'virtual-host', accessKeyId, secretAccessKey, allowHttp = false, fetchImpl = fetch }) {
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error('Offsite credentials are incomplete');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,100}$/.test(bucket)) throw new Error('Invalid bucket');
    this.base = new URL(endpoint);
    if (this.base.protocol !== 'https:' && !(allowHttp && this.base.protocol === 'http:')) throw new Error('HTTPS required');
    if (this.base.search || this.base.hash || !['/', ''].includes(this.base.pathname)) throw new Error('Unexpected object-storage endpoint path');
    if (!['path', 'virtual-host'].includes(urlStyle)) throw new Error('Unsupported URL style');
    Object.assign(this, { bucket, region, urlStyle, accessKeyId, secretAccessKey, fetchImpl });
  }
  urlFor(key, query = {}) {
    if (typeof key !== 'string' || key.startsWith('/') || key.includes('\\') || key.split('/').includes('..')) throw new Error('Unsafe object key');
    const url = new URL(this.base.href);
    if (this.urlStyle === 'virtual-host') url.hostname = this.bucket + '.' + url.hostname;
    url.pathname = (this.urlStyle === 'path' ? '/' + encode(this.bucket) : '') + '/' + key.split('/').map(encode).join('/');
    const params = Object.entries(query).sort(([a], [b]) => a.localeCompare(b));
    url.search = params.length ? '?' + params.map(([a,b]) => encode(a) + '=' + encode(String(b))).join('&') : '';
    return url;
  }
  async request(method, key = '', { body, query = {} } = {}) {
    const bytes = body === undefined ? Buffer.alloc(0) : Buffer.from(body);
    const url = this.urlFor(key, query);
    const date = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const day = date.slice(0, 8);
    const hash = sha256(bytes);
    const headersToSign = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalHeaders = 'host:' + url.host + '\n' + 'x-amz-content-sha256:' + hash + '\n' + 'x-amz-date:' + date + '\n';
    const canonicalQuery = Object.entries(query).sort(([a],[b]) => a.localeCompare(b)).map(([a,b]) => encode(a) + '=' + encode(String(b))).join('&');
    const canonical = [method, url.pathname, canonicalQuery, canonicalHeaders, headersToSign, hash].join('\n');
    const scope = day + '/' + this.region + '/s3/aws4_request';
    const toSign = 'AWS4-HMAC-SHA256\n' + date + '\n' + scope + '\n' + sha256(Buffer.from(canonical));
    const signingKey = sign(sign(sign(sign('AWS4' + this.secretAccessKey, day), this.region), 's3'), 'aws4_request');
    const signature = sign(signingKey, toSign).toString('hex');
    const headers = {
      'x-amz-date': date,
      'x-amz-content-sha256': hash,
      'authorization': 'AWS4-HMAC-SHA256 Credential=' + this.accessKeyId + '/' + scope + ', SignedHeaders=' + headersToSign + ', Signature=' + signature,
    };
    if (body !== undefined) headers['content-type'] = 'application/octet-stream';
    let response;
    try {
      response = await this.fetchImpl(url, { method, headers, ...(body === undefined ? {} : {body: bytes}), signal: AbortSignal.timeout(120000) });
    } catch { throw new Error('Object store ' + method + ' network request failed'); }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new Error('Object store ' + method + ' returned HTTP ' + response.status);
    }
    return response;
  }
  async put(key, body) { const r = await this.request('PUT', key, {body}); await r.body?.cancel().catch(() => {}); }
  async get(key) { return Buffer.from(await (await this.request('GET', key)).arrayBuffer()); }
  async delete(key) { const r = await this.request('DELETE', key); await r.body?.cancel().catch(() => {}); }
  async list(prefix) {
    const output = [];
    let token;
    do {
      const query = {'list-type': '2', 'prefix': prefix, 'encoding-type': 'url'};
      if (token) query['continuation-token'] = token;
      const xml = await (await this.request('GET', '', {query})).text();
      for (const match of xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)) {
        const key = decodeURIComponent(match[1].replace(/&amp;/g,'&'));
        if (!key.startsWith(prefix)) throw new Error('Object outside prefix');
        output.push(key);
      }
      const more = xmlValue(xml, 'IsTruncated') === 'true';
      token = more ? xmlValue(xml, 'NextContinuationToken') : undefined;
      if (more && !token) throw new Error('Truncated S3 listing');
      if (output.length > 200000) throw new Error('Object count limit');
    } while(token);
    return output;
  }
}
export function bucketFromEnv(env = process.env) {
  const prefix = 'CORNER_BACKUP_S3_';
  return new S3Bucket({
    endpoint: env[prefix + 'ENDPOINT'],
    bucket: env[prefix + 'BUCKET'],
    region: env[prefix + 'REGION'] || 'auto',
    urlStyle: env[prefix + 'URL_STYLE'] || 'virtual-host',
    accessKeyId: env[prefix + 'ACCESS_KEY_ID'],
    secretAccessKey: env[prefix + 'SECRET_ACCESS_KEY'],
  });
}
