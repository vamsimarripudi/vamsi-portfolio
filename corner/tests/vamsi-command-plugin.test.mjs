import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../../.agents/plugins/',import.meta.url);
const packagePresent=fs.existsSync(new URL('vamsi-command/plugin.json',root));
const readJson=relative=>JSON.parse(fs.readFileSync(new URL(relative,root),'utf8'));
const read=relative=>fs.readFileSync(new URL(relative,root),'utf8');

test('Vamsi Command packages the owner method without claiming unsafe powers',{skip:!packagePresent},()=>{
  const plugin=readJson('vamsi-command/plugin.json');
  const mcp=readJson('vamsi-command/mcp.json');
  const market=readJson('marketplace.json');
  const setup=read('vamsi-command/skills/setup/SKILL.md');
  const owner=read('vamsi-command/skills/owner-command/SKILL.md');
  const release=read('vamsi-command/skills/release-control/SKILL.md');
  const daily=read('vamsi-command/skills/daily-brief/SKILL.md');
  const moments=read('vamsi-command/skills/agentic-moments/SKILL.md');

  assert.equal(plugin.name,'vamsi-command');
  assert.deepEqual(plugin.extensions['com.openai'].interface.capabilities,['Read']);
  assert.equal(mcp.mcpServers.corner.url,'https://vamsimarripudi.me/corner/mcp');
  assert.equal(mcp.mcpServers.corner.extensions['com.openai'].auth.type,'none');
  assert.ok(market.plugins.some(item=>item.name==='vamsi-command'));

  assert.match(setup,/KRAVIA PRIVATE LIMITED is a corporate workspace/);
  assert.match(setup,/Personal ventures and Vamsi's Corner remain personal/);
  assert.match(owner,/VERIFIED/);
  assert.match(owner,/Every external or state-changing action requires explicit owner approval/);
  assert.match(release,/exact tested head/);
  assert.match(release,/Pending is not green/);
  assert.match(daily,/Do not send messages, change events, merge, deploy, charge, publish/);
  assert.match(moments,/Maximum three visible moments at once/);
  assert.match(moments,/must not submit automatically/);
  assert.match(moments,/execution still requires explicit owner approval/);

  const combined=[setup,owner,release,daily,moments].join('\n');
  assert.doesNotMatch(combined,/api[_ -]?key\s*[:=]|password\s*[:=]|secret\s*[:=]/i);
});
