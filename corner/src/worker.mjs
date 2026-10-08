import { Store } from './store.mjs';
const store=new Store();
console.log('Vamsi’s Corner scheduler started — persistent occurrences, bounded polling.');
const tick=()=>{try{const result=store.tick();store.cleanup();if(result.length)console.log(JSON.stringify({time:new Date().toISOString(),published:result.length}))}catch(err){console.error(JSON.stringify({time:new Date().toISOString(),error:err.message}))}};
tick();const interval=setInterval(tick,10000);process.on('SIGTERM',()=>{clearInterval(interval);store.close();process.exit(0)});
