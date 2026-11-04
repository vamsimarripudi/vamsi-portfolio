/** Focused retry browser acceptance. Keeps fail-once provider state isolated from the full Command journey. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {expect} from 'playwright/test';
import {startComposerFixture} from './composer-fixture.mjs';
const f=await startComposerFixture({chat:true,mockChat:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
const [cookieName,cookieValue]=f.cookie.split('=');await context.addCookies([{name:cookieName,value:cookieValue,url:f.origin}]);
const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await f.send('/api/admin/command/consent?workspace=personal',{method:'POST',json:{accepted:true}});
 await page.goto(f.base+'/admin#command');
 await page.locator('#cc-input').fill('FIXTURE_FAIL_ONCE');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByRole('button',{name:'Retry response'})).toBeVisible({timeout:8000});
 await page.getByRole('button',{name:'Retry response'}).click();
 await expect.poll(()=>page.getByRole('button',{name:'Retry response'}).count(),{timeout:8000}).toBe(0);
 await expect(page.locator('.cc-assistant').last()).toContainText('A clear next step.');
 await expect(page.locator('.cc-announcement')).toHaveText('Conversation saved');
 assert.deepEqual(errors,[]);console.log('PASS isolated provider failure retries the same turn and clears the retry UI');
}finally{await context.close();await browser.close();await f.close()}
