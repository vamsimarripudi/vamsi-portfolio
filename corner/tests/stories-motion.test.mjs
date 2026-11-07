import test from 'node:test';
import assert from 'node:assert/strict';
import {leafAngle,pointerProgress,settleTarget} from '../public/stories-motion.mjs';
const approx=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.0001,`${actual} should be near ${expected}`);
test('page edge angle follows the physical cosine path of the fingertip',()=>{
 approx(leafAngle(0),0);approx(leafAngle(.25),-60);approx(leafAngle(.5),-90);
 approx(leafAngle(.75),-120);approx(leafAngle(1),-180);
 approx(leafAngle(.25,'prev'),60);
 for(const p of [0,.01,.125,.33,.5,.66,.89,1])approx(Math.cos(leafAngle(p)*Math.PI/180),1-2*p);
});
test('desktop and mobile drag distances produce physically plausible sheet progress',()=>{
 approx(pointerProgress(-50,200),.125);
 approx(pointerProgress(-200,200),.5);
 approx(pointerProgress(-400,200),1);
 approx(pointerProgress(40,200,'prev'),.1);
 approx(pointerProgress(40,200,'next'),0);
 approx(pointerProgress(-100,0),0);
});
test('releasing early cancels while deliberate mobile drag commits',()=>{
 assert.equal(settleTarget(.12,.1,{mobile:true}),0);
 assert.equal(settleTarget(.31,.1,{mobile:true}),1);
 assert.equal(settleTarget(.29,-1.5,{mobile:true}),0);
 assert.equal(settleTarget(.12,2,{mobile:true}),1);
 assert.equal(settleTarget(.38,0,{mobile:false}),0);
 assert.equal(settleTarget(.44,0,{mobile:false}),1);
});
