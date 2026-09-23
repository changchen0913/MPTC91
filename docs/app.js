import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from './vendor/RectAreaLightUniformsLib.js';

const $ = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = $('#scene'), stage = $('#stage');
const data = [
 {name:'紀念咖啡包',en:'A MOMENT TO SAVOR',description:'將山巒與晨光，收藏進一杯日常。暖棕色包裝承載山岳意象，為每一次停歇，留下一份溫度。',spec:[['尺寸','10.1 × 8.2 公分'],['組合','6 入'],['設計','山巒・日光・暖棕色調']]},
 {name:'山形玻璃杯',en:'A LANDSCAPE IN YOUR HAND',description:'通透杯身之中，山峰靜靜佇立。厚實杯底承托起伏山形，白色 91 週年徽記，留下值得珍藏的時刻。',spec:[['尺寸','直徑 8.2 × 高 9.5 公分'],['外觀','透明杯身・立體山形杯底'],['紀念','91 週年白色徽記']]},
 {name:'紀念滑鼠墊',en:'EVERYDAY, WITH PURPOSE',description:'將守護的身影與綿延山景，延伸至日常桌面。金色線條穿過沉穩的大地色彩，細緻黑色包邊收束每一道風景。',spec:[['尺寸','25 × 30 公分'],['設計','憲兵剪影・山景・金色線條'],['收納','捲式收納・展開欣賞']]}
];
let renderer, scene, camera, controls, root, lid, flap, raycaster, floor;
let items=[], focus=-1, lidTarget=0, lidAngle=0, unfold=0, unfoldTarget=0, matGeometry, stitches;
let anim=null, ready=false, pointerDown=null, lastFocused=null, selecting=false, lidDrag=null, lidDeg=-1, lidOpen=null;
const homeCam=new THREE.Vector3(1.9,10.43,8.44), homeTarget=new THREE.Vector3(-.69,1.98,1.08);
// Putting a product back returns to an overhead read of the open box, not the closed-box opening shot.
const boxCam=new THREE.Vector3(1.72,13.1,7.4), boxTarget=new THREE.Vector3(-.41,2.27,.52);
const clock=new THREE.Clock();
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const tex = canvas => {const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;};
function surface(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),c);return tex(c);}
const loadImage=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('無法載入 '+src));i.src=src;});
function box(w,h,d,material,x=0,y=0,z=0,parent=root){const radius=Math.min(.035,Math.min(w,h,d)*.22);const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,radius),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function plane(w,h,material,parent,x,y,z){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);parent.add(m);return m;}
function ring(r,t,material,parent,y=0){const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,12,100),material);m.rotation.x=Math.PI/2;m.position.y=y;parent.add(m);return m;}
function foamPanel(material){
 const s=new THREE.Shape();s.moveTo(-1.745,-3.18);s.lineTo(1.745,-3.18);s.lineTo(1.745,3.18);s.lineTo(-1.745,3.18);s.closePath();
 for(const [x,z,w,h] of [[-.59,-1.64,2.24,2.81],[-.59,1.65,2.24,2.73],[1.18,0,1.02,6.29]]){const p=new THREE.Path();p.moveTo(x-w/2,z-h/2);p.lineTo(x-w/2,z+h/2);p.lineTo(x+w/2,z+h/2);p.lineTo(x+w/2,z-h/2);p.closePath();s.holes.push(p);}
 const g=new THREE.ExtrudeGeometry(s,{depth:1.79,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.009,bevelThickness:.009});g.rotateX(Math.PI/2);const m=new THREE.Mesh(g,material);m.position.y=2.31;m.castShadow=true;m.receiveShadow=true;root.add(m);
}
function makeCup(whiteLogo){
 const studio=surface(1024,512,ctx=>{ctx.fillStyle='#15191e';ctx.fillRect(0,0,1024,512);const gradient=ctx.createLinearGradient(0,0,0,512);gradient.addColorStop(0,'#b3bac0');gradient.addColorStop(.4,'#22272d');gradient.addColorStop(1,'#0a0b0d');ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,512);ctx.fillStyle='#ffffff';ctx.fillRect(120,45,90,380);ctx.fillRect(630,85,145,300);ctx.fillStyle='#717d86';ctx.fillRect(850,0,65,512);});studio.mapping=THREE.EquirectangularReflectionMapping;const pm=new THREE.PMREMGenerator(renderer),environment=pm.fromEquirectangular(studio).texture;pm.dispose();studio.dispose();
 const p=new THREE.Group();const glass=new THREE.MeshPhysicalMaterial({color:0xf5fbff,metalness:.12,roughness:.025,transmission:.05,transparent:true,opacity:.29,depthWrite:false,thickness:.12,ior:1.5,envMap:environment,envMapIntensity:1.5,clearcoat:1,side:THREE.DoubleSide});
 const profile=[[0,0],[.92,0],[1.008,.045],[1.025,.14],[1.025,2.3],[1.015,2.36],[.99,2.375],[.963,2.35],[.956,2.25],[.95,.23],[.86,.18],[0,.18]].map(v=>new THREE.Vector2(...v));
 const mesh=new THREE.Mesh(new THREE.LatheGeometry(profile,100),glass);mesh.castShadow=false;p.add(mesh);const rimMaterial=new THREE.MeshPhysicalMaterial({color:0xc6d0d5,metalness:.92,roughness:.055,envMap:environment,envMapIntensity:1.1,transparent:true,opacity:.62});ring(.995,.019,rimMaterial,p,2.335);ring(.97,.032,rimMaterial,p,.1);ring(.962,.018,rimMaterial,p,.205);
 const vertices=[],indices=[],rings=48,segments=120;
 for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){const r=.94*j/rings,a=2*Math.PI*i/segments,x=Math.cos(a)*r,z=Math.sin(a)*r,edge=Math.max(0,1-r*r/.884);const peaks=.96*Math.exp(-((x-.22)**2+(z+.05)**2)/.085)+.66*Math.exp(-((x+.35)**2+(z-.08)**2)/.10)+.41*Math.exp(-((x-.12)**2+(z-.4)**2)/.075);const noise=(Math.sin(x*43+z*17)+Math.cos(z*39-x*8))*.021;vertices.push(x,.19+(peaks+noise)*Math.min(1,edge*6),z);if(j<rings&&i<segments){const n=j*(segments+1)+i;indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
 const mountain=new THREE.Mesh(g,new THREE.MeshPhysicalMaterial({color:0xe6edf2,roughness:.085,metalness:1,clearcoat:1,envMap:environment,envMapIntensity:1.15,side:THREE.DoubleSide}));p.add(mountain);
 const logoTexture=surface(512,512,ctx=>{ctx.drawImage(whiteLogo,0,0,512,512);const im=ctx.getImageData(0,0,512,512);for(let i=0;i<im.data.length;i+=4){im.data[i+3]=Math.round(im.data[i+3]*Math.min(im.data[i],im.data[i+1],im.data[i+2])/255);im.data[i]=im.data[i+1]=im.data[i+2]=255;}ctx.putImageData(im,0,0);});
 const decal=new THREE.Mesh(new THREE.CylinderGeometry(1.029,1.029,.56,40,1,true,-.1,.67),new THREE.MeshBasicMaterial({map:logoTexture,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}));decal.position.y=.59;p.add(decal);
 p.children.forEach(child=>child.position.y-=1.1875);p.position.set(-.59,1.28,1.6725);p.rotation.x=-Math.PI/2;p.userData.home=p.position.clone();p.userData.rotation=p.quaternion.clone();return p;
}
function makeCoffee(img){
 const group=new THREE.Group();const face=surface(656,808,ctx=>ctx.drawImage(img,211,163,335,577,0,0,656,808));
 const brown=new THREE.MeshStandardMaterial({color:0x67503e,roughness:.73,metalness:.15});const faceMat=new THREE.MeshStandardMaterial({map:face,color:0xa6a6a6,roughness:.85,metalness:.06});
 for(let i=0;i<6;i++){const pack=new THREE.Group();box(2.05,.048,2.525,brown,0,0,0,pack);const f=plane(2.05,2.525,faceMat,pack,0,.025,0);f.receiveShadow=true;for(let j=0;j<5;j++){box(2.04,.015,.012,brown,0,.033,-1.24+j*.019,pack);box(2.04,.015,.012,brown,0,.033,1.16+j*.019,pack);}pack.position.set((i-5)*-.016,(i-5)*.065,(i-5)*-.018);group.add(pack);}
 group.position.set(-.64,2.30,-1.62);group.userData.home=group.position.clone();group.userData.rotation=group.quaternion.clone();return group;
}
function makeMat(img){
 const group=new THREE.Group();const imageTex=surface(1200,1440,ctx=>ctx.drawImage(img,0,0,1200,1440));
 const silhouette=surface(2048,2048,ctx=>{ctx.fillStyle='#000';ctx.fillRect(0,0,2048,2048);ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(9,9,2030,2030,165);ctx.fill();});silhouette.colorSpace=THREE.NoColorSpace;
 matGeometry=new THREE.PlaneGeometry(7.5,6.25,160,64);
 const material=new THREE.MeshStandardMaterial({map:imageTex,color:0xbcbcbc,alphaMap:silhouette,alphaTest:.5,side:THREE.FrontSide,roughness:.94,metalness:0});
 const sheet=new THREE.Mesh(matGeometry,material);sheet.castShadow=true;sheet.receiveShadow=true;group.add(sheet);
 sheet.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,alphaMap:silhouette,alphaTest:.5});
 const back=new THREE.Mesh(matGeometry,new THREE.MeshStandardMaterial({color:0x141417,alphaMap:silhouette,alphaTest:.5,side:THREE.BackSide,roughness:1}));group.add(back);
 const lineMat=new THREE.LineBasicMaterial({color:0x151518});const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array((161*2+63*2)*3),3));stitches=new THREE.LineLoop(lineGeo,lineMat);stitches.visible=false;group.add(stitches);
 group.position.set(1.18,1.86,0);group.userData.home=group.position.clone();group.userData.rotation=group.quaternion.clone();updateMat(0);return group;
}
function updateMat(t){
 // A continuous sheet rolls around the long axis; the same surface unrolls to 25 × 30 cm.
 const pos=matGeometry.attributes.position,uv=matGeometry.attributes.uv;const curvature=THREE.MathUtils.lerp(2.14,.00001,t);
 const boundary=[];
 for(let i=0;i<pos.count;i++){const u=uv.getX(i),v=uv.getY(i),s=(u-.5)*7.5,a=s*curvature,r=1/curvature+.012*(s+3.75);const x=Math.sin(a)*r,y=(Math.cos(a)-1)/curvature+.47*(1-t)+.012*(s+3.75)*Math.cos(a),z=(.5-v)*6.25;pos.setXYZ(i,x,y,z);}
 pos.needsUpdate=true;matGeometry.computeVertexNormals();matGeometry.computeBoundingSphere();
 const lp=stitches.geometry.attributes.position;let k=0;const copy=i=>{lp.setXYZ(k++,pos.getX(i),pos.getY(i)+.006,pos.getZ(i));};for(let i=0;i<=160;i++)copy(i);for(let j=1;j<64;j++)copy(j*161+160);for(let i=160;i>=0;i--)copy(64*161+i);for(let j=63;j>=1;j--)copy(j*161);lp.needsUpdate=true;stitches.geometry.computeBoundingSphere();
}
async function init(){
 try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 scene=new THREE.Scene();scene.background=new THREE.Color(0xf5f5f7);camera=new THREE.PerspectiveCamera(36,1,.1,150);camera.position.copy(homeCam);
 controls=new OrbitControls(camera,canvas);controls.target.copy(homeTarget);controls.enableDamping=true;controls.dampingFactor=.065;controls.enablePan=false;controls.minDistance=7;controls.maxDistance=30;controls.maxPolarAngle=Math.PI*.86;controls.minPolarAngle=.12;
 const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.08).texture;scene.environmentIntensity=.48;pmrem.dispose();
 RectAreaLightUniformsLib.init();
 scene.add(new THREE.HemisphereLight(0xf7f4ef,0x413127,.26));
 const softbox=new THREE.RectAreaLight(0xfff0db,6.5,10,12);softbox.position.set(-7,10,5);softbox.lookAt(0,1,0);scene.add(softbox);
 const strip=new THREE.RectAreaLight(0xe5edff,4.8,3,10);strip.position.set(5,6,-6);strip.lookAt(0,1,0);scene.add(strip);
 const fill=new THREE.RectAreaLight(0xffffff,1.8,8,5);fill.position.set(3,7,10);fill.lookAt(0,1,0);scene.add(fill);
 const key=new THREE.DirectionalLight(0xfff3e3,1.5);key.position.set(-5,12,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:1,far:35});key.shadow.bias=-.00015;key.shadow.normalBias=.015;key.shadow.radius=12;key.shadow.blurSamples=12;scene.add(key);
 floor=new THREE.Group();scene.add(floor);
 root=new THREE.Group();scene.add(root);root.position.x=.7;
 const [coverArt,opened,matImg,logo,woodImage]=await Promise.all(['cover.png','open.png','mousepad.png','logo-white.png','walnut.png'].map(x=>loadImage('./assets/'+x)));
 const wood=tex(woodImage);wood.wrapS=wood.wrapT=THREE.RepeatWrapping;wood.repeat.set(4,4);wood.anisotropy=renderer.capabilities.getMaxAnisotropy();
 const woodRelief=wood.clone();woodRelief.colorSpace=THREE.NoColorSpace;
 const woodMaterial=new THREE.MeshPhysicalMaterial({map:wood,color:0xdfcdbb,roughness:.46,metalness:0,bumpMap:woodRelief,bumpScale:.018,clearcoat:.18,clearcoatRoughness:.5});
 const desk=new THREE.Mesh(new THREE.PlaneGeometry(80,80),woodMaterial);desk.rotation.x=-Math.PI/2;desk.position.y=-.02;desk.receiveShadow=true;floor.add(desk);
 const contact=surface(512,768,ctx=>{ctx.shadowColor='rgba(0,0,0,.75)';ctx.shadowBlur=35;ctx.fillStyle='rgba(0,0,0,.75)';ctx.fillRect(57,62,398,644);});
 const occlusion=plane(4.4,7.3,new THREE.MeshBasicMaterial({map:contact,transparent:true,opacity:.47,depthWrite:false}),floor,.7,-.012,0);occlusion.renderOrder=1;
 const grain=surface(256,256,ctx=>{ctx.fillStyle='#29292b';ctx.fillRect(0,0,256,256);let seed=37;for(let i=0;i<18000;i++){seed=(seed*16807)%2147483647;const x=seed%256;seed=(seed*16807)%2147483647;const y=seed%256;ctx.fillStyle=i%2?'#343436':'#202022';ctx.fillRect(x,y,1,1);}});grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(5,7);
 const black=new THREE.MeshPhysicalMaterial({color:0xa1a1a5,map:grain,bumpMap:grain,bumpScale:.014,roughness:.57,metalness:.03,clearcoat:.12,clearcoatRoughness:.65});const foam=new THREE.MeshStandardMaterial({color:0x454548,map:grain,bumpMap:grain,bumpScale:.022,roughness:1});
 // All model dimensions use 0.25 scene units per centimetre: 15 × 26.5 × 10 cm.
 box(3.75,.12,6.625,black,0,.06,0);box(.12,2.27,6.625,black,-1.815,1.255,0);box(.12,2.27,6.625,black,1.815,1.255,0);box(3.51,2.27,.12,black,0,1.255,-3.2525);box(3.51,2.27,.12,black,0,1.255,3.2525);box(3.5,.35,6.38,foam,0,.35,0);foamPanel(foam);
 lid=new THREE.Group();lid.position.set(-1.875,2.445,0);root.add(lid);box(3.75,.10,6.625,black,1.875,0,0,lid);
 // The artwork's black ground is knocked out so the lid keeps the box's own grain underneath;
 // printing it as-is made the panel read as a sticker laid on the box.
 const cover=surface(768,1363,ctx=>{
  const h=Math.round(768*coverArt.height/coverArt.width),sx=768/5/256,sy=1363/7/256;
  ctx.save();ctx.scale(sx,sy);ctx.fillStyle=ctx.createPattern(grain.image,'repeat');ctx.fillRect(0,0,768/sx,1363/sy);ctx.restore();
  const art=document.createElement('canvas');art.width=768;art.height=h;
  const ac=art.getContext('2d');ac.drawImage(coverArt,0,0,768,h);
  const px=ac.getImageData(0,0,768,h);
  for(let i=0;i<px.data.length;i+=4){px.data[i+3]=Math.max(0,Math.min(255,(Math.max(px.data[i],px.data[i+1],px.data[i+2])-45)*5));
   for(let c=i;c<i+3;c++)px.data[c]=Math.min(255,px.data[c]*1.18);}
  ac.putImageData(px,0,0);ctx.drawImage(art,0,(1363-h)/2);
 });
 const foil=surface(768,1363,ctx=>{ctx.drawImage(cover.image,0,0);const pix=ctx.getImageData(0,0,768,1363);for(let i=0;i<pix.data.length;i+=4){const r=pix.data[i],g=pix.data[i+1],b=pix.data[i+2],gold=r>95&&g>70&&r>g*1.04&&g>b*1.14;pix.data[i]=pix.data[i+1]=pix.data[i+2]=gold?215:0;}ctx.putImageData(pix,0,0);});foil.colorSpace=THREE.NoColorSpace;
 const top=plane(3.71,6.585,new THREE.MeshPhysicalMaterial({map:cover,color:0xa1a1a5,roughness:.57,metalness:1,metalnessMap:foil,bumpMap:grain,bumpScale:.014,clearcoat:.12,clearcoatRoughness:.65}),lid,1.875,.055,0);top.userData.lid=true;top.castShadow=true;
 // The second fold is the magnetic side flap. Its inner face meets the right wall.
 flap=new THREE.Group();flap.position.set(3.75,0,0);lid.add(flap);box(2.37,.10,6.625,black,1.185,0,0,flap);flap.rotation.z=-Math.PI/2;
 const creaseMaterial=new THREE.MeshStandardMaterial({color:0x111113,roughness:.9});const crease=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,6.58,16),creaseMaterial);crease.rotation.x=Math.PI/2;flap.add(crease);
 lid.traverse(object=>{if(object.isMesh)object.userData.lid=true;});
 const hinge=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,6.60,20),black);hinge.rotation.x=Math.PI/2;hinge.position.set(-1.87,2.44,0);root.add(hinge);
 items=[makeCoffee(opened),makeCup(logo),makeMat(matImg)];items.forEach((p,i)=>{root.add(p);p.userData.index=i;p.traverse(o=>{if(o.isMesh)o.userData.product=i;});});
 raycaster=new THREE.Raycaster();ready=true;resize();controls.update();$('#loading').style.opacity='0';setTimeout(()=>$('#loading').remove(),550);requestAnimationFrame(render);
 }catch(error){console.error(error);$('#loading')?.remove();$('#error').hidden=false;}
}
function resize(){if(!renderer)return;const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.fov=36;camera.updateProjectionMatrix();if(ready&&focus<0&&!anim){camera.position.copy(homeCam);controls.target.copy(homeTarget);}}
function changeLid(deg){if(!ready||focus>=0||anim)return;lidTarget=deg*Math.PI/180;}
function syncLidUI(){
 const deg=Math.round(lidAngle*180/Math.PI);if(deg===lidDeg)return;lidDeg=deg;
 $('main').classList.toggle('opened',deg>30);
 const open=deg>90;if(open===lidOpen)return;lidOpen=open;
 $('#toggle').textContent=open?'合上禮盒':'打開禮盒';
 $('#hint').innerHTML=open?'拖曳旋轉 <i>·</i> 滾輪縮放 <i>·</i> 點選產品拿起欣賞':'拖曳盒蓋開啟 <i>·</i> 拖曳空白處旋轉 <i>·</i> 滾輪縮放';
}
function transition(ms,fn,end){anim={start:performance.now(),duration:reduce?1:ms,fn,end};}
async function select(index){
 if(!ready||focus>=0||anim||selecting)return;
 selecting=true;
 if(lidAngle<2.7){changeLid(180);await new Promise(r=>setTimeout(r,reduce?30:1050));}
 selecting=false;if(focus>=0||anim)return;
 focus=index;$('#product-label').style.opacity=0;lastFocused=document.activeElement;const item=items[index];scene.attach(item);const start=item.position.clone(),q=item.quaternion.clone();
 // The box and desk stay put; the product simply lifts out and the camera dollies in.
 const target=new THREE.Vector3(-2,4.9,1.8);const rot=index===0?new THREE.Euler(.95,-.1,0):index===1?new THREE.Euler(0,-.15,0):new THREE.Euler(.32,0,-.12);const targetQ=new THREE.Quaternion().setFromEuler(rot);
 const cp=camera.position.clone(),ct=controls.target.clone();const focusTarget=new THREE.Vector3(-.55,4.6,1.6);const focusCam=index===2?new THREE.Vector3(2.8,8.9,15.8):new THREE.Vector3(1.9,7.6,10.2);
 controls.enabled=false;controls.enableRotate=false;controls.minDistance=4;controls.maxDistance=25;
 const d=data[index];$('#detail-number').textContent='0'+(index+1)+' / 三種珍藏';$('#detail-title').textContent=d.name;$('#detail-subtitle').textContent=d.en;$('#detail-description').textContent=d.description;$('#detail-spec').replaceChildren(...d.spec.flatMap(([k,v])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;return[dt,dd];}));$('#unroll').hidden=index!==2;$('#unroll').textContent='展開滑鼠墊';$('#detail').classList.add('active');$('#detail').removeAttribute('inert');$('#detail').setAttribute('aria-hidden','false');$('main').classList.add('focusing');$('.bottom').inert=true;$('#close-detail').focus({preventScroll:true});
 transition(1200,t=>{item.position.lerpVectors(start,target,t);item.position.y+=Math.sin(t*Math.PI)*1.1;item.quaternion.slerpQuaternions(q,targetQ,t);camera.position.lerpVectors(cp,focusCam,t);controls.target.lerpVectors(ct,focusTarget,t);},()=>{controls.enabled=true;});
}
function putBack(){
 if(focus<0||anim)return;const index=focus,item=items[index];controls.enabled=false;const from=item.position.clone(),q=item.quaternion.clone(),cp=camera.position.clone(),ct=controls.target.clone();unfoldTarget=0;
 $('#detail').classList.remove('active');$('#detail').setAttribute('aria-hidden','true');$('#detail').inert=true;$('main').classList.remove('focusing');$('.bottom').inert=false;
 const target=items[index].userData.home.clone().add(new THREE.Vector3(root.position.x,0,0));
 transition(1200,t=>{item.position.lerpVectors(from,target,t);item.position.y+=Math.sin(t*Math.PI)*1.1;item.quaternion.slerpQuaternions(q,item.userData.rotation,t);camera.position.lerpVectors(cp,boxCam,t);controls.target.lerpVectors(ct,boxTarget,t);},()=>{root.attach(item);item.position.copy(item.userData.home);item.quaternion.copy(item.userData.rotation);focus=-1;controls.enabled=true;controls.enableRotate=true;controls.minDistance=7;controls.maxDistance=30;if(lastFocused instanceof HTMLElement)lastFocused.focus({preventScroll:true});});
}
const lidPlane=new THREE.Plane(new THREE.Vector3(0,0,1)),hinge=new THREE.Vector3();
function castRay(event){const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),camera);}
function hit(event){castRay(event);return raycaster.intersectObjects(focus<0?[root]:[items[focus]],true).find(h=>h.object.isMesh);}
// Angle of the pointer around the hinge, measured in the slice of the lid's swing it was grabbed on.
function lidAngleAt(event,z){
 castRay(event);if(Math.abs(raycaster.ray.direction.z)<.2)return null;
 lidPlane.constant=-z;const p=raycaster.ray.intersectPlane(lidPlane,new THREE.Vector3());if(!p)return null;
 lid.getWorldPosition(hinge);return Math.atan2(p.y-hinge.y,p.x-hinge.x);
}
function dropLid(){const v=lidDrag.velocity;lidDrag=null;controls.enabled=true;canvas.style.cursor='grab';return Math.abs(v)>.04?v>0:lidAngle>Math.PI*.42;}
canvas.addEventListener('pointerdown',e=>{
 pointerDown={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY};canvas.setPointerCapture(e.pointerId);
 if(!ready||focus>=0||anim||selecting)return;
 const h=hit(e);if(!h?.object.userData.lid)return;
 const a=lidAngleAt(e,h.point.z);if(a===null)return;
 // Taking the drag over from OrbitControls, whose pointerdown listener is registered after this one.
 lidDrag={z:h.point.z,offset:lidAngle-a,velocity:0};controls.enabled=false;canvas.style.cursor='grabbing';$('#product-label').style.opacity=0;
});
canvas.addEventListener('pointerup',e=>{
 if(!ready||!pointerDown)return;
 const click=Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)<6;pointerDown=null;
 if(lidDrag){const flung=dropLid();lidTarget=(click?lidAngle<Math.PI/2:flung)?Math.PI:0;return;}
 if(!click||focus>=0||anim)return;
 const h=hit(e);
 if(lidAngle<1.4&&h)changeLid(180);else if(h?.object.userData.product!==undefined)select(h.object.userData.product);
});
canvas.addEventListener('pointermove',e=>{
 if(!ready)return;
 if(lidDrag){const a=lidAngleAt(e,lidDrag.z);if(a!==null){let t=a+lidDrag.offset;t+=Math.round((lidAngle-t)/(2*Math.PI))*2*Math.PI;t=Math.min(Math.PI,Math.max(0,t));lidDrag.velocity=(t-lidAngle)*.7+lidDrag.velocity*.3;lidAngle=lidTarget=t;}return;}
 if(focus>=0&&pointerDown&&!anim){const dx=e.clientX-pointerDown.lastX,dy=e.clientY-pointerDown.lastY;const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);items[focus].quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(up,dx*.008)).premultiply(new THREE.Quaternion().setFromAxisAngle(right,dy*.008));pointerDown.lastX=e.clientX;pointerDown.lastY=e.clientY;return;}
 if(focus>=0||pointerDown)return;
 const h=hit(e);const i=lidAngle>1.4?h?.object.userData.product:undefined;const label=$('#product-label');
 const text=i!==undefined?data[i].name+' ＋':h?.object.userData.lid?(lidAngle>Math.PI/2?'拖曳合上盒蓋':'拖曳開啟盒蓋'):null;
 if(text){label.textContent=text;label.style.left=(e.offsetX+18)+'px';label.style.top=(e.offsetY-30)+'px';label.style.opacity=1;canvas.style.cursor=i!==undefined?'pointer':'grab';}
 else{label.style.opacity=0;canvas.style.cursor=lidAngle<1.4&&h?'pointer':'grab';}
});
canvas.addEventListener('pointerleave',()=>{if(lidDrag)return;$('#product-label').style.opacity=0;pointerDown=null;});
canvas.addEventListener('pointercancel',()=>{if(lidDrag)lidTarget=dropLid()?Math.PI:0;pointerDown=null;});
$('#toggle').onclick=()=>changeLid(lidTarget>1?0:180);document.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>select(Number(b.dataset.product)));
$('#return').onclick=putBack;$('#close-detail').onclick=putBack;$('#unroll').onclick=()=>{unfoldTarget=unfoldTarget>.5?0:1;$('#unroll').textContent=unfoldTarget?'捲起滑鼠墊':'展開滑鼠墊';};
addEventListener('keydown',e=>{if(e.key==='Escape')putBack();});addEventListener('resize',resize);
function render(now){requestAnimationFrame(render);const dt=Math.min(clock.getDelta(),.05);if(!lidDrag)lidAngle=THREE.MathUtils.damp(lidAngle,lidTarget,reduce?1000:5.5,dt);syncLidUI();lid.rotation.z=lidAngle;flap.rotation.z=-Math.PI/2+Math.sin(lidAngle)*.6;if(Math.abs(unfold-unfoldTarget)>.0001){unfold=THREE.MathUtils.damp(unfold,unfoldTarget,reduce?1000:4,dt);updateMat(unfold);items[2].scale.setScalar(1-.48*unfold);}if(anim){const a=anim,t=Math.min(1,(now-a.start)/a.duration);a.fn(ease(t));if(t===1){anim=null;a.end?.();}}controls.update();renderer.render(scene,camera);}
init();
