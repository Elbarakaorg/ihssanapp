(function(){
var CFG=window.__MAP_CONFIG||JSON.parse(decodeURIComponent(location.hash.slice(1)));
var T=CFG.theme;
var st=document.createElement('style');st.textContent='html,body,#map{margin:0;height:100%;width:100%;background:'+T.paper+'}'
+'.mapboxgl-ctrl-logo{opacity:.6}'
+'.mapboxgl-popup{max-width:300px!important;z-index:5}'
+'.mapboxgl-popup-content{background:'+T.white+';color:'+T.ink+';padding:14px 14px 12px;border:1px solid '+T.line+';border-radius:16px 12px 15px 11px;box-shadow:0 6px 24px rgba(40,30,15,.28);font:13px/1.45 -apple-system,system-ui,\'Segoe UI\',sans-serif}'
+'.mapboxgl-popup-close-button{font-size:20px;color:'+T.muted+';padding:2px 9px}'
+'.mapboxgl-popup-anchor-top .mapboxgl-popup-tip{border-bottom-color:'+T.white+'}'
+'.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip{border-top-color:'+T.white+'}'
+'.mapboxgl-popup-anchor-left .mapboxgl-popup-tip{border-right-color:'+T.white+'}'
+'.mapboxgl-popup-anchor-right .mapboxgl-popup-tip{border-left-color:'+T.white+'}'
+'.pp-kind{display:flex;align-items:center;gap:6px;color:'+T.muted+';font-size:12px;margin-right:22px}'
+'.pp-dot{width:9px;height:9px;border-radius:55% 45% 52% 48%;flex:none}'
+'.pp-title{font:600 19px/1.2 \'EB Garamond\',Georgia,serif;margin:3px 0 6px;overflow-wrap:anywhere}'
+'.pp-badges{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}'
+'.pp-badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:9px 6px 8px 5px;background:'+T.gold+'33;color:'+T.ink+'}'
+'.pp-badge.em{background:'+T.coral+'2b}'
+'.pp-row{color:'+T.muted+';margin:2px 0;overflow-wrap:anywhere}'
+'.pp-note{font-size:11px;color:'+T.muted+';font-style:italic;margin-top:6px}'
+'.pp-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}'
+'.pp-btn{font:600 12px/1 -apple-system,system-ui,sans-serif;min-height:36px;padding:0 14px;border-radius:15px 11px 14px 10px;border:1px solid '+T.forest+';background:'+T.forest+';color:'+T.white+';cursor:pointer}'
+'.pp-btn.alt{background:transparent;color:'+T.forest+'}'
+'.pp-btn:focus-visible{outline:2px solid '+T.gold+';outline-offset:2px}'
+'.me{width:18px;height:18px;border-radius:50%;background:#3F4B8A;border:3px solid '+T.white+';box-shadow:0 0 0 8px rgba(63,75,138,.2)}';document.head.appendChild(st);document.body.style.background=T.paper;
function send(m){var s=JSON.stringify(m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else window.parent.postMessage({ihssanMap:m},'*');}
if(!window.mapboxgl){send({type:'error',message:'Could not load the map library. Check your connection.'});return;}
mapboxgl.accessToken=CFG.token;
var FONT=['DIN Pro Medium','Arial Unicode MS Regular'];
var pins=[],byId={},mode='2d',selectedId=null,popup=null,userMarker=null,loaded=false,pending=[];
var map=new mapboxgl.Map({container:'map',style:CFG.styleUrl,center:[-7.0,31.8],zoom:5.2,pitch:0,bearing:0,maxPitch:0,attributionControl:true,dragRotate:false,touchPitch:false});
map.addControl(new mapboxgl.AttributionControl({compact:true}),'bottom-left');
map.on('error',function(e){var m=e&&e.error&&e.error.message;if(m&&/401|403|access token/i.test(m))send({type:'error',message:'The map token was rejected.'});});

function rnd(seed){var x=Math.sin(seed*9301+49297)*233280;return x-Math.floor(x);}
function glyph(c,kind,cx,cy){
  c.save();c.strokeStyle=T.white;c.fillStyle=T.white;c.lineWidth=2.6;c.lineCap='round';c.lineJoin='round';c.beginPath();
  if(kind==='pharmacy'){c.moveTo(cx,cy-6);c.lineTo(cx+.4,cy+6);c.moveTo(cx-6,cy+.3);c.lineTo(cx+6,cy-.2);}
  else if(kind==='hospital'){c.moveTo(cx-4.5,cy-6);c.lineTo(cx-4.2,cy+6);c.moveTo(cx+4.5,cy-6);c.lineTo(cx+4.8,cy+6);c.moveTo(cx-4.4,cy);c.lineTo(cx+4.7,cy+.3);}
  else if(kind==='clinic'){c.moveTo(cx-6.5,cy+.5);c.lineTo(cx,cy-6);c.lineTo(cx+6.5,cy+.5);c.moveTo(cx-4.5,cy+.5);c.lineTo(cx-4.3,cy+6);c.lineTo(cx+4.6,cy+6);c.lineTo(cx+4.5,cy+.5);}
  else if(kind==='laboratory'){c.moveTo(cx-2.5,cy-6.5);c.lineTo(cx-2.3,cy-1);c.lineTo(cx-6,cy+5.5);c.lineTo(cx+6,cy+5.7);c.lineTo(cx+2.4,cy-1);c.lineTo(cx+2.6,cy-6.5);}
  else{c.arc(cx,cy-3,3,0,Math.PI*2);c.moveTo(cx-6,cy+6.5);c.quadraticCurveTo(cx,cy-1.5,cx+6.2,cy+6.4);}
  c.stroke();c.restore();
}
function pinImage(kind,duty,seed){
  var S=2,W=40,H=48,cv=document.createElement('canvas');cv.width=W*S;cv.height=H*S;var c=cv.getContext('2d');c.scale(S,S);
  var cx=20,cy=19,r=14.5,n=9,pts=[],i;
  for(i=0;i<n;i++){var a=(i/n)*Math.PI*2,k=r*(0.93+rnd(seed+i)*0.14);pts.push([cx+Math.cos(a)*k,cy+Math.sin(a)*k]);}
  function mid(p,q){return[(p[0]+q[0])/2,(p[1]+q[1])/2];}
  function blob(){c.beginPath();var m0=mid(pts[n-1],pts[0]);c.moveTo(m0[0],m0[1]);for(i=0;i<n;i++){var m=mid(pts[i],pts[(i+1)%n]);c.quadraticCurveTo(pts[i][0],pts[i][1],m[0],m[1]);}c.closePath();}
  c.shadowColor='rgba(40,30,15,.35)';c.shadowBlur=4;c.shadowOffsetY=2;
  c.beginPath();c.moveTo(cx-6,cy+10);c.lineTo(cx+.5,cy+27);c.lineTo(cx+6.5,cy+10);c.closePath();c.fillStyle=T.kinds[kind];c.fill();
  blob();c.fillStyle=T.kinds[kind];c.fill();c.shadowColor='transparent';
  blob();c.lineWidth=duty?4:2.2;c.strokeStyle=duty?T.gold:T.white;c.stroke();
  glyph(c,kind,cx,cy);
  return c.getImageData(0,0,W*S,H*S);
}
var kinds=['pharmacy','clinic','hospital','laboratory','doctor'];
function addImages(){kinds.forEach(function(k,i){[0,1].forEach(function(d){var id='pin-'+k+'-'+d;if(!map.hasImage(id))map.addImage(id,pinImage(k,d,i*17+d*5+3),{pixelRatio:2});});});}
function geo(){return{type:'FeatureCollection',features:pins.map(function(p){return{type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{id:p.id,name:p.name,icon:'pin-'+p.kind+'-'+(p.duty?1:0),d:p.duty?1:0,prio:(p.duty?2:0)+(p.emergency?1:0)+(p.kind==='hospital'?1:0)}};})};}
function selGeo(){var p=selectedId&&byId[selectedId];return{type:'FeatureCollection',features:p?[{type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{icon:'pin-'+p.kind+'-'+(p.duty?1:0)}}]:[]};}
function addLayers(){
  addImages();
  if(!map.getSource('places'))map.addSource('places',{type:'geojson',data:geo(),cluster:true,clusterRadius:48,clusterMaxZoom:13,clusterProperties:{duty:['max',['get','d']]}});
  if(!map.getSource('selected'))map.addSource('selected',{type:'geojson',data:selGeo()});
  if(!map.getLayer('clusters'))map.addLayer({id:'clusters',type:'circle',source:'places',slot:'top',filter:['has','point_count'],paint:{'circle-color':T.white,'circle-stroke-color':['case',['==',['get','duty'],1],T.gold,T.forest],'circle-stroke-width':['case',['==',['get','duty'],1],3.5,2],'circle-radius':['step',['get','point_count'],17,10,21,50,26,200,31]}});
  if(!map.getLayer('cluster-count'))map.addLayer({id:'cluster-count',type:'symbol',source:'places',slot:'top',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':FONT,'text-size':13,'text-allow-overlap':true},paint:{'text-color':T.ink}});
  if(!map.getLayer('pins'))map.addLayer({id:'pins',type:'symbol',source:'places',slot:'top',filter:['!',['has','point_count']],layout:{'icon-image':['get','icon'],'icon-anchor':'bottom','icon-allow-overlap':true,'icon-size':['interpolate',['linear'],['zoom'],8,.75,15,1],'symbol-sort-key':['get','prio'],'text-field':['step',['zoom'],'',14,['get','name']],'text-font':FONT,'text-size':11.5,'text-anchor':'top','text-offset':[0,.4],'text-optional':true,'text-max-width':9},paint:{'text-color':T.ink,'text-halo-color':T.paper,'text-halo-width':1.6}});
  if(!map.getLayer('selected'))map.addLayer({id:'selected',type:'symbol',source:'selected',slot:'top',layout:{'icon-image':['get','icon'],'icon-anchor':'bottom','icon-allow-overlap':true,'icon-size':1.3}});
}
function refresh(){var s=map.getSource('places');if(s)s.setData(geo());var t=map.getSource('selected');if(t)t.setData(selGeo());}
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
function closePopup(silent){var p=popup;popup=null;if(p)p.remove();if(!silent){selectedId=null;refresh();send({type:'select',id:null});}}
function openPopup(id,fly){
  var p=byId[id];if(!p)return;closePopup(true);selectedId=id;refresh();
  var box=el('div');var kr=el('div','pp-kind');var dot=el('span','pp-dot');dot.style.background=T.kinds[p.kind];kr.appendChild(dot);kr.appendChild(el('span','',p.subtitle||p.kind));box.appendChild(kr);
  box.appendChild(el('div','pp-title',p.name));
  if(p.duty||p.emergency){var b=el('div','pp-badges');if(p.duty)b.appendChild(el('span','pp-badge',p.duty));if(p.emergency)b.appendChild(el('span','pp-badge em','Emergency'));box.appendChild(b);}
  if(p.address)box.appendChild(el('div','pp-row',p.address));
  if(p.hours)box.appendChild(el('div','pp-row',p.hours));
  if(p.distance)box.appendChild(el('div','pp-row',p.distance+' away'));
  if(p.duty)box.appendChild(el('div','pp-note','Duty schedules change. Please call to confirm before you travel.'));
  var act=el('div','pp-actions');
  function btn(label,type,alt){var x=el('button','pp-btn'+(alt?' alt':''),label);x.type='button';x.addEventListener('click',function(){send({type:type,id:id});});act.appendChild(x);}
  if(p.canCall)btn('Call','call',true);
  btn('Directions','directions',false);
  if(p.canOpenProfile)btn('View profile','profile',true);
  box.appendChild(act);
  var pp=new mapboxgl.Popup({offset:[0,-46],maxWidth:'290px',closeOnClick:false,focusAfterOpen:false}).setLngLat([p.lng,p.lat]).setDOMContent(box).addTo(map);popup=pp;
  pp.on('close',function(){if(popup===pp){popup=null;selectedId=null;refresh();send({type:'select',id:null});}});
  if(fly)map.flyTo({center:[p.lng,p.lat],zoom:Math.max(map.getZoom(),15),speed:1,curve:1.4,essential:false});
  send({type:'select',id:id});
}
function applyMode(m){
  mode=m;
  try{map.setConfigProperty('basemap','show3dObjects',m==='3d');}catch(e){}
  if(m==='3d'){map.setMaxPitch(85);map.dragRotate.enable();map.touchZoomRotate.enableRotation();map.touchPitch.enable();map.easeTo({pitch:62,duration:900,essential:false});}
  else{map.easeTo({pitch:0,bearing:0,duration:700,essential:false});map.once('moveend',function(){if(mode==='2d'){map.setMaxPitch(0);map.dragRotate.disable();map.touchPitch.disable();}});}
}
function report(){var c=map.getCenter(),b=map.getBounds(),ne=b.getNorthEast();var rad=Math.PI/180;var dLat=(ne.lat-c.lat)*rad,dLng=(ne.lng-c.lng)*rad;var h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(c.lat*rad)*Math.cos(ne.lat*rad)*Math.sin(dLng/2)*Math.sin(dLng/2);send({type:'moved',lat:c.lat,lng:c.lng,zoom:map.getZoom(),radiusKm:2*6371*Math.asin(Math.min(1,Math.sqrt(h)))});}
var moveTimer=null;
map.on('moveend',function(){clearTimeout(moveTimer);moveTimer=setTimeout(report,350);});
map.on('click','clusters',function(e){var f=e.features[0];map.getSource('places').getClusterExpansionZoom(f.properties.cluster_id,function(err,z){if(err)return;map.flyTo({center:f.geometry.coordinates,zoom:Math.min(z+.5,17),essential:false});});});
map.on('click','pins',function(e){var f=e.features[0];if(f)openPopup(f.properties.id,true);});
['clusters','pins'].forEach(function(l){map.on('mouseenter',l,function(){map.getCanvas().style.cursor='pointer';});map.on('mouseleave',l,function(){map.getCanvas().style.cursor='';});});
map.on('click',function(e){var hit=map.queryRenderedFeatures(e.point,{layers:['clusters','pins']});if(!hit.length&&selectedId)closePopup(false);});
function run(m){
  if(m.type==='pins'){pins=m.pins||[];byId={};pins.forEach(function(p){byId[p.id]=p;});if(selectedId&&!byId[selectedId]){closePopup(false);}refresh();}
  else if(m.type==='user'){if(userMarker){userMarker.remove();userMarker=null;}if(m.position){userMarker=new mapboxgl.Marker({element:el('div','me')}).setLngLat([m.position.lng,m.position.lat]).addTo(map);}}
  else if(m.type==='fly'){map.flyTo({center:[m.lng,m.lat],zoom:m.zoom,speed:.9,curve:1.5,essential:false});}
  else if(m.type==='mode'){applyMode(m.mode);}
  else if(m.type==='select'){if(m.id)openPopup(m.id,true);else closePopup(false);}
}
window.__fromApp=function(m){if(!m||typeof m!=='object')return;if(!loaded){pending.push(m);return;}run(m);};
window.addEventListener('message',function(e){if(e.source===window.parent&&e.data&&e.data.ihssanIn)window.__fromApp(e.data.ihssanIn);});
map.on('style.load',function(){addLayers();if(!loaded){loaded=true;pending.splice(0).forEach(run);send({type:'ready'});}else refresh();});
})();
