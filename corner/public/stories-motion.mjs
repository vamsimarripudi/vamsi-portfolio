/** Pure geometry / interaction policy for the finger-tracked book page. */
export const clamp01=(n)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
/**
 * A paper leaf rotating about its spine projects an edge x = cos(theta).
 * Inverting that projection gives a turn angle that genuinely follows the
 * finger horizontally, unlike a simple linear rotation of 180 * swipeDistance.
 */
export function leafAngle(progress,direction='next'){
 const angle=Math.acos(1-2*clamp01(progress))*180/Math.PI;
 return direction==='prev'?angle:-angle;
}
/**
 * The leaf is twice as wide as the distance from outer edge to spine across a
 * full turn, so a mobile reader typically releases at the spine and the sheet
 * finishes the second half on its own.
 */
export function pointerProgress(delta,leafWidth,direction='next'){
 if(!(leafWidth>0))return 0;
 return clamp01((direction==='next'?-delta:delta)/(2*leafWidth));
}
/** Speed-sensitive settle. A mobile drag across 40% of the page can complete. */
export function settleTarget(progress,velocity,{mobile=false}={}){
 const p=clamp01(progress),v=Number.isFinite(velocity)?velocity:0;
 const projected=p+Math.max(-.14,Math.min(.14,v*.075));
 const required=mobile?.23:.40;
 return projected>=required||(v>1.15&&p>.085)?1:0;
}
