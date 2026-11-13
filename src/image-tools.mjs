export const IMAGE_ZOOM=Object.freeze({in:'image-zoom-in',out:'image-zoom-out',value:'image-zoom-value'});
export const THUMBNAIL_SIZE=Object.freeze({initial:130,minimum:80,maximum:400,step:32});
function boundedSize(size){return Math.max(THUMBNAIL_SIZE.minimum,Math.min(THUMBNAIL_SIZE.maximum,Number.isFinite(size)?size:THUMBNAIL_SIZE.initial));}
export function resizeThumbnails(size,direction){return boundedSize(boundedSize(size)+(direction>0?1:direction<0?-1:0)*THUMBNAIL_SIZE.step);}
export function thumbnailStyle(size){const value=boundedSize(size);return {'--bfv-thumbnail-size':`${value}px`,'--bfv-thumbnail-height':`${Math.round(value*120/130)}px`};}
export function thumbnailWheelPixels(event,viewportHeight=800){
  if(!event.ctrlKey||event.altKey||event.metaKey||event.editing||event.inside===false||event.defaultPrevented||event.cancelable===false||!Number.isFinite(event.deltaY))return 0;
  const page=Number.isFinite(viewportHeight)&&viewportHeight>0?viewportHeight:800;
  const unit=event.deltaMode===1?16:event.deltaMode===2?page:1;
  return Math.max(-40,Math.min(40,event.deltaY*unit));
}
export function resizeThumbnailsByWheel(size,pixels){
  if(!Number.isFinite(pixels))return boundedSize(size);
  const delta=Math.max(-40,Math.min(40,pixels));
  return boundedSize(Math.round(boundedSize(size)*Math.exp(-delta*.005)*100)/100);
}
export function imageZoomKey(event,active){
  if(!active||event.inside===false||event.editing||event.defaultPrevented||!event.ctrlKey||event.altKey||event.metaKey)return 0;
  if(['+','=','Add'].includes(event.key)||event.code==='NumpadAdd')return 1;
  if(['-','_','Subtract'].includes(event.key)||event.code==='NumpadSubtract')return -1;
  return 0;
}
