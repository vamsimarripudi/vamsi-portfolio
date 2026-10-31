import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../../.agents/plugins/',import.meta.url);
const readJson=relative=>JSON.parse(fs.readFileSync(new URL(relative,root),'utf8'));

test('Corner plugin package points only at the public read-only MCP server',()=>{
  const plugin=readJson('vamsis-corner-studio/plugin.json');
  const mcp=readJson('vamsis-corner-studio/mcp.json');
  const market=readJson('marketplace.json');
  const skill=fs.readFileSync(new URL('vamsis-corner-studio/skills/get-started/SKILL.md',root),'utf8');

  assert.equal(plugin.name,'vamsis-corner-studio');
  assert.deepEqual(plugin.extensions['com.openai'].interface.capabilities,['Read']);
  assert.equal(plugin.extensions['com.openai'].interface.privacyPolicyURL,'https://vamsimarripudi.me/corner/privacy');
  assert.equal(plugin.extensions['com.openai'].interface.termsOfServiceURL,'https://vamsimarripudi.me/corner/terms');

  assert.equal(mcp.mcpServers.corner.type,'streamable-http');
  assert.equal(mcp.mcpServers.corner.url,'https://vamsimarripudi.me/corner/mcp');
  assert.equal(mcp.mcpServers.corner.extensions['com.openai'].auth.type,'none');

  assert.equal(market.plugins[0].name,'vamsis-corner-studio');
  assert.equal(market.plugins[0].source.path,'./vamsis-corner-studio');

  assert.match(skill,/intentionally read-only/);
  assert.match(skill,/cannot see drafts/);
  assert.match(skill,/Do not imitate success/);
  assert.doesNotMatch(skill,/password|token|secret key/i);
});
