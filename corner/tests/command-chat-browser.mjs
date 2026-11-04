/** Real HTTP, SQLite and browser integration; the provider alone is a test fixture. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {expect} from 'playwright/test';
import {startComposerFixture} from './composer-fixture.mjs';
const f=await startComposerFixture({chat:true,mockChat:true,seed:true});
const output=path.resolve('screenshots/command-chat');await fs.mkdir(output,{recursive:true});
const evidence={externalSpend:false,isolated:true,checks:[],screenshots:[]},errors=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});
const [cookieName,cookieValue]=f.cookie.split('=');await context.addCookies([{name:cookieName,value:cookieValue,url:f.origin}]);
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const record=label=>{evidence.checks.push(label);console.log('PASS '+label)};
const shot=async name=>{await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});evidence.screenshots.push(name+'.png')};
const fit=async label=>{await expect.poll(()=>page.evaluate(()=>document.querySelector('.cc-composer').getBoundingClientRect().bottom<=innerHeight+1),{timeout:3000}).toBe(true);const v=await page.evaluate(()=>{const r=document.querySelector('.cc-composer').getBoundingClientRect();return {viewport:innerWidth,¶»§q«^