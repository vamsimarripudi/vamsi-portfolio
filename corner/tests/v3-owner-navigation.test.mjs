import test from 'node:test';
import assert from 'node:assert/strict';
import {adminPage} from '../src/ui.mjs';
const flags=['CORNER_V3_MEMORIES','CORNER_V3_WISHES','CORNER_V3_INSIGHTS','CORNER_V3_LANGUAGES'];
test('V3 owner features are discoverable only with flags enabled and owner role',()=>{
 const values=Object.fromEntries(flags.map(x=>[x,process.env[x]]));
 try {
  for(const key of flags)process.env[key]='1';
  const html=adminPage({owner:{id:'owner',email:'owner@example.test',role:'owner'}});
  for(const slug of ['memories','wishes','insights','languages'])
   assert.match(html,new RegExp('href="/admin/v3/'+slug+'"'),slug+' is linked in owner Studio');
  for(const role of ['moderator','editor','admin']){
   const page=adminPage({owner:{id:role,email:role+'@example.test',role}});
   for(const slug of ['memories','wishes','insights','languages'])
    assert.doesNotMatch(page,new RegExp('href="/admin/v3/'+slug+'"'),role+' cannot see owner-only links');
  }
  const publicPage=adminPage({owner:null});
  assert.doesNotMatch(publicPage,/href="\/admin\/v3\/(memories|wishes|insights|languages)"/);
  for(const key of flags)process.env[key]='0';
  const disabled=adminPage({owner:{id:'owner',role:'owner'}});
  assert.doesNotMatch(disabled,/href="\/admin\/v3\/(memories|wishes|insights|languages)"/);
 }finally{
  for(const key of flags){if(values[key]===undefined)delete process.env[key];else process.env[key]=values[key];}
 }
});
