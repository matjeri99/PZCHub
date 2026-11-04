'use strict';
const $=id=>document.getElementById(id);
// Apps Script serves the page inside a cross-site iframe; when the browser blocks third-party storage
// (Incognito, "Block third-party cookies", Safari) any sessionStorage access throws. Never let that stop the app.
const store={get(k){try{return window.sessionStorage.getItem(k);}catch(e){return null;}},
 set(k,v){try{window.sessionStorage.setItem(k,v);}catch(e){}},del(k){try{window.sessionStorage.removeItem(k);}catch(e){}}};
function showFatal(msg){const el=$('screen');if(el)el.innerHTML=`<div class="panel"><h3>Ralat memuatkan aplikasi</h3><p>${esc(msg)}</p><button class="btn" onclick="location.reload()">Muat Semula</button></div>`;}
window.addEventListener('error',e=>{if(/Memuatkan/.test($('screen')?.textContent||''))showFatal(e.message||'Ralat skrip.');});
window.addEventListener('unhandledrejection',e=>{if(/Memuatkan/.test($('screen')?.textContent||''))showFatal(e.reason?.message||String(e.reason));});
// NOTE: never write HTML entities (ampersand + name + ;) literally in this file \u2014 Apps Script HtmlService decodes them, even inside script tags.
// Written with char codes only: Apps Script HtmlService rewrites literal ampersand/angle-bracket sequences in this line.
const ESC_MAP={38:'\x26amp;',60:'\x26lt;',62:'\x26gt;',34:'\x26quot;',39:'\x26#39;'};
const esc=s=>String(s==null?'':s).replace(/[\x26\x3c\x3e\x22\x27]/g,c=>ESC_MAP[c.charCodeAt(0)]);
const fmt=n=>new Intl.NumberFormat('ms-MY',{style:'currency',currency:'MYR'}).format(Number(n||0));
const shortDate=s=>s?String(s).slice(0,16).replace('T',' \u00b7 '):'-';
const state={idToken:'',refreshToken:'',self:null,profile:null,view:'home',events:[],members:[],event:null,roster:[],orders:[],chat:[],found:null,merchEvent:null,merchItems:[],authMode:'login',ready:false};
const MENU=[['home','\u2302','Home'],['events','\u25a6','Events'],['members','\u2659','Members'],['spot','\u25ce','Spot Me'],['chat','\u260f','Chat'],['admin','\u2699','Admin']];
function toast(t){$('toast').textContent=t;clearTimeout(window._toastTimer);window._toastTimer=setTimeout(()=>$('toast').textContent='',4200);}
function busy(label='Memuatkan...'){$('screen').innerHTML=`<div class="panel muted">${esc(label)}</div>`;}
function api(name,payload={}){return new Promise((resolve,reject)=>{
 if(!state.idToken)return reject(Error('Sila log masuk.'));
 window.PZC_API.rpc(state.idToken,name,payload).then(resolve,reject);
});}
function authRequest(endpoint,data){
 if(!window.ZTG_CONFIG.firebaseApiKey)throw Error('Firebase API Key belum diset oleh Webmaster.');
 return fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(window.ZTG_CONFIG.firebaseApiKey)}`,
 {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
 .then(async r=>{const j=await r.json();if(!r.ok)throw Error((j.error?.message||'Gagal menghubungi Firebase').replaceAll('_',' '));return j;});}
function refreshRequest(refresh){return fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(window.ZTG_CONFIG.firebaseApiKey)}`,
 {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(refresh)})
 .then(async r=>{const j=await r.json();if(!r.ok)throw Error('Sesi tamat.');return j;});}
function saveSession(token,refresh){state.idToken=token;state.refreshToken=refresh||'';if(refresh)store.set('ztgRefresh',refresh);}
function clearSession(){state.idToken='';state.refreshToken='';state.self=null;state.profile=null;store.del('ztgRefresh');}
async function login(email,password,signup=false){const x=await authRequest(signup?'accounts:signUp':'accounts:signInWithPassword',{email,password,returnSecureToken:true});
 saveSession(x.idToken,x.refreshToken);
 if(signup){await authRequest('accounts:sendOobCode',{requestType:'VERIFY_EMAIL',idToken:x.idToken});clearSession();
   toast('Akaun dicipta. Semak emel untuk pengesahan, kemudian login.');renderAuth();return;}
 await afterLogin();}
async function afterLogin(){
 try{const b=await api('bootstrap');state.self=b.self;state.ready=true;state.view='home';await go('home');}
 catch(e){const message=e.message||'';if(/Sahkan emel/.test(message)){renderVerify(message);}else{clearSession();renderAuth();toast(message);}}
}
async function startup(){renderNav();const stored=store.get('ztgRefresh');
 if(stored){busy('Memulihkan sesi...');try{const r=await refreshRequest(stored);saveSession(r.id_token,r.refresh_token);await afterLogin();return;}catch(e){clearSession();}}
 renderAuth();}
function renderNav(){const links=MENU.map(([id,ic,label])=>`<button type="button" data-act="nav" data-id="${id}" class="${state.view===id?'active':''}"><span>${ic}</span>${label}</button>`).join('');
 $('desktopNav').innerHTML=links;$('mobileNav').innerHTML=links;
 $('accountBadge').innerHTML=state.self?`<div class="row"><span class="badge">${esc(memberNo(state.self.member?.member_no)||'PENDING')} \u00b7 ${esc(state.self.member?.callsign||state.self.email)}</span><button class="btn gray small" data-act="logout">Keluar</button></div>`:'';}
function renderAuth(){state.self=null;renderNav();$('pageTitle').textContent='Welcome to PZC';
 const sign=state.authMode==='signup';
 $('screen').innerHTML=`<section class="panel hero auth"><div class="kicker">ONE MEMBER \u00b7 MANY JOURNEYS</div><h2>${esc(window.ZTG_CONFIG.clubName)}</h2><p class="muted">Login ahli diperlukan untuk Crew Hub v2.0. Akaun lama GitHub/ChatGPT tidak digunakan secara automatik.</p>
 <div class="actions"><button class="btn ${sign?'alt':''}" data-act="authMode" data-id="login">Log Masuk</button><button class="btn ${sign?'':'alt'}" data-act="authMode" data-id="signup">Daftar Akaun</button></div><hr>
 <form data-form="auth"><label>Emel</label><input type="email" name="email" required autocomplete="email"><label>Kata laluan</label><input type="password" name="password" minlength="6" required autocomplete="${sign?'new-password':'current-password'}">
 <button class="btn" type="submit">${sign?'Cipta Akaun & Sahkan Emel':'Masuk ke Ride Hub'}</button></form>
 <p class="muted small">${sign?'Pautan pengesahan akan dihantar ke emel. Selepas sah, kembali dan log masuk.':'Belum ada akaun? Tekan Daftar Akaun. Jika lupa kata laluan, pilih Reset Password.'}</p>
 <button class="btn alt" data-act="resetPassword">Reset Password</button>
 <hr><a href="https://matjeri99.github.io/Ride_ZTGPutrajaya/" target="_blank" rel="noopener">Buka Ride Hub v1.0 (legacy)</a></section>`;
}
function renderVerify(message){$('screen').innerHTML=`<section class="panel auth"><h2>\u2709 Sahkan emel dahulu</h2><p>${esc(message)}</p><button class="btn" data-act="sendVerify">Hantar semula emel pengesahan</button><button class="btn alt" data-act="logout">Kembali login</button></section>`;}
function currentRole(){return state.self?.member?.role||'GUEST';}
function isAdmin(){return ['SUPERADMIN','ADMIN'].includes(currentRole())}
function isApproved(){return state.self?.member?.status==='APPROVED'}
async function go(view){state.view=view;renderNav();$('pageTitle').textContent=MENU.find(m=>m[0]===view)?.[2]||'PZC Ride Hub';
 if(!state.self)return renderAuth();
 if(!isApproved()&&view!=='home'&&view!=='profile'){toast('Lengkapkan pendaftaran ahli dan tunggu kelulusan.');view='home';state.view=view;renderNav();}
 busy();try{
 if(view==='home')await home();else if(view==='events')await events();else if(view==='event')await eventDetail(state.event?.id);
 else if(view==='members')await members();else if(view==='spot')spot();else if(view==='profile')await profile();
 else if(view==='gallery')await mediaAlbums();else if(view==='chat')await chat();else if(view==='admin')await admin();else if(view==='adminEvent')await adminEvent(state.event?.id);
 else if(view==='adminRoster')await adminRoster(state.event?.id);else if(view==='adminOrders')await adminOrders(state.event?.id);
 else await home();
 }catch(e){$('screen').innerHTML=`<div class="panel"><h3>Operasi tidak berjaya</h3><p>${esc(e.message)}</p><button class="btn" data-act="nav" data-id="home">Home</button></div>`;toast(e.message);}}
async function home(){const self=state.self.member;
 if(!self){$('screen').innerHTML=`<div class="panel hero"><div class="kicker">WELCOME, CREW</div><h2>Daftar Profil Ahli</h2><p class="muted">Emel akaun sudah disahkan. Lengkapkan profil untuk memohon nombor ahli Putrajaya Zontes Community.</p></div>${registrationForm()}`;return;}
 if(self.status!=='APPROVED'){$('screen').innerHTML=`<div class="panel hero"><div class="kicker">STATUS KEAHLIAN</div><h2>${esc(self.callsign)}</h2><p>Permohonan anda: <span class="badge pending">${esc(self.status)}</span></p><p class="muted">Admin akan menilai permohonan. Nombor keahlian diberikan selepas kelulusan.</p><button class="btn alt" data-act="refresh">Semak Semula</button></div>`;return;}
 const [evt,prof]=await Promise.all([api('events'),api('profile')]);state.events=evt;state.profile=prof;
 const upcoming=evt.filter(e=>['PUBLISHED','IN_PROGRESS'].includes(e.status)).slice(0,4);
 $('screen').innerHTML=`<section class="panel hero"><div class="kicker">PUTRAJAYA ZONTES COMMUNITY \u00b7 MEMBER ${esc(memberNo(self.member_no))}</div>
 <h2>Salam, ${esc(self.callsign)}! \ud83c\udfcd\ufe0f</h2><p class="muted">Satu identiti kekal. Banyak ride, TTS, dinner dan kenangan.</p>
 <div class="actions"><button class="btn" data-act="nav" data-id="events">Jelajah Events</button><button class="btn alt" data-act="nav" data-id="spot">SPOT ME!!</button><button class="btn gray" data-act="nav" data-id="profile">Kad Ahli</button></div></section>
 <div class="stats"><div class="stat"><strong>${evt.length}</strong><small>Events</small></div><div class="stat"><strong>${prof.registrations.filter(x=>x.status==='CONFIRMED').length}</strong><small>My Activities</small></div><div class="stat"><strong>${prof.motorcycles.length}</strong><small>My Motorcycles</small></div><div class="stat"><strong>${esc(memberNo(self.member_no))}</strong><small>Permanent Member No.</small></div></div>
 <h2 style="margin-top:23px">Upcoming & Active</h2>${upcoming.length?`<div class="grid">${upcoming.map(eventCard).join('')}</div>`:'<div class="empty">Belum ada event aktif. Tunggu pengumuman Captain!</div>'}
 <section class="panel"><b>\u2705 Pengumuman</b><p class="muted">Chat komuniti masih tersedia, tetapi WhatsApp kekal saluran perbualan utama. Semua event rasmi diurus melalui Ride Hub.</p></section>`;
}
function registrationForm(){return `<section class="panel"><h2>New Member Registration</h2><form data-form="register">
 <div class="formgrid"><div class="field"><label>Callsign *</label><input name="callsign" required maxlength="42" placeholder="Contoh: ASRI"></div><div class="field"><label>Nama penuh *</label><input name="full_name" required maxlength="120"></div>
 <div class="field"><label>WhatsApp / Telefon *</label><input name="phone" required placeholder="+60123456789"></div><div class="field"><label>Nombor plat *</label><input name="plate" required placeholder="WXX1234"></div>
 <div class="field"><label>Model Zontes *</label><input name="model" required placeholder="Zontes 368G"></div><div class="field"><label>Saiz baju rider</label><select name="size_rider">${sizes()}</select></div><div class="field"><label>Saiz baju pillion</label><select name="size_pillion">${sizes()}</select></div></div>
  ${memberExtraFields({})}
  <div class="field"><label><input type="checkbox" name="directory_optin"> Benarkan nama, callsign, nombor ahli dan motosikal dipaparkan dalam direktori ahli</label></div>
 <div class="field"><label><input type="checkbox" name="spot_optin"> Benarkan ahli berdaftar mencari kad saya melalui nombor plat (SPOT ME!!)</label></div>
 <div class="field"><label><input type="checkbox" name="sayhi_optin"> Benarkan ahli memperoleh pautan WhatsApp saya melalui SAY HI!! (nombor saya boleh dilihat dalam pautan WhatsApp)</label></div>
 <p class="muted small">Data digunakan untuk pengurusan keahlian dan acara Putrajaya Zontes Community. Lesen/No KP tidak dikumpul melalui borang ini.</p>
 <button class="btn" type="submit">Hantar Permohonan Ahli</button></form></section>`;}
const ALL_SIZES=['ONE-SIZE','XS','S','M','L','XL','2XL','3XL','4XL','5XL','6XL'];
function sizes(list){const opts=list&&list.length?list:ALL_SIZES;return `<option value="">\u2014</option>${opts.map(x=>`<option>${esc(x)}</option>`).join('')}`;}
function memberNo(v){
 const s=String(v==null?'':v).trim();
 if(!s)return '';
 const match=s.match(/^(?:PZC[- ]?)?(\d{1,})$/i);
 return match?'PZC'+match[1].padStart(3,'0'):s;
}
function licenseOpts(value){const opts=[['NOT_DECLARED','Belum diisytiharkan'],['VALID','Saya mengisytiharkan lesen memandu sah'],['NOT_VALID','Lesen belum / tidak sah']];return opts.map(([v,label])=>`<option value="${v}" ${v===value?'selected':''}>${label}</option>`).join('');}
function memberExtraFields(m){m=m||{};return `<div class="panel" style="margin:12px 0"><h3>Butiran Perhubungan & Kawasan</h3><div class="formgrid">
 <div class="field"><label>Kawasan aktif (TTS / Ride) *</label><input name="activity_area" required maxlength="80" value="${esc(m.activity_area||'')}" placeholder="Putrajaya / Bangi"></div>
 <div class="field"><label>Bandar tempat tinggal *</label><input name="residential_city" required maxlength="80" value="${esc(m.residential_city||'')}" placeholder="Cyberjaya"></div>
 <div class="field"><label>Negeri *</label><select name="residential_state" required><option value="">— Pilih Negeri —</option>${['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis','Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','W.P. Kuala Lumpur','W.P. Putrajaya','W.P. Labuan'].map(x=>`<option value="${esc(x)}" ${x===m.residential_state?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
 <div class="field"><label>Poskod (pilihan)</label><input name="postcode" maxlength="5" inputmode="numeric" pattern="[0-9]{5}" value="${esc(m.postcode||'')}" placeholder="62000"></div></div>
 <div class="field"><label>Alamat surat-menyurat (pilihan · admin sahaja)</label><textarea name="mailing_address" maxlength="500" placeholder="Untuk urusan rasmi sahaja">${esc(m.mailing_address||'')}</textarea></div>
 <h3>Keselamatan & Pillion</h3><div class="formgrid">
 <div class="field"><label>Nama kontak kecemasan (pilihan)</label><input name="emergency_name" maxlength="120" value="${esc(m.emergency_name||'')}"></div>
 <div class="field"><label>Telefon kontak kecemasan (pilihan)</label><input name="emergency_phone" type="tel" maxlength="17" value="${esc(m.emergency_phone||'')}" placeholder="+60123456789"></div>
 <div class="field"><label>Pengisytiharan lesen (bukan verifikasi rasmi)</label><select name="license_declaration">${licenseOpts(m.license_declaration||'NOT_DECLARED')}</select></div>
 <div class="field"><label>Nama pillion biasa (pilihan)</label><input name="pillion_name" maxlength="120" value="${esc(m.pillion_name||'')}"></div></div>
 <p class="small muted">Alamat dan kontak kecemasan hanya untuk pemilik profil serta pentadbir yang dibenarkan. Tidak dipaparkan dalam Members, SPOT ME!! atau SAY HI!!.</p></div>`;}
function itemSizes(item){return String(item?.sizes||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);}
function eventCard(e){return `<article class="panel eventCard"><div class="row between"><span class="badge">${esc(e.type)}</span><span class="badge ${e.status==='PUBLISHED'?'':'pending'}">${esc(e.status)}</span></div><h3>${esc(e.title)}</h3><div class="small muted">\ud83d\udcc5 ${esc(shortDate(e.start_date))}</div><div class="small muted">\ud83d\udccd ${esc(e.rv||'-')}</div><div class="small">${Number(e.confirmed)||0} peserta \u2022 ${Number(e.pax)||0} pax \u2022 Kuota ${esc(e.capacity)}</div>
 <div class="actions"><button class="btn" data-act="event" data-id="${esc(e.id)}">Lihat Event</button></div></article>`;}
async function events(){const all=await api('events');state.events=all;$('screen').innerHTML=`<div class="panel hero"><div class="kicker">MULTI-EVENT MANAGEMENT</div><h2>Many Journeys, One Crew</h2><p class="muted">Ride, dinner, TTS, merchandise dan aktiviti komuniti semuanya dalam satu hub.</p></div>
 ${all.length?`<div class="grid">${all.map(eventCard).join('')}</div>`:'<div class="empty">Tiada event lagi.</div>'}`;}
async function eventDetail(id){if(!id)return events();const d=await api('event',{id});state.event=d.event;
 const e=d.event,p=state.profile||await api('profile');state.profile=p;
 const active=e.status==='PUBLISHED';const isRide=e.type==='RIDE';const isMerch=e.type==='MERCH';
 const cars=p.motorcycles||[];
 $('screen').innerHTML=`<div class="panel hero"><div class="kicker">${esc(e.type)} \u00b7 ${esc(e.status)}</div><h2>${esc(e.title)}</h2><p>${esc(e.description||'')}</p>
 <div class="row"><span class="badge">\ud83d\udcc5 ${esc(shortDate(e.start_date))}</span><span class="badge">\ud83d\udccd ${esc(e.rv||'RV belum dimaklumkan')}</span></div>
 <div class="stats" style="margin-top:17px"><div class="stat"><strong>${d.registered}</strong><small>Registered</small></div><div class="stat"><strong>${d.pax}</strong><small>Total Pax</small></div><div class="stat"><strong>${esc(e.capacity)}</strong><small>Capacity</small></div></div></div>
 ${d.staff.length?`<div class="panel"><h3>Convoy / Event Team</h3><div class="grid">${d.staff.map(x=>`<div class="rider"><span class="badge">${esc(x.duty)}</span><div class="callsign">${esc(x.member?.callsign||'?')}</div></div>`).join('')}</div></div>`:''}
 ${e.itinerary?`<div class="panel"><h3>\ud83d\udccd Itinerary & Checkpoints</h3><div class="safety">${esc(e.itinerary)}</div></div>`:''}
 ${isRide?`<section class="panel"><h3>\ud83d\udee1 Ride Safety Briefing</h3><div class="safety">${esc(e.safety_brief||'Ikut arahan RC, jaga jarak selamat, patuhi had laju dan elakkan memotong secara berbahaya.')}</div>
 ${d.own&&d.own.status==='CONFIRMED'?`<p class="small">Pledge: <b>${d.own.pledge_at?'Disahkan '+esc(shortDate(d.own.pledge_at)):'Belum disahkan'}</b></p>
 <button class="btn" data-act="pledge" data-id="${esc(e.id)}" ${d.own.pledge_at?'disabled':''}>\u2713 Saya Baca, Faham & Setuju</button>`:'<p class="muted small">Daftar ride untuk mengesahkan Safety Pledge.</p>'}</section>`:''}
 ${isMerch?renderMerchDetail(e,d):renderEventJoin(e,d,cars,active)}
 ${d.roster.length?`<section class="panel"><h3>Rider / Participant Manifest</h3><div class="grid">${d.roster.map(r=>`<div class="rider"><div class="callsign">${esc(r.callsign)}</div><div class="small muted">Member ${esc(memberNo(r.member_no))}</div>${r.plate?`<span class="plate">${esc(r.plate)}</span>`:''}<div class="small muted">Pillion: ${esc(r.pillion)}</div></div>`).join('')}</div></section>`:''}
 <button class="btn gray" data-act="nav" data-id="events">\u2190 Semua Events</button>`;
 void mediaAddEventShortcuts(d);
}
function renderEventJoin(e,d,cars,active){if(d.own&&d.own.status==='CONFIRMED')return `<div class="panel"><span class="badge">\u2713 Anda telah mendaftar</span><p class="muted">Pendaftaran anda disahkan.</p>
 <button class="btn red" data-act="leave" data-id="${esc(e.id)}">Batalkan Penyertaan</button></div>`;
 if(!active)return `<div class="panel notice">Pendaftaran event belum / tidak lagi dibuka.</div>`;
 return `<section class="panel"><h3>Join This Event</h3><form data-form="join"><input type="hidden" name="event_id" value="${esc(e.id)}">
 ${e.type==='RIDE'?`<div class="field"><label>Motosikal</label><select name="motorcycle_id" required>${cars.map(c=>`<option value="${esc(c.id)}">${esc(c.plate)} \u00b7 ${esc(c.model)}</option>`).join('')}</select></div>`:''}
 <div class="field"><label>Bilangan Pillion / Tetamu</label><input name="pillion_count" type="number" value="0" min="0" max="${e.type==='RIDE'?'2':'10'}"></div>
 <button class="btn" type="submit">Sahkan Penyertaan</button></form></section>`;}
function renderMerchDetail(e,d){const items=d.merch||[],open=e.status==='PUBLISHED';state.merchItems=items;return `<section class="panel"><h3>Order Merchandise</h3>
 ${items.length?`<div class="grid">${items.map(x=>`<div class="rider"><div data-product-photo="${esc(x.id)}"></div><h3>${esc(x.name)}</h3><div class="big">${esc(fmt(x.price))}</div><p class="small muted">Available Sizes: ${esc(x.sizes||'Semua')}</p></div>`).join('')}</div>`:'<p class="muted">Item belum ditambah admin.</p>'}
 ${open&&items.length?`<form data-form="orderMerch"><input type="hidden" name="event_id" value="${esc(e.id)}"><div class="formgrid"><div class="field"><label>Item</label><select name="item_id">${items.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} \u00b7 ${fmt(x.price)}</option>`).join('')}</select></div><div class="field"><label>Saiz</label><select name="size" required>${sizes(itemSizes(items[0]))}</select></div><div class="field"><label>Kuantiti</label><input name="qty" type="number" min="1" max="20" value="1"></div></div><button class="btn" type="submit">Hantar Tempahan</button></form>`:'<p class="muted">Tempahan belum dibuka.</p>'}</section>`;}
async function members(){const data=await api('directory');state.members=data;
 $('screen').innerHTML=`<div class="panel hero"><div class="kicker">ONE MEMBER \u00b7 ONE PERMANENT ID</div><h2>Crew Directory</h2><p class="muted">Direktori hanya memaparkan ahli yang bersetuju. Nombor telefon tidak ditunjukkan.</p><input id="memberFilter" placeholder="Cari callsign / nombor ahli / plat motosikal"></div><div id="memberResults" class="grid"></div>`;
 drawMemberResults();}
function drawMemberResults(){const target=$('memberResults');if(!target)return;const q=($('memberFilter')?.value||'').toUpperCase().replace(/\s/g,'');
const arr=state.members.filter(m=>[m.callsign,m.full_name,m.member_no,m.activity_area,...m.vehicles.map(v=>v.plate)].join('').toUpperCase().replace(/\s/g,'').includes(q)).slice(0,150);

 target.innerHTML=arr.length?arr.map(m=>`<div class="rider"><span class="badge">NO. ${esc(memberNo(m.member_no))}</span><div class="callsign">${esc(m.callsign)}</div><div class="name">${esc(m.full_name)}</div>
 ${m.activity_area?`<div class="small muted">📍 Kawasan aktif: ${esc(m.activity_area)}</div>`:''}
 ${m.vehicles.map(v=>`<div>${v.plate?`<span class="plate">${esc(v.plate)}</span>`:''}<span class="small muted"> ${esc(v.model)}</span></div>`).join('')}</div>`).join(''):'<div class="empty">Tiada padanan.</div>';}
function spot(){state.found=null;$('screen').innerHTML=`<section class="panel hero"><div class="kicker">PZC CREW CONNECT</div><h2>SPOT ME!! \u25ce</h2><p>Nampak Zontes di R&R atau trafik light? Cari nombor plat selepas berhenti di tempat selamat.</p>
 <form data-form="spot"><div class="field"><label>Nombor Plat</label><input name="plate" required maxlength="16" placeholder="Contoh: WXX1234" autocomplete="off"></div><button class="btn" type="submit">\u25ce SPOT MEMBER</button></form>
 <p class="small muted">Hanya ahli yang aktifkan carian SPOT ME!! akan ditemui. Carian dihadkan untuk mengelakkan penyalahgunaan.</p></section><div id="spotResult"></div>`;}
function renderSpotCard(card){const node=$('spotResult');if(!node)return;
 if(!card){node.innerHTML='<div class="panel empty">Tiada ahli yang memilih untuk dipaparkan bagi nombor plat ini.</div>';return;}
 state.found=card;node.innerHTML=`<div class="panel"><div class="row between"><span class="kicker">\u2713 VERIFIED ZONTES CREW</span><span class="badge">MEMBER ${esc(memberNo(card.member_no))}</span></div>
 <div class="rider" style="margin-top:15px;text-align:center"><div class="callsign big">${esc(card.callsign)}</div><div class="name">${esc(card.full_name||'Nama tidak dipaparkan')}</div><div><span class="plate">${esc(card.plate)}</span></div>
<div class="muted small">${esc(card.model)}</div>
${card.activity_area?`<div class="small muted">📍 Kawasan aktif: ${esc(card.activity_area)}</div>`:''}
</div>
 <div class="actions">${card.sayhi_enabled?`<button class="btn" data-act="sayHi" data-id="${esc(card.id)}">\ud83d\udc4b SAY HI!!</button>`:'<span class="badge pending">SAY HI tidak diaktifkan pemilik</span>'}</div>
 <div id="hiResult"></div></div>`;}
 async function profile(){const p=await api('profile');state.profile=p;const m=p.member||{};
 $('screen').innerHTML=`<section class="panel hero"><div class="kicker">OFFICIAL DIGITAL MEMBER CARD</div><h2>${esc(m.callsign||'')}</h2><div class="muted">${esc(m.full_name||'')}</div>${m.activity_area?`<div class="small muted">📍 Kawasan aktif: ${esc(m.activity_area)}</div>`:''}<div class="stats" style="margin-top:20px"><div class="stat"><small>MEMBER NO.</small><strong>${esc(memberNo(m.member_no)||'\u2014')}</strong></div><div class="stat"><small>STATUS</small><strong style="font-size:20px">${esc(m.status||'\u2014')}</strong></div></div>
 <div class="grid" style="margin-top:15px">${p.motorcycles.map(x=>`<div class="rider"><span class="plate">${esc(x.plate)}</span><div>${esc(x.model)}</div></div>`).join('')}</div></section>
 <section class="panel"><h3>Edit Profil</h3><form data-form="profile"><div class="formgrid"><div class="field"><label>Callsign</label><input name="callsign" required value="${esc(m.callsign)}"></div><div class="field"><label>Nama Penuh</label><input name="full_name" required value="${esc(m.full_name)}"></div><div class="field"><label>WhatsApp</label><input name="phone" required value="${esc(m.phone)}"></div><div class="field"><label>Saiz Rider</label><input name="size_rider" value="${esc(m.size_rider)}"></div><div class="field"><label>Saiz Pillion</label><input name="size_pillion" value="${esc(m.size_pillion)}"></div></div>
  ${memberExtraFields(m)}
 <div class="field"><label><input type="checkbox" name="directory_optin" ${m.directory_optin==='TRUE'?'checked':''}> Papar profil dalam direktori</label></div>
 <div class="field"><label><input type="checkbox" name="spot_optin" ${m.spot_optin==='TRUE'?'checked':''}> Aktifkan SPOT ME!!</label></div>
 <div class="field"><label><input type="checkbox" name="sayhi_optin" ${m.sayhi_optin==='TRUE'?'checked':''}> Benarkan pautan WhatsApp melalui SAY HI!!</label></div>
 <p class="small muted">Jika SAY HI!! diaktifkan, nombor WhatsApp boleh dikenal pasti oleh penerima pautan.</p><button class="btn" type="submit">Simpan Profil</button></form></section>
 <section class="panel"><h3>Tambah Motosikal</h3><form data-form="addMotorcycle"><div class="formgrid"><div class="field"><label>Nombor Plat</label><input name="plate" required></div><div class="field"><label>Model</label><input name="model" required></div></div><button type="submit" class="btn alt">+ Tambah Motosikal</button></form></section>`;}
async function chat(){const data=await api('chat');state.chat=data;
 $('screen').innerHTML=`<section class="panel hero"><div class="kicker">CREW COMMUNICATION</div><h2>Crew Chat v2.0</h2><p class="muted">Ruang komunikasi ringan; WhatsApp kekal untuk perbualan harian. Ini chat baharu tanpa mesej dari v1.</p></section>
 <section class="panel"><div id="chatList" class="chat">${data.length?data.map(x=>`<div class="bubble"><strong>${esc(x.callsign)}</strong><div>${esc(x.text)}</div><small>${esc(shortDate(x.at))}</small></div>`).join(''):'<p class="muted">Belum ada mesej.</p>'}</div><hr>
 <form data-form="chat"><div class="row"><input name="message" maxlength="500" placeholder="Salam Crew..." required style="flex:1"><button class="btn" type="submit">Send</button><button type="button" class="btn gray" data-act="refreshChat">\u21bb</button></div></form></section>`;const list=$('chatList');list.scrollTop=list.scrollHeight;}
// Server enforces access per event (admin or RC of that event); the client only requires an approved member.
function adminOnly(){if(!isApproved())throw Error('Akses hanya untuk ahli yang diluluskan.');}
async function admin(){adminOnly();if(!isAdmin()){const own=await api('captainEvents');$('screen').innerHTML=`<section class="panel hero"><div class="kicker">RIDE CAPTAIN CENTRE</div><h2>Captain Operations</h2><p class="muted">Urus event yang anda dilantik sebagai RC.</p></section>${own.length?'':'<div class="empty">Anda belum dilantik sebagai RC untuk mana-mana event.</div>'}<div class="grid">${own.map(e=>`<article class="panel"><h3>${esc(e.title)}</h3><div class="small muted">${esc(shortDate(e.start_date))} \u00b7 ${esc(e.status)}</div><div class="actions"><button class="btn" data-act="editEvent" data-id="${esc(e.id)}">Edit Event</button><button class="btn alt" data-act="roster" data-id="${esc(e.id)}">Manifest</button></div></article>`).join('')}</div>`;return;}const [sum,members,eventsData]=await Promise.all([api('summary'),api('adminMembers'),api('events')]);state.members=members;state.events=eventsData;
 $('screen').innerHTML=`<section class="panel hero"><div class="kicker">ADMIN CONTROL CENTRE</div><h2>Zero Coding Operations</h2><p class="muted">Urus event, keahlian, tempahan, petugas, dokumen dan laporan terus dalam Hub.</p></section>
 <div class="stats"><div class="stat"><strong>${sum.approved}</strong><small>Active Members</small></div><div class="stat"><strong>${sum.pending}</strong><small>Pending Approval</small></div><div class="stat"><strong>${sum.events}</strong><small>Events</small></div><div class="stat"><strong>${sum.orders}</strong><small>Merch Orders</small></div></div>
 <section class="panel"><div class="row between"><h2>Member Applications</h2><span class="badge">${sum.pending} pending</span></div><div class="tablewrap"><table><thead><tr><th>Callsign</th><th>Nama / Emel</th><th>Plat</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
 ${members.map(m=>`<tr><td><b>${esc(m.callsign)}</b><div class="small muted">${esc(memberNo(m.member_no)||'Belum ada No')}</div></td><td>${esc(m.full_name)}<div class="small muted">${esc(m.email)}</div></td><td>${esc(m.plate)}</td><td>${esc(m.status)}</td><td>${m.status==='PENDING'?`<button class="btn" data-act="approve" data-id="${esc(m.id)}">Approve</button><button class="btn red" data-act="reject" data-id="${esc(m.id)}">Reject</button>`:currentRole()==='SUPERADMIN'?`<select data-role-id="${esc(m.id)}">${['MEMBER','CAPTAIN','ADMIN','SUPERADMIN'].map(r=>`<option ${r===m.role?'selected':''}>${r}</option>`).join('')}</select>`:'\u2014'}<button class="btn gray" data-act="editMember" data-id="${esc(m.id)}">Edit</button><button class="btn alt" data-act="memberDetail" data-id="${esc(m.id)}">Butiran</button></td></tr>`).join('')}</tbody></table></div></section>
 <section class="panel"><h2>Events & Operations</h2><button class="btn" data-act="newEvent">+ Create New Event</button><div class="tablewrap"><table><thead><tr><th>Event</th><th>Tarikh</th><th>Status</th><th>Actions</th></tr></thead><tbody>${eventsData.map(x=>`<tr><td>${esc(x.title)}<div class="small muted">${esc(x.type)}</div></td><td>${esc(shortDate(x.start_date))}</td><td>${esc(x.status)}</td><td><div class="row"><button class="btn gray" data-act="editEvent" data-id="${esc(x.id)}">Edit</button><button class="btn alt" data-act="roster" data-id="${esc(x.id)}">Manifest</button>${x.type==='MERCH'?`<button class="btn alt" data-act="orders" data-id="${esc(x.id)}">Orders</button>`:''}</div></td></tr>`).join('')}</tbody></table></div></section>
 ${currentRole()==='SUPERADMIN'?`<section class="panel"><h3>Reset Crew Chat v2.0</h3><p class="small muted">Hanya chat baharu v2.0 dipadam. Tidak menyentuh chat Firebase v1.0. Backup dahulu.</p><button class="btn red" data-act="resetChat">Reset Chat v2.0</button></section>`:''}`;
}
function eventFields(e={}){return `<div class="formgrid"><div class="field"><label>Jenis event</label><select name="type">${['RIDE','TTS','DINNER','COMMUNITY','MERCH'].map(x=>`<option ${x===e.type?'selected':''}>${x}</option>`).join('')}</select></div>
 <div class="field"><label>Event Title *</label><input name="title" required value="${esc(e.title||'')}"></div>
 <div class="field"><label>Mula (YYYY-MM-DD)</label><input name="start_date" type="datetime-local" required value="${esc(e.start_date||'')}"></div>
 <div class="field"><label>Tamat</label><input name="end_date" type="datetime-local" value="${esc(e.end_date||'')}"></div>
 <div class="field"><label>RV / Lokasi</label><input name="rv" value="${esc(e.rv||'')}"></div>
 <div class="field"><label>Kuota peserta / motosikal</label><input type="number" name="capacity" min="1" max="1000" value="${esc(e.capacity||50)}"></div>
 <div class="field"><label>Masa berkumpul</label><input name="meet_time" value="${esc(e.meet_time||'')}"></div>
 <div class="field"><label>Status</label><select name="status">${['DRAFT','PUBLISHED','CLOSED','IN_PROGRESS','COMPLETED','ARCHIVED','CANCELLED'].map(x=>`<option ${x===(e.status||'DRAFT')?'selected':''}>${x}</option>`).join('')}</select></div></div>
 <div class="field"><label>Deskripsi</label><textarea name="description">${esc(e.description||'')}</textarea></div>
 <div class="field"><label>Itinerary / Checkpoints (satu baris satu checkpoint)</label><textarea name="itinerary">${esc(e.itinerary||'')}</textarea></div>
 <div class="field"><label>Ride Safety Briefing</label><textarea name="safety_brief">${esc(e.safety_brief||defaultBrief())}</textarea></div>
 <p class="small muted">Cover: selepas Save Draft, pergi ke Media Manager dan tekan Upload Cover Event. Tiada URL diperlukan.</p>`;}
function defaultBrief(){return '1. Safety First.\n2. Staggered formation 2\u20133 saat, tambah jarak jika hujan.\n3. Patuh had laju dan arahan RC.\n4. Susunan staggered pada jalan sesuai; single file di laluan sempit.\n5. Patuhi hand signal Marshal.\n6. No overtaking / mencilok secara bahaya.\n7. Intercom: komunikasi RC, Marshal, Media dan Sweeper diutamakan.';}
function renderNewEvent(){state.event=null;state.view='adminEvent';renderNav();$('pageTitle').textContent='Create New Event';
 $('screen').innerHTML=`<div class="panel hero"><div class="kicker">NO CODING REQUIRED</div><h2>Create New Event</h2><p class="muted">Simpan dahulu sebagai Draft. Publish melalui Edit setelah butiran disemak.</p></div>
 <section class="panel"><form data-form="createEvent">${eventFields({status:'DRAFT'})}<button class="btn" type="submit">Save Draft Event</button><button type="button" class="btn gray" data-act="nav" data-id="admin">Cancel</button></form></section>`;}
async function adminEvent(id){adminOnly();if(!id)return renderNewEvent();const d=await api('event',{id});state.event=d.event;const e=d.event;
 const canManage=isAdmin()||d.staff.some(x=>x.duty==='RC'&&x.member?.id===state.self.member?.id);
 if(!canManage)throw Error('Tiada akses untuk edit event ini.');
 const staffOptions=await api('staffCandidates',{event_id:id});
 $('screen').innerHTML=`<section class="panel hero"><div class="kicker">MANAGE EVENT</div><h2>${esc(e.title)}</h2><p>Admin boleh kemas kini event terus di sini. Tiada coding untuk ride berikutnya.</p></section>
 <section class="panel"><form data-form="editEvent"><input type="hidden" name="id" value="${esc(e.id)}">${eventFields(e)}<button class="btn" type="submit">Simpan Perubahan</button></form></section>
 <section class="panel"><h3>Assign Crew Duties</h3><form data-form="staff"><input type="hidden" name="event_id" value="${esc(e.id)}"><div class="formgrid"><div class="field"><label>Member</label><select name="member_id">${staffOptions.map(m=>`<option value="${esc(m.id)}">${esc(m.member_no)} \u2014 ${esc(m.callsign)}</option>`).join('')}</select></div>
 <div class="field"><label>Duty</label><select name="duty">${isAdmin()?'<option>RC</option>':''}<option>MARSHAL</option><option>MEDIA</option><option>SWEEPER</option></select></div></div><button class="btn alt" type="submit">Assign Staff</button></form></section>
 ${e.type==='MERCH'?`<section class="panel"><h3>Add Merchandise Item</h3><form data-form="merchItem"><input type="hidden" name="event_id" value="${esc(e.id)}"><div class="formgrid"><div class="field"><label>Item name</label><input name="name" required placeholder="Tshirt Ultron SS"></div><div class="field"><label>Harga RM</label><input name="price" type="number" min="0" step="0.01" required></div><div class="field"><label>Saiz dipisahkan dengan koma</label><input name="sizes" placeholder="S,M,L,XL,2XL,3XL"></div></div><button class="btn alt" type="submit">Tambah Item</button></form></section>`:''}
 <button class="btn gray" data-act="nav" data-id="admin">\u2190 Admin Centre</button>`;
 void mediaAdminManager(e);}
async function adminRoster(id){adminOnly();const [detail,roster]=await Promise.all([api('event',{id}),api('adminRegistrations',{event_id:id})]);state.event=detail.event;state.roster=roster;
 $('screen').innerHTML=`<section class="panel hero"><div class="kicker">OPERATIONS \u00b7 MANIFEST</div><h2>${esc(detail.event.title)}</h2><p>${roster.filter(x=>x.status==='CONFIRMED').length} confirmed \u00b7 ${roster.filter(x=>x.pledge_at).length} pledges</p>
 <div class="actions"><button class="btn" data-act="exportCsv" data-id="${esc(id)}">\u2193 Excel-compatible CSV</button><button class="btn alt" data-act="exportPdf" data-id="${esc(id)}">\u2193 PDF Manifest</button></div></section>
 <section class="panel"><h3>Attendance & Pledge</h3><div class="tablewrap"><table><thead><tr><th>Ahli</th><th>Nama</th><th>Plat</th><th>RSVP</th><th>Pledge</th><th>Kehadiran</th></tr></thead><tbody>${roster.map(r=>`<tr><td>${esc(r.member_no)} ${esc(r.callsign)}</td><td>${esc(r.name)}</td><td>${esc(r.plate)}</td><td><select data-reg-id="${esc(r.id)}"><option ${r.status==='CONFIRMED'?'selected':''}>CONFIRMED</option><option ${r.status==='TENTATIVE'?'selected':''}>TENTATIVE</option><option ${r.status==='CANCELLED'?'selected':''}>CANCELLED</option></select></td><td>${r.pledge_at?'\u2713':'\u2014'}</td><td><select data-attendance-id="${esc(r.id)}"><option ${r.attendance==='NOT_CHECKED'?'selected':''}>NOT_CHECKED</option><option ${r.attendance==='PRESENT'?'selected':''}>PRESENT</option><option ${r.attendance==='ABSENT'?'selected':''}>ABSENT</option></select></td></tr>`).join('')}</tbody></table></div></section>
 <section class="panel"><h3>Tambah Peserta (Manual Admin / RC)</h3><form data-form="adminAddRegistration"><input type="hidden" name="event_id" value="${esc(id)}"><div class="formgrid"><div class="field"><label>Ahli</label><select name="member_id" id="rosterMemberSelector">${(await api('staffCandidates',{event_id:id})).map(m=>`<option value="${esc(m.id)}">${esc(m.member_no)} \u2014 ${esc(m.callsign)}</option>`).join('')}</select></div><div class="field"><label>Pillion / Tetamu</label><input type="number" name="pillion_count" min="0" max="10" value="0"></div><div class="field"><label>Status</label><select name="status"><option>CONFIRMED</option><option>TENTATIVE</option><option>CANCELLED</option></select></div></div><button type="submit" class="btn">Tambah / Kemas Kini Peserta</button></form></section>
 <section class="panel"><h3>Lampiran PDRM (Jika benar-benar diminta)</h3><p class="notice">No. kad pengenalan hanya diproses dalam pelayar dan <b>tidak dihantar ke server atau disimpan dalam Sheets/Drive</b>. Gunakan Print \u2192 Save as PDF. Pastikan tujuan rasmi dan persetujuan peserta. Dokumen ini bukan permit polis.</p>
 <form data-form="policePdf"><input type="hidden" name="event_id" value="${esc(id)}"><div class="tablewrap"><table><thead><tr><th>Ahli</th><th>Nama</th><th>IC (optional)</th></tr></thead><tbody>${roster.filter(x=>x.status==='CONFIRMED').map(r=>`<tr><td>${esc(r.member_no)} ${esc(r.callsign)}</td><td>${esc(r.name)}</td><td><input data-ic-member="${esc(r.member_id)}" inputmode="numeric" maxlength="14" placeholder="12 digit (jika diminta)"></td></tr>`).join('')}</tbody></table></div>
 <label><input type="checkbox" name="consent_confirmed" required> Saya sahkan keperluan rasmi dan persetujuan pemilik data</label><button type="submit" class="btn">Generate PDF PDRM Attachment</button></form></section>
 <button class="btn gray" data-act="nav" data-id="admin">\u2190 Admin Centre</button>`;}
async function adminOrders(id){adminOnly();const [details,data]=await Promise.all([api('event',{id}),api('adminOrders',{event_id:id})]);state.event=details.event;state.orders=data;
 $('screen').innerHTML=`<div class="panel hero"><div class="kicker">MERCHANDISE OPERATIONS</div><h2>${esc(details.event.title)}</h2><p>${data.length} tempahan</p><button class="btn" data-act="exportMerch" data-id="${esc(id)}">\u2193 Download Laporan Tempahan CSV</button></div>
 <section class="panel"><div class="tablewrap"><table><thead><tr><th>Ahli</th><th>Item</th><th>Saiz</th><th>Qty</th><th>Total</th><th>Payment</th><th>Delivery</th></tr></thead><tbody>${data.map(o=>`<tr><td>${esc(o.member_no)} ${esc(o.callsign)}</td><td>${esc(o.item)}</td><td>${esc(o.size)}</td><td>${esc(o.qty)}</td><td>${fmt(o.total)}</td>
 <td><select data-order-id="${esc(o.id)}" data-field="payment_status">${['UNPAID','PAID','REFUNDED'].map(x=>`<option ${x===o.payment_status?'selected':''}>${x}</option>`).join('')}</select></td>
 <td><select data-order-id="${esc(o.id)}" data-field="delivery_status">${['PENDING','READY','COLLECTED'].map(x=>`<option ${x===o.delivery_status?'selected':''}>${x}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></section><button class="btn gray" data-act="nav" data-id="admin">\u2190 Admin Centre</button>`;}
function download(file,content,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file;a.click();setTimeout(()=>URL.revokeObjectURL(url),8000);}
function downloadPdf(out){const binary=atob(out.base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);download(out.filename,bytes,out.mime);}
async function handleAction(button){const a=button.dataset.act,id=button.dataset.id;
 if(a.startsWith('media'))return mediaAction(a,id);
 if(a==='nav')return go(id);
 if(a==='logout'){clearSession();return renderAuth();}
 if(a==='authMode'){state.authMode=id;return renderAuth();}
 if(a==='refresh')return afterLogin();
 if(a==='resetPassword'){const email=prompt('Emel akaun untuk Reset Password:');if(email){await authRequest('accounts:sendOobCode',{requestType:'PASSWORD_RESET',email});toast('Jika akaun wujud, semak emel untuk reset password.');}return;}
 if(a==='sendVerify'){await authRequest('accounts:sendOobCode',{requestType:'VERIFY_EMAIL',idToken:state.idToken});toast('Emel pengesahan dihantar.');return;}
 if(a==='event'){state.event={id};return go('event');}
 if(a==='leave'){if(confirm('Batalkan penyertaan event ini?')){await api('leaveEvent',{event_id:id});return go('event');}return;}
 if(a==='pledge'){if(confirm('Saya telah membaca, memahami dan bersetuju mematuhi arahan keselamatan ride.')){await api('pledge',{event_id:id,agree:true});toast('Pledge direkodkan.');return go('event');}return;}
 if(a==='sayHi'){const result=await api('sayHi',{member_id:id});$('hiResult').innerHTML=`<div class="notice success"><b>WhatsApp tersedia.</b> Klik pautan di bawah untuk membuka mesej. Nombor penerima akan kelihatan di WhatsApp.<p><a href="${esc(result.url)}" target="_blank" rel="noopener noreferrer">\ud83d\udc4b Buka WhatsApp & SAY HI!!</a></p></div>`;return;}
 if(a==='refreshChat')return chat();
 if(a==='approve'||a==='reject'){if(!confirm(a==='approve'?'Luluskan pendaftaran ahli ini?':'Tolak permohonan ini?'))return;
  const o=await api('adminApprove',{member_id:id,approve:a==='approve'});toast(o.member_no?'Ahli diluluskan: '+o.member_no:'Status dikemas kini');return admin();}
  if(a==='memberDetail'){
   const d=await api('adminMemberDetail',{member_id:id}),m=d.member;
   const fields=[['No. Ahli',memberNo(m.member_no)],['Callsign',m.callsign],['Nama penuh',m.full_name],
    ['Emel',m.email],['WhatsApp',m.phone],['Kawasan aktif',m.activity_area],['Bandar',m.residential_city],
    ['Negeri',m.residential_state],['Poskod',m.postcode],['Alamat',m.mailing_address],
    ['Kontak kecemasan',m.emergency_name],['Telefon kecemasan',m.emergency_phone],
    ['Status lesen (pengisytiharan)',m.license_declaration],['Pillion',m.pillion_name],
    ['Saiz baju rider',m.size_rider],['Saiz baju pillion',m.size_pillion]];
   $('pageTitle').textContent='Butiran Ahli (Admin)';
   $('screen').innerHTML=`<div class="panel hero"><div class="kicker">ADMIN ONLY · PRIVATE MEMBER PROFILE</div><h2>${esc(m.callsign)}</h2><p class="muted">Maklumat terhad untuk urusan kelab sahaja.</p></div><div class="panel"><div class="formgrid">${fields.map(([k,v])=>`<div class="field"><label>${esc(k)}</label><div class="rider">${esc(v||'—')}</div></div>`).join('')}</div><h3>Motosikal</h3>${d.motorcycles.map(v=>`<p>${esc(v.plate)} · ${esc(v.model)}</p>`).join('')||'<p>Tiada motosikal</p>'}<button class="btn gray" data-act="nav" data-id="admin">← Kembali ke Admin</button></div>`;
   return;
  }
 if(a==='editMember'){const m=state.members.find(x=>x.id===id);if(!m)return;const callsign=prompt('Callsign',m.callsign);if(callsign===null)return;const full_name=prompt('Nama penuh',m.full_name);if(full_name===null)return;const phone=prompt('Telefon (format +60...)',m.phone);if(phone===null)return;await api('adminEditMember',{member_id:id,callsign,full_name,phone});toast('Profil ahli dikemaskini.');return admin();}
 if(a==='newEvent')return renderNewEvent();
 if(a==='editEvent'){state.event={id};return adminEvent(id);}
 if(a==='roster'){state.event={id};return adminRoster(id);}
 if(a==='orders'){state.event={id};return adminOrders(id);}
 if(a==='exportCsv'){const out=await api('manifestCsv',{event_id:id});download(out.filename,out.csv,'text/csv;charset=utf-8');return toast('CSV dimuat turun.');}
 if(a==='exportMerch'){const out=await api('merchCsv',{event_id:id});download(out.filename,out.csv,'text/csv;charset=utf-8');return toast('Laporan merchandise dimuat turun.');}
 if(a==='exportPdf'){const out=await api('manifestPdf',{event_id:id});downloadPdf(out);return toast('PDF manifest dimuat turun.');}
 if(a==='resetChat'){const code=prompt('Taip RESET CHAT V2 untuk padam semua mesej chat v2.0 (bukan v1):');if(code){await api('resetChat',{confirm_text:code});toast('Chat v2.0 telah direset.');}return;}
}
function values(form){const obj=Object.fromEntries(new FormData(form).entries());form.querySelectorAll('input[type="checkbox"][name]').forEach(x=>obj[x.name]=x.checked);return obj;}
async function handleForm(form){const k=form.dataset.form,p=values(form);
 if(k==='mediaUpload'){await mediaUploadForm(form,p);return;}
 if(k==='auth'){await login(p.email,p.password,state.authMode==='signup');return;}
 if(k==='register'){await api('register',p);toast('Pendaftaran dihantar.');await afterLogin();return;}
 if(k==='profile'){await api('editProfile',p);toast('Profil disimpan.');return profile();}
 if(k==='addMotorcycle'){await api('addMotorcycle',p);toast('Motosikal ditambah.');return profile();}
 if(k==='join'){await api('joinEvent',p);toast('Pendaftaran berjaya.');return eventDetail(p.event_id);}
 if(k==='orderMerch'){await api('merchOrder',p);toast('Tempahan diterima.');return eventDetail(p.event_id);}
 if(k==='spot'){const x=await api('spot',p);return renderSpotCard(x.found?x.card:null);}
 if(k==='chat'){await api('postChat',p);return chat();}
 if(k==='createEvent'){const out=await api('adminNewEvent',p);state.event={id:out.id};
 try{await api('mediaEnsureFolders',{event_id:out.id});}catch(mediaError){console.warn('Folder media akan disediakan semasa upload',mediaError);}
 toast('Draft event diwujudkan.');return admin();}
 if(k==='editEvent'){await api('adminEditEvent',p);toast('Event dikemas kini.');return adminEvent(p.id);}
 if(k==='staff'){await api('adminStaff',p);toast('Petugas ditambah.');return adminEvent(p.event_id);}
 if(k==='adminAddRegistration'){await api('adminAddRegistration',p);toast('Manifest peserta dikemaskini.');return adminRoster(p.event_id);}
 if(k==='merchItem'){await api('adminNewMerchItem',p);toast('Item merchandise ditambah.');return adminEvent(p.event_id);}
 if(k==='policePdf'){
  if(!p.consent_confirmed)throw Error('Sahkan keperluan rasmi dan persetujuan peserta.');
  const ic_map={};form.querySelectorAll('[data-ic-member]').forEach(input=>{const val=input.value.trim().replace(/[\s-]/g,'');if(val&&!/^\d{12}$/.test(val))throw Error('No KP perlu 12 digit.');if(val)ic_map[input.dataset.icMember]=val;});
  const printWin=window.open('','_blank');if(!printWin)throw Error('Pop-up disekat. Benarkan pop-up untuk cetakan.');
  try{
   const out=await api('manifestPrintData',{event_id:p.event_id});
   const rows=out.rows.map(r=>`<tr><td>${esc(r.no)}</td><td>${esc(r.member_no)}</td><td>${esc(r.full_name)} (${esc(r.callsign)})</td><td>${esc(ic_map[r.member_id]||'\u2014')}</td><td>${esc(r.plate||'\u2014')}</td><td>${esc(r.pillion)}</td></tr>`).join('');
   const report=`<!DOCTYPE html><html lang="ms"><head><meta charset="utf-8"><title>Lampiran PDRM</title><style>body{font:12pt Arial;padding:24px;color:#111}h1{font-size:16pt;text-align:center}h2{font-size:13pt;text-align:center}table{border-collapse:collapse;width:100%;margin:15px 0}th,td{border:1px solid #555;padding:7px;font-size:9pt}p{line-height:1.5}.notice{font-weight:bold}button{padding:12px}@media print{button{display:none}body{margin:0;padding:0}}</style></head><body><button onclick="window.print()">Cetak / Save as PDF</button><h1>PUTRAJAYA ZONTES COMMUNITY</h1><h2>SENARAI PESERTA \u2014 LAMPIRAN URUSAN PDRM</h2><p>Event: ${esc(out.title)}<br>Tarikh: ${esc(out.start_date)}<br>RV: ${esc(out.rv)}</p><p class="notice">TERHAD \u00b7 Untuk urusan rasmi yang dimaklumkan sahaja. Dokumen ini BUKAN permit.</p><table><thead><tr><th>Bil</th><th>No Ahli</th><th>Nama / Callsign</th><th>No KP (jika dibekalkan)</th><th>Plat</th><th>Pillion</th></tr></thead><tbody>${rows}</tbody></table><p>Disahkan oleh: ____________________<br>Jawatan: ____________________<br>Tarikh: ____________________</p></body></html>`;
   printWin.document.open();printWin.document.write(report);printWin.document.close();toast('Lampiran dibuka. Klik Cetak / Save as PDF.');form.reset();
  }catch(e){printWin.close();throw e;}return;}

}
document.addEventListener('click',async ev=>{const b=ev.target.closest('button[data-act]');if(!b)return;
 b.disabled=true;try{await handleAction(b);}catch(e){toast(e.message||'Gagal.');}finally{if(b.isConnected)b.disabled=false;}});
document.addEventListener('submit',async ev=>{const f=ev.target.closest('form[data-form]');if(!f)return;ev.preventDefault();const b=f.querySelector('button[type=submit]');if(b)b.disabled=true;
 try{await handleForm(f);}catch(e){toast(e.message||'Gagal.');}finally{if(b&&b.isConnected)b.disabled=false;}});
document.addEventListener('input',ev=>{if(ev.target.id==='memberFilter')drawMemberResults();});
document.addEventListener('change',async ev=>{const el=ev.target;
 if(el.name==='item_id'&&el.form?.dataset.form==='orderMerch'){const item=(state.merchItems||[]).find(x=>x.id===el.value);el.form.elements.size.innerHTML=sizes(itemSizes(item));return;}
 if(el.dataset.roleId){const m=state.members.find(x=>x.id===el.dataset.roleId);if(!confirm('Tukar role '+m.callsign+' kepada '+el.value+'?')){el.value=m.role;return;}try{await api('adminRole',{member_id:el.dataset.roleId,role:el.value});toast('Role dikemaskini.');}catch(e){toast(e.message);el.value=m.role;}return;}
 if(el.dataset.regId){try{await api('adminRegStatus',{id:el.dataset.regId,status:el.value});toast('Status peserta dikemaskini.');}catch(e){toast(e.message);}return;}
 if(el.dataset.attendanceId){try{await api('adminAttendance',{registration_id:el.dataset.attendanceId,attendance:el.value});toast('Kehadiran dikemaskini.');}catch(e){toast(e.message);}return;}
 if(el.dataset.orderId){const row=state.orders.find(x=>x.id===el.dataset.orderId);if(!row)return;const body={id:row.id,payment_status:el.dataset.field==='payment_status'?el.value:row.payment_status,
 delivery_status:el.dataset.field==='delivery_status'?el.value:row.delivery_status};try{await api('adminOrderStatus',body);Object.assign(row,body);toast('Status tempahan disimpan.');}catch(e){toast(e.message);}return;}
});

/* ====================================================================
 ZTG MEDIA MANAGER v2.2 — added to the end of the WORKING Codex Client.
 Files are compressed in the browser and remain private inside Drive.
 ==================================================================== */
MENU.push(['gallery','▧','Gallery']);
let ztgMediaCurrentEvent='',ztgMediaNext=null;
function mediaHtml(id,kind='GALLERY',label='Upload Gambar Crew'){
 return `<section class="panel"><h3>📸 ${esc(label)}</h3>
 <form data-form="mediaUpload"><input type="hidden" name="event_id" value="${esc(id)}"><input type="hidden" name="kind" value="${esc(kind)}">
 <div class="field"><label>Gambar JPG / PNG / WebP (maksimum 5 sekali upload)</label><input type="file" name="media_files" accept="image/jpeg,image/png,image/webp" multiple required></div>
 <div class="field"><label>Kapsyen (pilihan)</label><input name="caption" maxlength="180" placeholder="Checkpoint, kenangan ride..."></div>
 <div data-media-progress aria-live="polite" class="small muted"></div>
 <button class="btn" type="submit">⬆ Upload ke Album</button></form></section>`;
}
async function mediaFileToJpeg(file,limit){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Hanya JPEG, PNG atau WebP dibenarkan.');
 if(file.size>12*1024*1024)throw Error('Gambar asal melebihi 12 MB. Pilih fail lebih kecil.');
 let image,objectUrl;
 try{
  if(typeof createImageBitmap==='function')image=await createImageBitmap(file);
  else{objectUrl=URL.createObjectURL(file);image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Gagal membaca gambar.'));i.src=objectUrl;});}
  const w=image.width||image.naturalWidth,h=image.height||image.naturalHeight;
  if(!w||!h)throw Error('Dimensi gambar tidak sah.');
  const scale=Math.min(1,limit/w,limit/h);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  const cx=canvas.getContext('2d');cx.fillStyle='#ffffff';cx.fillRect(0,0,canvas.width,canvas.height);
  cx.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',limit<=360?0.61:0.77).split(',')[1];
 }finally{if(image&&typeof image.close==='function')image.close();if(objectUrl)URL.revokeObjectURL(objectUrl);}
}
async function mediaUploadForm(form,p){
 const files=Array.from(form.querySelector('input[name="media_files"]').files||[]);
 if(!files.length||files.length>5)throw Error('Pilih antara 1 hingga 5 gambar.');
 const progress=form.querySelector('[data-media-progress]');
 const btn=form.querySelector('[type="submit"]');if(btn)btn.disabled=true;
 let done=0;
 try{
  for(const file of files){
   progress.textContent=`Memproses gambar ${done+1}/${files.length}: ${file.name}`;
   const base64=await mediaFileToJpeg(file,1500),thumbBase64=await mediaFileToJpeg(file,320);
   if(base64.length>3000000||thumbBase64.length>250000)throw Error('Gambar masih terlalu besar selepas resize. Cuba fail lain.');
   await api('mediaUpload',{event_id:p.event_id,item_id:p.item_id||'',kind:p.kind||'GALLERY',mime:'image/jpeg',base64,thumbBase64,caption:p.caption||''});
   done++;progress.textContent=`${done}/${files.length} gambar berjaya disimpan.`;
  }
  toast('Gambar selesai dimuat naik.');form.reset();
  if(p.kind==='GALLERY')await mediaOpenGallery(p.event_id);
  else if(p.kind==='PRODUCT'||p.kind==='COVER'){
    progress.textContent='Gambar berjaya disimpan ke Drive. Refresh event untuk lihat paparan.';
  }
 }finally{if(btn&&btn.isConnected)btn.disabled=false;}
}
async function mediaAlbums(){const ev=await api('events');
 $('screen').innerHTML=`<div class="panel hero"><div class="kicker">ONE RIDE · MANY MEMORIES</div><h2>Crew Photo Gallery</h2><p>Setiap event mempunyai album sendiri. Gambar hanya dapat dilihat oleh ahli yang diluluskan.</p></div>
 <div class="grid">${ev.map(e=>`<article class="panel eventCard"><span class="badge">${esc(e.type)}</span><h3>${esc(e.title)}</h3><p class="small muted">${esc(shortDate(e.start_date))}</p><button class="btn" data-act="mediaOpen" data-id="${esc(e.id)}">📸 Buka Album</button></article>`).join('')}</div>`;
}
async function mediaOpenGallery(eventId,offset=0){ztgMediaCurrentEvent=eventId;state.view='gallery';renderNav();$('pageTitle').textContent='Crew Gallery';
 if(!offset)busy('Memuatkan album...');
 const data=await api('mediaList',{event_id:eventId,kind:'GALLERY',offset,limit:8});
 ztgMediaNext=data.nextOffset;
 const intro=`<div class="panel hero"><div class="kicker">CREW PHOTO GALLERY</div><h2>${esc(data.event.title)}</h2><p class="muted">${data.total} gambar · Album kelab (ahli sahaja)</p>
 <button class="btn alt" data-act="nav" data-id="gallery">← Semua Album</button></div>`;
 const cards=data.items.map(x=>`<article class="panel" style="min-width:0"><div style="aspect-ratio:4/3;background:#0c2119;border-radius:12px;overflow:hidden;display:grid;place-items:center"><img loading="lazy" data-media-thumb="${esc(x.id)}" alt="Gambar oleh ${esc(x.callsign)}" style="max-width:100%;width:100%;height:100%;object-fit:cover" /></div>
 <p class="small muted" style="margin:8px 0">${esc(x.callsign)} · ${esc(shortDate(x.created_at))}</p><p>${esc(x.caption||'')}</p><div class="actions"><button class="btn alt small" data-act="mediaView" data-id="${esc(x.id)}">Lihat Foto</button>${x.canHide?`<button class="btn gray small" data-act="mediaHide" data-id="${esc(x.id)}">Sembunyi</button>`:''}</div></article>`).join('');
 const galleryCards=`<div class="grid" id="ztgMediaCards">${cards||'<div class="empty">Belum ada gambar. Jadilah yang pertama!</div>'}</div>`;
 const upload=data.canUpload?mediaHtml(eventId,'GALLERY','Kongsi Gambar Ride'):'<div class="panel notice">Upload dibenarkan untuk peserta event yang disahkan serta petugas yang diberi akses.</div>';
 const more=ztgMediaNext!==null?`<button class="btn alt" data-act="mediaMore">Lagi gambar ↓</button>`:'';
 if(!offset)$('screen').innerHTML=intro+upload+galleryCards+`<div id="ztgMediaMore">${more}</div>`;
 else{
  const grid=$('ztgMediaCards');if(grid&&data.items.length){const empty=grid.querySelector('.empty');if(empty)empty.remove();grid.insertAdjacentHTML('beforeend',cards);}
  $('ztgMediaMore').innerHTML=more;
 }
 await mediaThumbPaint(data.items);
}
async function mediaThumbPaint(items){const ids=items.map(x=>x.id);for(let i=0;i<ids.length;i+=8){
  const result=await api('mediaThumbs',{ids:ids.slice(i,i+8)});
  result.forEach(x=>{const img=document.querySelector(`img[data-media-thumb="${x.id}"]`);if(img)img.src=x.dataUri;});
 }}
async function mediaViewImage(id){const r=await api('mediaFull',{id});
 const old=document.getElementById('ztgPhotoModal');if(old)old.remove();
 const overlay=document.createElement('div');overlay.id='ztgPhotoModal';overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.94);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:12px';
 const img=document.createElement('img');img.src=r.dataUri;img.alt=r.caption||'Gambar Crew';img.style.cssText='max-height:82vh;max-width:95vw;object-fit:contain';
 const close=document.createElement('button');close.textContent='✕ Tutup';close.className='btn';close.dataset.act='mediaClose';
 overlay.appendChild(img);overlay.appendChild(close);document.body.appendChild(overlay);
}
async function mediaAddEventShortcuts(d){
 const e=d.event;if(!$('screen'))return;
 const canUpload=!!d.own&&d.own.status==='CONFIRMED'&&['PUBLISHED','IN_PROGRESS','COMPLETED'].includes(e.status);
 $('screen').insertAdjacentHTML('beforeend',`<section class="panel"><h3>📸 Crew Photo Gallery</h3><p class="muted">Simpan kenangan event dalam satu album bersama Crew.</p><button class="btn" data-act="mediaOpen" data-id="${esc(e.id)}">Buka Album & Lihat Gambar</button></section>`);
 try{
  const hs=await api('mediaHighlights',{event_id:e.id});const cover=hs.find(x=>x.kind==='COVER');
  if(cover){const top=$('screen').querySelector('.hero');if(top){const img=document.createElement('img');img.src=cover.dataUri;img.alt='Cover Photo';img.style.cssText='width:100%;max-height:360px;object-fit:cover;border-radius:12px;margin-bottom:12px';top.insertBefore(img,top.firstChild);}}
  hs.filter(x=>x.kind==='PRODUCT').forEach(x=>{const node=$('screen').querySelector(`[data-product-photo="${x.item_id}"]`);if(node){const img=document.createElement('img');img.src=x.dataUri;img.style.cssText='width:100%;height:140px;object-fit:cover;border-radius:10px';node.appendChild(img);}});
 }catch(e){console.warn('Media highlights:',e);}
}
async function mediaAdminManager(e){const host=$('screen');if(!host)return;
 let items=[];if(e.type==='MERCH'){
   try{const res=await api('event',{id:e.id});items=res.merch||[];}catch(err){console.warn(err);}
 }
 let html=`<section class="panel"><h2>📁 Media Manager — ${esc(e.title)}</h2>
 <p class="muted">Drive folders dicipta automatik. Tiada pautan Drive perlu ditampal.</p><button class="btn alt" data-act="mediaEnsure" data-id="${esc(e.id)}">Sediakan / Semak Folder Event</button>
 <button class="btn alt" data-act="mediaOpen" data-id="${esc(e.id)}">Lihat Crew Gallery</button></section>`;
 html+=mediaHtml(e.id,'COVER','Upload Cover Event');
 if(e.type==='MERCH')html+=`<section class="panel"><h3>🛍 Gambar Katalog Produk</h3><form data-form="mediaUpload">
 <input type="hidden" name="event_id" value="${esc(e.id)}"><input type="hidden" name="kind" value="PRODUCT">
 <div class="field"><label>Pilih produk yang sudah dicipta</label><select name="item_id" required>${items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</select></div>
 <div class="field"><label>Foto Depan / Belakang (maks 5)</label><input type="file" name="media_files" accept="image/jpeg,image/png,image/webp" multiple required></div>
 <div class="field"><label>Kapsyen</label><input name="caption" maxlength="180" placeholder="Depan, belakang, detail kain..."></div>
 <div class="small muted" data-media-progress></div>
 <button type="submit" class="btn" ${items.length?'':'disabled'}>Upload Gambar Produk</button></form>${items.length?'':'<p class="muted">Tambah produk dahulu pada Add Merchandise Item di atas.</p>'}</section>`;
 host.insertAdjacentHTML('beforeend',html);
}
async function mediaAction(a,id){
 if(a==='mediaOpen')return mediaOpenGallery(id);
 if(a==='mediaMore')return mediaOpenGallery(ztgMediaCurrentEvent,ztgMediaNext);
 if(a==='mediaView')return mediaViewImage(id);
 if(a==='mediaClose'){document.getElementById('ztgPhotoModal')?.remove();return;}
 if(a==='mediaHide'){
  if(!confirm('Sembunyikan gambar ini daripada ahli? Fail kekal dalam Drive untuk semakan admin.'))return;
  await api('mediaHide',{id});toast('Gambar telah disembunyikan.');return mediaOpenGallery(ztgMediaCurrentEvent);
 }
 if(a==='mediaEnsure'){const out=await api('mediaEnsureFolders',{event_id:id});toast('Folder event tersedia di Google Drive.');return;}
}

startup().catch(e=>{try{renderAuth();toast(e.message||String(e));}catch(x){showFatal(e.message||String(e));}});

/* ZTG ROUTE UX v2.3 | Append ONCE at the very end of the existing WORKING Client.html.
   Does not modify backend, Firebase, Media Manager, registration, pledge, or database.
   Google My Maps embeds are optional; directions links use user-entered checkpoints.
*/
(function ztgRouteUX23(){
  if(window.__ZTG_ROUTE_UX23__) return;
  window.__ZTG_ROUTE_UX23__ = true;
  const oldEventDetail = eventDetail;
  const oldEventFields = eventFields;
  const oldValues = values;

  function extract(raw){
    const entries=String(raw||'').split(/\r?\n/);
    let mapUrl='';
    const rest=[];
    for(const line of entries){
      const m=line.trim().match(/^@MAP\|\s*(.+)$/i);
      if(m){mapUrl=m[1].trim();}else{rest.push(line);}
    }
    return {itinerary:rest.join('\n').trim(),mapUrl};
  }
  function permittedMapsUrl(raw){
    try{const url=new URL(String(raw||'').trim());
      return url.protocol==='https:' && (
        url.hostname==='www.google.com'||url.hostname==='google.com'||
        url.hostname==='maps.google.com'||url.hostname==='maps.app.goo.gl'
      ) && (url.pathname.startsWith('/maps')||url.hostname==='maps.app.goo.gl') ? url.href : '';
    }catch(e){return '';}
  }
  function parseStops(raw){
    let text=extract(raw).itinerary;
    if(!text)return [];
    // The original app allowed a one-line itinerary. Split familiar 5.30 / 12:30 stops.
    if(!text.includes('\n'))text=text.replace(/\s+(?=(?:[01]?\d|2[0-3])[:.][0-5]\d\s+)/g,'\n');
    return text.split(/\n+/).map(s=>s.trim()).filter(Boolean).map((s,i)=>{
      const m=s.match(/^(\d{1,2}[:.][0-5]\d)\s*(?:[|\-–—]\s*)?(.*)$/);
      const time=m?m[1].replace('.',':'):'';
      const content=m?m[2].trim():s;
      const pieces=content.split(/\s*\|\s*/);
      return {i:i+1,time,place:pieces[0]||content,note:pieces.slice(1).join(' · ')};
    }).slice(0,45);
  }
  function directions(e,stops){
    const locations=stops.map(x=>x.place).filter(Boolean);
    if(e.rv)locations.unshift(e.rv);
    const unique=locations.filter((x,i)=>i===locations.findIndex(y=>y.toLowerCase()===x.toLowerCase()));
    if(unique.length<2)return '';
    const p=new URLSearchParams({api:'1',origin:unique[0],destination:unique[unique.length-1],travelmode:'driving'});
    if(unique.length>2)p.set('waypoints',unique.slice(1,-1).slice(0,7).join('|'));
    return 'https://www.google.com/maps/dir/?'+p.toString();
  }
  function safeEmbed(e,mapUrl,stops){
    // My Maps: a proper Google My Maps /embed link gives the full designed route.
    if(mapUrl){
      try{const u=new URL(mapUrl);
        if((u.hostname==='www.google.com'||u.hostname==='google.com') &&
             (u.pathname==='/maps/d/embed'||u.pathname.startsWith('/maps/embed')))return u.href;
      }catch(x){}
    }
    // Otherwise preview only the meeting location, NOT the entire route.
    const q=String(e.rv||stops[0]?.place||'').trim();
    return q?'https://maps.google.com/maps?q='+encodeURIComponent(q)+'&output=embed':'';
  }
  function escapeText(s){return esc(s);}
  function renderTimeline(e){
    const {mapUrl}=extract(e.itinerary);
    const stops=parseStops(e.itinerary);
    if(!stops.length)return '<p class="muted">Checkpoint belum ditambah oleh Captain.</p>';
    const items=stops.map(x=>`<div class="ztg-stop"><div class="ztg-time">${x.time?escapeText(x.time):'STOP '+x.i}</div><div class="ztg-stop-body"><div class="ztg-stop-title">${escapeText(x.place)}</div>${x.note?`<div class="muted small">${escapeText(x.note)}</div>`:''}</div></div>`).join('');
    const direct=directions(e,stops);
    const supplied=permittedMapsUrl(mapUrl);
    const mapLink=supplied||direct;
    const embed=safeEmbed(e,supplied,stops);
    const fullRoute=!!(supplied&&/\/maps\/(d\/embed|embed)/.test(supplied));
    const mapPreview=embed?`<div class="ztg-map-frame"><iframe loading="lazy" title="${fullRoute?'Peta laluan disediakan penganjur':'Peta lokasi berkumpul'}" src="${escapeText(embed)}" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`:'';
    return `<div class="ztg-route-layout"><div class="ztg-timeline">${items}</div><div class="ztg-map-area"><div class="ztg-map-heading">🗺️ Peta & Navigasi</div>${mapPreview}${mapLink?`<a class="btn ztg-map-link" href="${escapeText(mapLink)}" target="_blank" rel="noopener noreferrer">↗ Buka ${supplied?'Peta Penganjur':'Arah Google Maps'}</a>`:''}<p class="muted small">${fullRoute?'Peta laluan oleh penganjur. Sila ikut briefing RC.':'Pratonton menunjukkan lokasi RV. Pautan arah dijana daripada nama checkpoint dan perlu disemak RC sebelum ride.'}</p></div></div>`;
  }
  function renderSafety(raw){
    let text=String(raw||'').trim();
    if(!text)return '<p class="muted">Briefing belum ditetapkan.</p>';
    text=text.replace(/\s+(?=\d{1,2}\.\s+(?:[A-Za-z]|[\u00c0-\u024f]))/g,'\n');
    const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    return '<div class="ztg-safety-grid">'+lines.map((x,i)=>{
      const m=x.match(/^(\d{1,2})\.\s*(.*)$/);
      const num=m?m[1]:String(i+1);
      return `<div class="ztg-safety-rule"><span class="ztg-safety-number">${escapeText(num)}</span><div>${escapeText(m?m[2]:x)}</div></div>`;
    }).join('')+'</div>';
  }
  function improveEvent(e){
    if(!e||e.type!=='RIDE')return;
    const nodes=Array.from(document.querySelectorAll('#screen .panel'));
    for(const panel of nodes){
      const h=panel.querySelector('h3');if(!h)continue;
      const label=h.textContent||'';
      if(label.includes('Itinerary')&&label.includes('Checkpoint')){
        const old=panel.querySelector('.safety');
        if(old){old.outerHTML=renderTimeline(e);panel.classList.add('ztg-route-panel');}
      }else if(label.includes('Ride Safety Briefing')){
        const old=panel.querySelector('.safety');
        if(old){old.outerHTML=renderSafety(e.safety_brief);panel.classList.add('ztg-brief-panel');}
      }
    }
  }
  eventDetail=async function(id){
    const out=await oldEventDetail(id);
    // Media Manager can add cover asynchronously; only change itinerary and safety cards.
    try{improveEvent(state.event);}catch(err){console.warn('ZTG Route UX enhancement:',err);}
    return out;
  };
  eventFields=function(e={}){
    const raw=extract(e.itinerary||'');
    return oldEventFields(e)+`<div class="field"><label>🗺️ Peta Laluan Google Maps / My Maps (pilihan)</label><input name="route_map_url" type="url" placeholder="https://www.google.com/maps/d/embed?mid=..." value="${escapeText(raw.mapUrl)}"><p class="muted small">Untuk peta laluan penuh dalam aplikasi, guna pautan Embed Google My Maps. Jika kosong, sistem boleh sediakan arah berdasarkan checkpoint.</p><p class="muted small">Format checkpoint paling kemas: 05:30 | RNR Rawang (Utara) | RV utama (satu checkpoint setiap baris).</p></div>`;
  };
  values=function(form){
    const p=oldValues(form);
    if(form?.dataset?.form==='createEvent'||form?.dataset?.form==='editEvent'){
      const parsed=extract(p.itinerary);
      const route=String(p.route_map_url||'').trim();
      if(route&&!permittedMapsUrl(route))throw Error('Pautan peta mesti URL HTTPS Google Maps atau Google My Maps.');
      p.itinerary=parsed.itinerary+(route?'\n@MAP|'+route:'');
      delete p.route_map_url;
    }
    return p;
  };
})();

/* ZTG VISUALS v2.4 ADDON. Append to the END of working Client.html.
 * Preserves Codex login, Route UX addon, gallery and member profile.
 * COVER (legacy backend kind) = BANNER 16:9, POSTER = promotional portrait 4:5.
 */
(function(){
  'use strict';
  if(typeof mediaAdminManager!=='function'||typeof mediaUploadForm!=='function'||typeof mediaAddEventShortcuts!=='function') {
    console.warn('Visual v2.4 addon needs Media Manager v2.2');return;
  }

  const prevManager=mediaAdminManager;
  mediaAdminManager=async function(event){
    await prevManager(event);
    const forms=Array.from(document.querySelectorAll('form[data-form="mediaUpload"]'));
    const coverInput=forms.map(f=>f.querySelector('input[name="kind"][value="COVER"]')).find(Boolean);
    const bannerForm=coverInput&&coverInput.closest('form');
    const bannerPanel=bannerForm&&bannerForm.closest('.panel');
    if(!bannerPanel)return;
    const title=bannerPanel.querySelector('h3');if(title)title.textContent='🖼️ Banner Event — 16:9 (1920 × 1080)';
    const picker=bannerForm.querySelector('input[name="media_files"]');
    if(picker){picker.multiple=false;picker.setAttribute('aria-label','Upload satu banner landscape');}
    const label=bannerForm.querySelector('label');
    if(label)label.textContent='Gambar melintang JPG/PNG/WebP (satu fail sahaja)';
    const caption=bannerForm.querySelector('input[name="caption"]');
    if(caption)caption.placeholder='Banner utama event';
    const btn=bannerForm.querySelector('[type="submit"]');if(btn)btn.textContent='⬆ Upload Banner';
    if(!document.getElementById('ztgPosterForm')){
      const html=mediaHtml(event.id,'POSTER','Poster Promosi — 4:5 (1080 × 1350)');
      bannerPanel.insertAdjacentHTML('afterend',html);
      const posterPanel=bannerPanel.nextElementSibling;
      posterPanel.id='ztgPosterForm';
      const posterPicker=posterPanel.querySelector('input[name="media_files"]');
      if(posterPicker){posterPicker.multiple=false;posterPicker.setAttribute('aria-label','Upload satu poster portrait');}
      const posterLabel=posterPanel.querySelector('label');
      if(posterLabel)posterLabel.textContent='Gambar menegak JPG/PNG/WebP (satu fail sahaja)';
      const postBtn=posterPanel.querySelector('[type="submit"]');if(postBtn)postBtn.textContent='⬆ Upload Poster';
    }
    const note=document.createElement('p');note.className='small muted';
    note.textContent='Untuk Publish event baharu, kedua-dua aset wajib. Simpan Draft dahulu, kemudian upload Banner dan Poster.';
    bannerPanel.insertAdjacentElement('beforebegin',note);
    try{
      const hs=await api('mediaHighlights',{event_id:event.id});
      note.textContent=(hs.some(x=>x.kind==='COVER')?'✓ Banner tersedia':'○ Banner belum ada') +
        '  |  '+(hs.some(x=>x.kind==='POSTER')?'✓ Poster tersedia':'○ Poster belum ada') +
        '  — Kedua-dua visual diperlukan sebelum Publish.';
    }catch(e){console.warn('Status media v2.4:',e);}
  };

  async function ratioOf(file){
    const url=URL.createObjectURL(file);
    try{return await new Promise((resolve,reject)=>{
      const i=new Image();i.onload=()=>resolve({width:i.naturalWidth,height:i.naturalHeight});
      i.onerror=()=>reject(Error('Fail gambar tidak dapat dibaca.'));i.src=url;
    });}finally{URL.revokeObjectURL(url);}
  }
  const prevUpload=mediaUploadForm;
  mediaUploadForm=async function(form,p){
    const kind=String(p.kind||'').toUpperCase();
    if(kind!=='COVER'&&kind!=='POSTER')return prevUpload(form,p);
    const files=Array.from(form.querySelector('input[name="media_files"]')?.files||[]);
    if(files.length!==1)throw Error('Pilih satu gambar '+(kind==='COVER'?'Banner':'Poster')+' sahaja.');
    const file=files[0];const dim=await ratioOf(file);const ratio=dim.width/dim.height;
    if(kind==='COVER'&&(ratio<1.4||ratio>2.4))throw Error('Banner mesti berbentuk melintang (disyorkan 16:9).');
    if(kind==='POSTER'&&(ratio<0.55||ratio>0.92))throw Error('Poster mesti berbentuk menegak (disyorkan 4:5).');
    const progress=form.querySelector('[data-media-progress]');
    const btn=form.querySelector('[type="submit"]');if(btn)btn.disabled=true;
    try{
      if(progress)progress.textContent='Menyediakan gambar resolusi tinggi...';
      let b64='';let limit=1920;
      // Adapt to existing 2.2 MB server limit; full-size photo retained when possible.
      for(const size of [1920,1600,1400]){
        b64=await mediaFileToJpeg(file,size);
        if(Math.ceil(b64.length*3/4)<2100000){limit=size;break;}
      }
      if(Math.ceil(b64.length*3/4)>2200000)throw Error('Gambar terlalu besar selepas pemprosesan. Cuba gambar lebih kecil.');
      const thumbBase64=await mediaFileToJpeg(file,320);
      await api('mediaUpload',{event_id:p.event_id,kind,mime:'image/jpeg',base64:b64,thumbBase64,
        caption:p.caption||''});
      toast((kind==='COVER'?'Banner':'Poster')+' berjaya dimuat naik.');
      if(progress)progress.textContent='Upload selesai ('+dim.width+' × '+dim.height+').';
      form.reset();
      // Refresh existing admin event page, not the whole browser.
      if(typeof adminEvent==='function')await adminEvent(p.event_id);
    }finally{if(btn&&btn.isConnected)btn.disabled=false;}
  };

  const prevHighlights=mediaAddEventShortcuts;
  mediaAddEventShortcuts=async function(details){
    await prevHighlights(details);
    try{
      const hs=await api('mediaHighlights',{event_id:details.event.id});
      const desktop=hs.find(x=>x.kind==='COVER');
      const mobile=hs.find(x=>x.kind==='POSTER');
      const narrow=window.matchMedia&&window.matchMedia('(max-width:800px)').matches;
      const chosen=(narrow?mobile||desktop:desktop||mobile);
      if(!chosen)return;
      const full=await api('mediaFull',{id:chosen.id});
      const hero=document.querySelector('#screen .hero');if(!hero)return;
      let img=hero.querySelector('img[alt="Cover Photo"]');
      if(!img){img=document.createElement('img');img.alt='Cover Photo';hero.insertBefore(img,hero.firstChild);}
      img.src=full.dataUri;
      img.style.cssText='display:block;width:100%;height:auto;max-height:580px;object-fit:contain;'+
        'background:#0a1b14;border-radius:14px;margin:0 auto 18px';
    }catch(e){console.warn('Gambar resolusi penuh:',e);}
  };
})();
/* PZC ClubOS v2.5 — Sponsor UI Add-on.
   APPEND at the end of the WORKING Client.html (after existing route/media addons).
   Requires SponsorManager.gs plus Api.gs switch cases; DOES NOT replace login or startup(). */
(function(){
  'use strict';
  if(window.__ztgSponsorInstalled)return;
  window.__ztgSponsorInstalled=true;
  if(!MENU.some(x=>x[0]==='sponsors'))MENU.push(['sponsors','\u2605','Sponsors']);
  const sponsorEsc=s=>esc(s==null?'':s);
  const sh=s=>String(s||'').toUpperCase()==='APPROVED';
  const sponsorField=(label,name,value='',required=false,type='text')=>`<div class="field"><label>${label}${required?' *':''}</label><input name="${name}" type="${type}" value="${sponsorEsc(value)}" ${required?'required':''}></div>`;
  function sponsorForm(s){s=s||{};return `<form data-form="sponsorProfile" class="ztgSponsorForm">
   <input type="hidden" name="id" value="${sponsorEsc(s.id||'')}">
   <div class="formgrid">${sponsorField('Nama perniagaan','business_name',s.business_name,true)}
   <div class="field"><label>Kategori perniagaan *</label><select name="category" required>${['Bengkel motosikal','Aksesori motosikal','Kedai tayar','Restoran / Kafe','Penginapan','Servis / Perniagaan lain'].map(x=>`<option ${s.category===x?'selected':''}>${x}</option>`).join('')}</select></div>
   ${sponsorField('Telefon perniagaan / WhatsApp','business_phone',s.business_phone,false,'tel')}
   ${sponsorField('Bandar / Kawasan','city',s.city)}
   ${sponsorField('Negeri','state',s.state)}
   ${sponsorField('Alamat premis','address',s.address)}
   ${sponsorField('Pautan Google Maps HTTPS','maps_url',s.maps_url)}
   ${sponsorField('Laman web HTTPS','website_url',s.website_url)}
   ${sponsorField('Facebook / Instagram HTTPS','social_url',s.social_url)}
   </div><div class="field"><label>Ringkasan perniagaan / kepakaran</label><textarea name="description" maxlength="800">${sponsorEsc(s.description||'')}</textarea></div>
   <div class="field"><label><input type="checkbox" name="public_consent" required> Saya bersetuju nama perniagaan, maklumat hubungan perniagaan dan promosi dipaparkan kepada pengguna Hub selepas kelulusan.</label></div>
   <p class="small muted">Profil hanya dipaparkan selepas admin meluluskan. Pindaan oleh penaja sendiri akan dihantar untuk semakan semula.</p>
   <button type="submit" class="btn">${s.id?'Simpan & Hantar Semakan':'Hantar Permohonan Sponsor'}</button>
   </form>`;}
  function sponsorBadge(status){return `<span class="badge ${status==='APPROVED'?'':status==='PENDING'?'pending':'red'}">${sponsorEsc(status)}</span>`;}
  function sponsorLogo(id){return `<div class="ztgSponsorLogo" data-sponsor-placeholder="${sponsorEsc(id)}"><span>\u2605</span><img alt="Logo sponsor" data-sponsor-image="${sponsorEsc(id)}" loading="lazy" hidden></div>`;}
  function sponsorCard(s,offers){const o=(offers||[]).filter(x=>x.sponsor_id===s.id).slice(0,2);
   const links=[s.maps_url?`<a class="btn alt small" href="${sponsorEsc(s.maps_url)}" target="_blank" rel="noopener noreferrer">\ud83d\udccd Maps</a>`:'',s.website_url?`<a class="btn alt small" href="${sponsorEsc(s.website_url)}" target="_blank" rel="noopener noreferrer">Website</a>`:'',s.business_phone?`<a class="btn alt small" href="https://wa.me/${sponsorEsc(String(s.business_phone).replace(/\D/g,''))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`:''].filter(Boolean);
   return `<article class="panel ztgSponsorCard">${sponsorLogo(s.id)}<div class="ztgSponsorBody"><div class="kicker">${sponsorEsc(s.sponsor_no)} · ${sponsorEsc(s.tier||'SUPPORTING')} PARTNER</div>
     <h3>${sponsorEsc(s.business_name)}</h3><p class="small muted">${sponsorEsc(s.category)}${s.city?' · '+sponsorEsc(s.city):''}</p>
     <p>${sponsorEsc(s.description||'Rakan komuniti Zontes Putrajaya.')}</p>
     ${o.map(x=>`<div class="ztgSponsorOffer"><strong>\ud83c\udff7 ${sponsorEsc(x.title)}</strong><div>${sponsorEsc(x.description)}</div></div>`).join('')}
     <div class="actions"><button type="button" class="btn small" data-act="sponsorView" data-id="${sponsorEsc(s.id)}">Lihat Profil</button>${links.join('')}</div></div></article>`;}
  async function sponsorImagesPaint(items){const list=items.filter(s=>s.has_logo).slice(0,16);
   for(let i=0;i<list.length;i+=8){try{
     const images=await api('sponsorImagesBatch',{ids:list.slice(i,i+8).map(s=>s.id)});
     images.forEach(d=>{const target=document.querySelector(`[data-sponsor-image="${d.id}"]`);
       if(target&&d.dataUri){target.src=d.dataUri;target.hidden=false;if(target.previousElementSibling)target.previousElementSibling.hidden=true;}});
   }catch(e){/* private images stay hidden */}}
  }
  async function sponsorPage(){if(!state.self)return renderAuth();state.view='sponsors';renderNav();$('pageTitle').textContent='Our Sponsors';busy();
   try{
    const [mineResult,approved,offers]=await Promise.all([api('sponsorMine'),api('sponsorList'),api('sponsorOffers')]);
    const mine=mineResult.sponsor;
    const header=`<section class="panel hero"><div class="kicker">OUR PARTNERS · PUTRAJAYA ZONTES COMMUNITY</div><h2>\u2605 Sponsor & Rakan Niaga</h2><p class="muted">Kenali rakan perniagaan yang menyokong komuniti. Profil dan tawaran dipaparkan selepas kelulusan Admin.</p></section>`;
    const mineBox=mine?`<section class="panel"><div class="row between"><h3>Profil Sponsor Saya · ${sponsorEsc(mine.sponsor_no)}</h3>${sponsorBadge(mine.status)}</div>
     <p class="small muted">${mine.status==='APPROVED'?'Profil kini dipaparkan kepada ahli.':'Permohonan / pindaan menunggu semakan admin.'}</p>
     <details><summary class="ztgSponsorSummary">Ubah Maklumat Perniagaan</summary>${sponsorForm(mine)}</details>
     <h3 style="margin-top:18px">Logo & Banner Sponsor</h3><div class="ztgSponsorUploadGrid">
     ${['LOGO','BANNER'].map(kind=>`<form data-form="sponsorMediaUpload"><input type="hidden" name="id" value="${sponsorEsc(mine.id)}"><input type="hidden" name="kind" value="${kind}">
      <label>${kind==='LOGO'?'Logo (segi empat)':'Banner (16:9)'}</label><input type="file" name="image" accept="image/jpeg,image/png,image/webp" required><button class="btn alt" type="submit">Upload ${kind}</button></form>`).join('')}</div>
     <h3 style="margin-top:22px">Cadangkan Tawaran Ahli PZC</h3><form data-form="sponsorOffer"><input type="hidden" name="sponsor_id" value="${sponsorEsc(mine.id)}">
     <div class="formgrid">${sponsorField('Tajuk tawaran','title','',true)}${sponsorField('Sah sehingga (pilihan)','valid_until','','', 'date')}</div>
     <div class="field"><label>Maklumat tawaran</label><textarea name="description" maxlength="500" placeholder="Contoh: servis khas ahli PZC berdasarkan terma kedai"></textarea></div>
     <button class="btn" type="submit">Hantar Tawaran untuk Kelulusan</button></form>
     ${mineResult.offers?.length?`<p class="muted small">Tawaran saya: ${mineResult.offers.map(o=>`${sponsorEsc(o.title)} (${sponsorEsc(o.status)})`).join(' · ')}</p>`:''}</section>`:
    `<section class="panel"><h3>Daftar Sebagai Sponsor PZC</h3><p class="muted">Bengkel, kedai aksesori, kafe atau perniagaan lain boleh memohon profil penaja. Akaun Firebase yang disahkan diperlukan; tak wajib menjadi rider.</p>
     <details><summary class="ztgSponsorSummary">+ Buka Borang Pendaftaran Sponsor</summary>${sponsorForm()}</details></section>`;
    $('screen').innerHTML=header+mineBox+`<h2 style="margin:20px 0">Rakan Niaga Berdaftar</h2><div class="ztgSponsorGrid">${approved.length?approved.map(s=>sponsorCard(s,offers)).join(''):'<div class="empty">Belum ada sponsor yang diluluskan. Jadilah rakan pertama!</div>'}</div>`;
    sponsorImagesPaint(approved);
   }catch(e){$('screen').innerHTML=`<div class="panel"><h3>Sponsors belum tersedia</h3><p>${sponsorEsc(e.message)}</p></div>`;}
  }
  async function sponsorDetails(id){const list=await api('sponsorList'),s=list.find(x=>x.id===id);
   if(!s)throw Error('Profil sponsor tidak tersedia.');
   const offers=await api('sponsorOffers',{sponsor_id:id});state.view='sponsors';renderNav();$('pageTitle').textContent=s.business_name;
   $('screen').innerHTML=`<section class="panel hero"><div class="kicker">PZC PARTNERS · ${sponsorEsc(s.sponsor_no)}</div><h2>${sponsorEsc(s.business_name)}</h2><p>${sponsorEsc(s.category)} · ${sponsorEsc(s.city)}</p>
   <div class="ztgSponsorBanner" id="ztgSponsorBanner">Logo / Banner Perniagaan</div><p>${sponsorEsc(s.description)}</p>
   ${offers.map(o=>`<div class="ztgSponsorOffer"><b>${sponsorEsc(o.title)}</b><p>${sponsorEsc(o.description)}</p></div>`).join('')}
   <div class="actions">${s.maps_url?`<a class="btn alt" target="_blank" rel="noopener noreferrer" href="${sponsorEsc(s.maps_url)}">Google Maps</a>`:''}
   ${s.website_url?`<a class="btn alt" target="_blank" rel="noopener noreferrer" href="${sponsorEsc(s.website_url)}">Website</a>`:''}
   ${s.business_phone?`<a class="btn" target="_blank" rel="noopener noreferrer" href="https://wa.me/${sponsorEsc(String(s.business_phone).replace(/\D/g,''))}">WhatsApp Bengkel</a>`:''}</div>
   </section><button type="button" class="btn gray" data-act="nav" data-id="sponsors">← Semua Sponsor</button>`;
   if(s.has_banner){try{const image=await api('sponsorImage',{id,kind:'BANNER'});const box=$('ztgSponsorBanner');if(box&&image.dataUri){const im=document.createElement('img');im.alt='Banner '+s.business_name;im.src=image.dataUri;box.replaceChildren(im);}}catch(e){/* optional */}}
  }
  async function sponsorAdminPage(){if(!isAdmin())throw Error('Akses admin diperlukan.');state.view='sponsorAdmin';renderNav();$('pageTitle').textContent='Sponsor Management';busy();
   const [sponsors,offers]=await Promise.all([api('sponsorAdminList'),api('sponsorOffersAdmin')]);
   $('screen').innerHTML=`<section class="panel hero"><div class="kicker">PZC CLUBOS · ADMIN</div><h2>Sponsor Management</h2><p class="muted">Semak penaja, kategorikan rakan perniagaan dan luluskan tawaran khas.</p></section>
   <section class="panel"><h3>Permohonan Sponsor (${sponsors.length})</h3><div class="ztgSponsorAdminList">${sponsors.length?sponsors.map(s=>`<div class="rider">
    <div class="row between"><div><strong>${sponsorEsc(s.business_name)}</strong><div class="small muted">${sponsorEsc(s.sponsor_no)} · ${sponsorEsc(s.owner_email)} · ${sponsorEsc(s.category)}</div></div>${sponsorBadge(s.status)}</div>
    <p class="small">${sponsorEsc(s.description)}</p><div class="row"><select data-sponsor-tier="${sponsorEsc(s.id)}" aria-label="Jenis rakan">${['SUPPORTING','OFFICIAL','EVENT','MERCH'].map(t=>`<option ${t===s.tier?'selected':''}>${t}</option>`).join('')}</select>
    <button class="btn" data-act="sponsorApprove" data-id="${sponsorEsc(s.id)}">Approve</button><button class="btn red" data-act="sponsorReject" data-id="${sponsorEsc(s.id)}">Reject</button></div></div>`).join(''):'<div class="empty">Tiada sponsor.</div>'}</div></section>
   <section class="panel"><h3>Tawaran / Promosi (${offers.length})</h3>${offers.length?offers.map(o=>`<div class="rider" style="margin:10px 0"><strong>${sponsorEsc(o.title)}</strong> · ${sponsorEsc(o.business_name)} ${sponsorBadge(o.status)}<p class="small">${sponsorEsc(o.description)}</p>
    <div class="actions"><button class="btn" data-act="sponsorOfferApprove" data-id="${sponsorEsc(o.id)}">Approve Offer</button><button class="btn red" data-act="sponsorOfferReject" data-id="${sponsorEsc(o.id)}">Reject</button></div></div>`).join(''):'<p class="muted">Belum ada tawaran.</p>'}</section>
   <button class="btn alt" data-act="nav" data-id="admin">\u2190 Kembali Admin</button>`;
  }
  async function sponsorEventPanel(eventId,adminMode){const el=$('screen');if(!el||!eventId)return;
   const [linked,all]=await Promise.all([api('sponsorEventList',{event_id:eventId}),adminMode?api('sponsorList'):Promise.resolve([])]);
   if(adminMode){el.insertAdjacentHTML('beforeend',`<section class="panel"><div class="kicker">EVENT PARTNERS</div><h3>\u2605 Sponsor untuk Event Ini</h3>
    <form data-form="sponsorEventAttach"><input type="hidden" name="event_id" value="${sponsorEsc(eventId)}"><div class="formgrid"><div class="field"><label>Sponsor diluluskan</label>
    <select name="sponsor_id" required>${all.map(s=>`<option value="${sponsorEsc(s.id)}">${sponsorEsc(s.business_name)} (${sponsorEsc(s.sponsor_no)})</option>`).join('')}</select></div>
    <div class="field"><label>Jenis tajaan</label><select name="kind"><option>EVENT</option><option>MERCH</option><option>SUPPORTING</option></select></div></div>
    <button type="submit" class="btn" ${all.length?'':'disabled'}>+ Hubungkan Sponsor</button></form>
    ${linked.length?`<div class="ztgSponsorLinked">${linked.map(s=>`<div class="row between"><span>${sponsorEsc(s.business_name)} · ${sponsorEsc(s.kind)}</span><button class="btn gray small" data-act="sponsorEventRemove" data-id="${sponsorEsc(s.link_id)}">Buang pautan</button></div>`).join('')}</div>`:'<p class="small muted">Belum ada penaja untuk event ini.</p>'}</section>`);
   }else if(linked.length){el.insertAdjacentHTML('beforeend',`<section class="panel"><div class="kicker">SUPPORTING OUR JOURNEY</div><h3>\u2605 Sponsored By</h3><div class="ztgSponsorGrid">${linked.map(s=>sponsorCard(s,[])).join('')}</div></section>`);sponsorImagesPaint(linked);}
  }
  async function sponsorImageJpeg(file,kind){if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Pilih JPG, PNG atau WebP.');
   if(file.size>12000000)throw Error('Imej asal maksimum 12 MB.');
   const src=URL.createObjectURL(file);try{const im=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Gambar gagal dibaca.'));image.src=src;});
    const max=kind==='LOGO'?600:1600,scale=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(im.naturalWidth*scale));c.height=Math.max(1,Math.round(im.naturalHeight*scale));
    const context=c.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,c.width,c.height);context.drawImage(im,0,0,c.width,c.height);
    let result='';for(const q of [0.82,0.7,0.56,0.42]){result=c.toDataURL('image/jpeg',q).split(',')[1];if(result.length<2100000)break;}
    if(result.length>=2100000)throw Error('Gambar masih terlalu besar. Cuba gambar lebih kecil.');return result;
   }finally{URL.revokeObjectURL(src);}}
  const originalGo=go;
  go=async function(view){if(view==='sponsors')return sponsorPage();if(view==='sponsorAdmin')return sponsorAdminPage();return originalGo(view);};
  const originalHome=home;
  home=async function(){await originalHome();if(state.self&&!state.self.member){
    $('screen').insertAdjacentHTML('beforeend',`<section class="panel"><h3>Anda wakil perniagaan?</h3><p>Daftar profil Sponsor tanpa perlu menjadi rider.</p><button class="btn alt" data-act="nav" data-id="sponsors">\u2605 Daftar Sponsor</button></section>`);
   }else if(state.self?.member?.status==='APPROVED'){
    // Do not delay the main Home dashboard. Load a compact partners strip asynchronously.
    api('sponsorList').then(items=>{
      if(state.view!=='home'||!$('screen')||!items.length)return;
      const featured=items.slice(0,3);
      $('screen').insertAdjacentHTML('beforeend',`<section class="panel"><div class="row between"><h3>\u2605 Our Partners</h3><button class="btn alt small" data-act="nav" data-id="sponsors">Semua Sponsor</button></div>
      <div class="ztgSponsorGrid">${featured.map(x=>sponsorCard(x,[])).join('')}</div></section>`);
      sponsorImagesPaint(featured);
    }).catch(()=>{});
   }};
  const originalAdmin=admin;
  admin=async function(){await originalAdmin();if(isAdmin()&&$('screen'))$('screen').insertAdjacentHTML('beforeend',`<section class="panel"><h3>\u2605 Sponsor Control Centre</h3><p class="muted">Semak permohonan penaja, promosi dan profil perniagaan.</p><button class="btn" data-act="nav" data-id="sponsorAdmin">Urus Sponsor</button></section>`);};
  const originalEventDetail=eventDetail;
  eventDetail=async function(id){await originalEventDetail(id);if(id&&state.self?.member?.status==='APPROVED')try{await sponsorEventPanel(id,false);}catch(e){/* event remains usable */}};
  const originalAdminEvent=adminEvent;
  adminEvent=async function(id){await originalAdminEvent(id);if(id&&isAdmin())try{await sponsorEventPanel(id,true);}catch(e){toast(e.message||'Sponsor event tidak tersedia.');}};
  const originalHandleAction=handleAction;
  handleAction=async function(button){const a=button.dataset.act,id=button.dataset.id;
   if(a==='sponsorView')return sponsorDetails(id);
   if(a==='sponsorApprove'||a==='sponsorReject'){if(!confirm((a==='sponsorApprove'?'Luluskan':'Tolak')+' sponsor ini?'))return;
    const tier=document.querySelector(`[data-sponsor-tier="${id}"]`)?.value||'SUPPORTING';await api('sponsorApprove',{id,approve:a==='sponsorApprove',tier});toast('Status sponsor dikemas kini.');return sponsorAdminPage();}
   if(a==='sponsorOfferApprove'||a==='sponsorOfferReject'){await api('sponsorOfferApprove',{id,approve:a==='sponsorOfferApprove'});toast('Status promosi dikemas kini.');return sponsorAdminPage();}
   if(a==='sponsorEventRemove'){if(!confirm('Buang pautan sponsor daripada event ini?'))return;await api('sponsorEventRemove',{id});toast('Pautan sponsor dibuang.');return adminEvent(state.event?.id);}
   return originalHandleAction(button);
  };
  const originalHandleForm=handleForm;
  handleForm=async function(form){const kind=form.dataset.form;
   if(kind==='sponsorProfile'){const p=values(form);if(p.id)await api('sponsorSave',p);else await api('sponsorRegister',p);
    toast('Profil sponsor dihantar untuk semakan.');return sponsorPage();}
   if(kind==='sponsorOffer'){await api('sponsorOfferSubmit',values(form));toast('Tawaran dihantar untuk kelulusan admin.');return sponsorPage();}
   if(kind==='sponsorMediaUpload'){const p=values(form),f=form.querySelector('input[type=file]')?.files?.[0];
    if(!f)throw Error('Pilih gambar dahulu.');const base64=await sponsorImageJpeg(f,p.kind);
    await api('sponsorUpload',{id:p.id,kind:p.kind,mime:'image/jpeg',base64});toast('Imej sponsor disimpan.');return sponsorPage();}
   if(kind==='sponsorEventAttach'){await api('sponsorEventAttach',values(form));toast('Sponsor dikaitkan dengan event.');return adminEvent(state.event?.id);}
   return originalHandleForm(form);
  };
  renderNav();
})();
/* PZC PHOTO WALL v2.7 — STAGING / UI ONLY
 * Append once to the END of existing Client.html, AFTER Media Manager and all other addons.
 * Preserves working media API, Drive permissions, uploads, cover/poster and existing albums.
 */
(function () {
  'use strict';
  if (window.__PZC_PHOTO_WALL_V27__) return;
  if (typeof mediaAlbums !== 'function' || typeof mediaOpenGallery !== 'function' ||
      typeof home !== 'function' || typeof api !== 'function' || typeof $ !== 'function') {
    console.warn('PZC Photo Wall requires the existing Media Manager v2.2.');
    return;
  }
  window.__PZC_PHOTO_WALL_V27__ = true;

  const css = document.createElement('style');
  css.id = 'pzc-photo-wall-v27-css';
  css.textContent = `
    /* Album index: easy to scan, with a preview strip on each card. */
    #screen .pzc-album-index .eventCard { min-width:0; overflow:hidden; }
    #screen .pzc-album-previews { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; margin:12px 0; }
    #screen .pzc-album-previews img { width:100%; aspect-ratio:1; object-fit:cover; display:block; border-radius:8px; background:#0b1f16; }
    #screen .pzc-album-empty { background:#0b1f16; color:#bdcfc1; border-radius:8px; min-height:80px; padding:18px 8px; text-align:center; font-size:12px; }
    #screen .pzc-photo-wall { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    #screen .pzc-photo-wall > article.panel { padding:6px; margin:0; min-width:0; overflow:hidden; border-radius:12px; }
    #screen .pzc-photo-wall > article.panel > div:first-child { position:relative; aspect-ratio:1 !important; border-radius:8px !important; overflow:hidden; }
    #screen .pzc-photo-wall > article.panel > div:first-child img { object-fit:cover !important; }
    #screen .pzc-photo-wall > article.panel > p { display:none; }
    #screen .pzc-photo-wall > article.panel .actions { margin-top:6px; display:flex; flex-wrap:wrap; gap:4px; }
    #screen .pzc-photo-wall > article.panel .actions .btn { padding:5px 8px; font-size:11px; }
    #screen .pzc-photo-open { position:absolute; inset:0; width:100%; height:100%; background:transparent; border:0; cursor:zoom-in; z-index:2; }
    #screen .pzc-photo-open:focus-visible { outline:3px solid #baf36c; outline-offset:-3px; }
    #screen .pzc-album-shortcut { margin-left:5px; }
    @media(max-width:950px) { #screen .pzc-photo-wall { grid-template-columns:repeat(3,minmax(0,1fr)); } }
    @media(max-width:580px) { #screen .pzc-photo-wall { grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; } }
  `;
  document.head.appendChild(css);

  function addButton(host, text, action, id) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn alt pzc-album-shortcut';
    b.textContent = text;
    b.dataset.act = action;
    b.dataset.id = id;
    host.appendChild(b);
    return b;
  }

  // Shortcut from Home: the existing 'nav' action keeps member login/privacy intact.
  const previousHome = home;
  home = async function (...args) {
    const result = await previousHome.apply(this, args);
    if (state.self?.member?.status !== 'APPROVED') return result;
    const actions = $('screen')?.querySelector('.hero .actions');
    if (actions && !actions.querySelector('.pzc-album-shortcut')) {
      addButton(actions, '📸 Foto Album', 'nav', 'gallery');
    }
    return result;
  };

  // One-tap shortcut from each Event Detail, near the top of the page.
  if (typeof eventDetail === 'function') {
    const previousEventDetail = eventDetail;
    eventDetail = async function (...args) {
      const result = await previousEventDetail.apply(this, args);
      const eventId = String(args[0] || state.event?.id || '');
      const hero = $('screen')?.querySelector('.hero');
      if (hero && eventId && !hero.querySelector('.pzc-album-shortcut')) {
        addButton(hero, '📸 Terus ke Foto Album', 'mediaOpen', eventId);
      }
      return result;
    };
  }

  // Show small previews on the existing album selection page. No public Drive URLs.
  const previousAlbums = mediaAlbums;
  mediaAlbums = async function (...args) {
    const result = await previousAlbums.apply(this, args);
    const screen = $('screen');
    if (!screen) return result;
    const grid = screen.querySelector('.grid');
    if (grid) grid.classList.add('pzc-album-index');
    const buttons = Array.from(screen.querySelectorAll('button[data-act="mediaOpen"]'));

    // Only fetch up to six album previews to avoid excessive Apps Script calls.
    buttons.slice(0, 6).forEach(button => {
      const card = button.closest('article');
      const eventId = button.dataset.id;
      if (!card || !eventId || card.querySelector('.pzc-album-previews')) return;
      const preview = document.createElement('div');
      preview.className = 'pzc-album-previews';
      preview.setAttribute('aria-label', 'Pratonton foto album');
      card.insertBefore(preview, button);

      // Render progressively without blocking navigation.
      void (async () => {
        const data = await api('mediaList', { event_id: eventId, kind: 'GALLERY', offset: 0, limit: 3 });
        if (!preview.isConnected) return;
        if (!data.items?.length) {
          preview.className = 'pzc-album-empty';
          preview.textContent = '📷 Belum ada foto';
          return;
        }
        const thumbs = await api('mediaThumbs', { ids: data.items.map(item => item.id) });
        if (!preview.isConnected) return;
        for (const photo of thumbs) {
          const image = document.createElement('img');
          image.loading = 'lazy';
          image.alt = 'Pratonton foto ride';
          image.src = photo.dataUri;
          preview.appendChild(image);
        }
        const count = document.createElement('div');
        count.className = 'small muted';
        count.textContent = data.total + ' foto dalam album';
        preview.after(count);
      })().catch(err => console.warn('Album preview unavailable:', err));
    });
    return result;
  };

  // Turn the existing album detail into a compact photo wall. All actions remain intact.
  const previousOpenGallery = mediaOpenGallery;
  mediaOpenGallery = async function (...args) {
    const result = await previousOpenGallery.apply(this, args);
    const screen = $('screen');
    const grid = screen?.querySelector('#ztgMediaCards');
    if (!grid) return result;
    grid.classList.add('pzc-photo-wall');

    for (const card of grid.querySelectorAll('article.panel')) {
      const img = card.querySelector('img[data-media-thumb]');
      if (!img || card.querySelector('.pzc-photo-open')) continue;
      const frame = img.parentElement;
      if (!frame) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pzc-photo-open';
      b.dataset.act = 'mediaView';
      b.dataset.id = img.dataset.mediaThumb;
      b.setAttribute('aria-label', 'Lihat foto saiz besar');
      frame.appendChild(b);
    }

    // Put photo grid before Upload form: visitors see photos immediately.
    const uploadForm = screen.querySelector('form[data-form="mediaUpload"]');
    const uploadPanel = uploadForm?.closest('section.panel');
    const more = screen.querySelector('#ztgMediaMore');
    if (uploadPanel && more && uploadPanel.parentNode === more.parentNode &&
        uploadPanel.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING) {
      more.after(uploadPanel);
    }
    return result;
  };
  console.info('PZC Photo Wall v2.7 active (UI only).');
})();
/* ===========================================================================
   PZC HUB - PRODUCTION UI / DESIGN LAYER v3.0 (STAGING FIRST)
   Paste ONLY ONCE at END of existing Apps Script Client.html.
   No backend changes. No new API calls. Do not remove existing addons.
   Personal data never embedded here: data is read from the running app.

   Photo settings for the STAGING visual test:
   - City: Ezry Abdul Rahman / Wikimedia Commons / CC BY 2.0
   - Bike: Zontes official web-hosted 368G photograph. Replace with your own
     properly licensed community bike photo before public production launch.
   =========================================================================== */
(function () {
  'use strict';
  if (window.__PZC_PRODUCTION_UI_V3__) return;
  if (typeof home !== 'function' || typeof renderNav !== 'function' ||
      typeof renderAuth !== 'function' || typeof esc !== 'function') {
    console.warn('PZC UI v3 requires the working PZC Client.html.');
    return;
  }
  window.__PZC_PRODUCTION_UI_V3__ = true;

  // REPLACE THESE TWO LINKS WITH APPROVED PHOTOS BEFORE PRODUCTION.
  // Use HTTPS URLs that can load as ordinary <img> without login.
  const MEDIA = Object.freeze({
    putrajayaPhoto: 'https://upload.wikimedia.org/wikipedia/commons/8/84/Iron_mosque_Putrajaya_at_night_2011.jpg',
    zontes368gPhoto: 'https://www.sharpon.com/Tayoimg/DRP/DRPProducts/DRPPageIMG/2025368G/2025368G_004N2.jpg'
  });

  const style = document.createElement('style');
  style.id = 'pzc-production-ui-v3-style';
  style.textContent = String.raw`
    /* Global shell: visual changes only. Avoid touching forms, modals, media. */
    body.pzc-premium { --lime:#c1ff4d; --bg:#061911; --surface:#102a1d;
      --surface2:#173b28; --line:#2b5740; --sub:#b3c6b8; background:#061911;
      font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Arial,sans-serif; }
    body.pzc-premium .layout { background:
       radial-gradient(ellipse at 80% 0%,rgba(121,231,51,.055),transparent 45%),#061911; }
    body.pzc-premium .sidebar { width:244px; background:
       linear-gradient(175deg,#07180f 0%,#0b2919 72%,#07190e 100%);
       border-right:1px solid #2b4c35; box-shadow:5px 0 35px rgba(0,0,0,.10); }
    body.pzc-premium .brand { padding:8px 8px 28px; gap:11px; }
    body.pzc-premium .brand .logo { border-radius:15px; background:#112b1a;
       box-shadow:inset 0 0 18px #2c5b1e,0 0 23px #8cec2b13; }
    body.pzc-premium .brand b { color:#fff; font-size:12px; letter-spacing:.35px;
       line-height:1.25; max-width:150px; }
    body.pzc-premium .brand small { font-size:9.3px;letter-spacing:.9px;color:#b7e59c; }
    body.pzc-premium .sidebar nav button { border:1px solid transparent; border-radius:12px;
       padding:11px 12px; transition:background .17s,border-color .17s,color .17s; }
    body.pzc-premium .sidebar nav button.active { background:linear-gradient(100deg,#baf945,#36663b);
       color:#102514;box-shadow:0 6px 22px #baf94529; }
    body.pzc-premium .sidebar nav button:hover:not(.active) { background:#173b28;border-color:#376a41; }
    body.pzc-premium .shell { min-width:0; }
    body.pzc-premium .topbar { padding:18px clamp(16px,2.7vw,38px);
       background:linear-gradient(100deg,#0a2317,#07190f);
       border-bottom:1px solid #244b34; }
    body.pzc-premium .topbar h1 { font-size:24px; letter-spacing:-.7px; }
    body.pzc-premium .topbar small { color:#acdc81; }
    body.pzc-premium .content { width:min(1530px,100%);
       padding:23px clamp(14px,2vw,30px) 85px; }
    body.pzc-premium .panel { box-shadow:0 9px 30px #00000013; }
    body.pzc-premium .btn { transition:filter .15s,transform .15s; }
    body.pzc-premium .btn:hover:not(:disabled) { filter:brightness(1.09);transform:translateY(-1px); }

    /* Hero: a real photo of Putrajaya, plus separately sourced real Zontes 368G. */
    #screen .pzc-v3-hero { position:relative;isolation:isolate;min-height:390px;
       overflow:hidden;border:1px solid #638e50;border-radius:21px;
       margin:0 0 15px;padding:0;background:#10291c;box-shadow:0 14px 45px #0006,0 0 0 1px #99df5330; }
    #screen .pzc-v3-hero-backdrop { position:absolute;inset:0;z-index:-2;
       background-size:cover;background-position:center 45%;opacity:.76; }
    #screen .pzc-v3-hero::before { content:"";position:absolute;inset:0;z-index:-1;
       background:linear-gradient(90deg,#071b13 0%,rgba(7,27,18,.97) 22%,
       rgba(7,27,18,.78) 48%,rgba(7,27,18,.25) 90%),
       linear-gradient(0deg,#071b13 0%,transparent 40%); }
    #screen .pzc-v3-hero-copy { position:relative;z-index:2;width:61%;min-width:0;
       padding:35px clamp(22px,3vw,46px); }
    #screen .pzc-v3-hero-copy .kicker { color:#c5f58a;letter-spacing:2.1px; }
    #screen .pzc-v3-hero-wordmark { font-size:clamp(48px,5.8vw,78px);
       line-height:1;font-weight:950;letter-spacing:-4px;font-style:italic;
       color:#fff;text-shadow:0 8px 19px #0009;margin:12px 0 14px; }
    #screen .pzc-v3-hero-wordmark em { color:#c1ff4d;font-style:italic; }
    #screen .pzc-v3-hero h2 { margin:5px 0 12px;max-width:650px;
       line-height:1.05;font-size:clamp(24px,3vw,39px);font-style:italic;
       letter-spacing:-.7px;font-weight:900;color:white; }
    #screen .pzc-v3-hero h2 span { color:#c1ff4d; }
    #screen .pzc-v3-hero p { max-width:460px;font-size:14px;line-height:1.65;
       color:#d2dfd4;margin:0 0 21px; }
    #screen .pzc-v3-hero .actions { margin-top:12px;gap:9px; }
    #screen .pzc-v3-hero .actions button { font-size:13px; }
    #screen .pzc-v3-hero-bike { position:absolute;z-index:1;right:22px;top:29px;
       width:42%;height:calc(100% - 58px);overflow:hidden;border-radius:18px;
       border:1px solid #84b7655c;background:
       linear-gradient(140deg,rgba(47,104,53,.75),rgba(5,29,22,.85));
       box-shadow:0 12px 38px #0008,inset 0 0 0 1px #ffffff15; }
    #screen .pzc-v3-hero-bike::after { content:"";pointer-events:none;
       position:absolute;inset:0;background:linear-gradient(0deg,#061910ba,transparent 48%); }
    #screen .pzc-v3-hero-bike img { width:100%;height:100%;display:block;
       object-fit:cover;object-position:55% center; }
    #screen .pzc-v3-hero-bike-label { position:absolute;z-index:2;bottom:15px;left:17px;
       font-size:clamp(15px,1.7vw,24px);font-style:italic;font-weight:950;
       color:#f4ffe8;letter-spacing:1px;text-shadow:0 3px 9px #000; }
    #screen .pzc-v3-hero-bike-label span { color:#c1ff4d; }
    #screen .pzc-v3-hero-credit { font-size:9px;color:#a4b9aa;position:absolute;
       bottom:8px;left:clamp(22px,3vw,46px);z-index:3; }
    #screen .pzc-v3-hero-credit a { color:#badba5; }

    /* Feature cards and quick actions */
    #screen .pzc-v3-grid { display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) 190px;
       gap:12px;margin:0 0 17px; }
    #screen .pzc-v3-feature { text-align:left;min-height:154px;min-width:0;
       border:1px solid #416d4c;border-radius:16px;
       background:linear-gradient(155deg,#194331,#0a211a);padding:17px 15px;
       color:white;display:flex;flex-direction:column;justify-content:space-between;
       cursor:pointer;position:relative;overflow:hidden;transition:.18s; }
    #screen .pzc-v3-feature::after { content:"";position:absolute;
       width:145px;height:145px;right:-75px;top:-75px;border-radius:100%;
       background:radial-gradient(circle,#b7fc452e,transparent 70%); }
    #screen .pzc-v3-feature:hover { transform:translateY(-3px);border-color:#a6f158;box-shadow:0 11px 25px #0005; }
    #screen .pzc-v3-feature svg { width:27px;height:27px;stroke:#c1ff4d;stroke-width:1.8;
       fill:none;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0; }
    #screen .pzc-v3-feature strong { display:block;font-size:16px;line-height:1.18;
       letter-spacing:-.2px;margin:8px 0 4px; }
    #screen .pzc-v3-feature small { color:#c0d2c4;line-height:1.4;font-size:11px; }
    #screen .pzc-v3-quick { border:1px solid #42694a;border-radius:16px;
       background:linear-gradient(155deg,#0d291b,#143a22);padding:14px;
       min-width:0; }
    #screen .pzc-v3-quick h3 { font-size:13px;margin:0 0 9px;color:#efffe6; }
    #screen .pzc-v3-quick button { display:flex;align-items:center;gap:6px;width:100%;
       padding:7px 9px;margin-top:6px;text-align:left;border:1px solid #436d51;
       border-radius:8px;color:#e6f0e6;background:#123322;font-size:11px;cursor:pointer; }
    #screen .pzc-v3-quick button:hover { border-color:#b9f371;color:#c1ff4d; }
    #screen .pzc-v3-quick b { color:#c1ff4d; }
    #screen .pzc-v3-section-title { font-size:14px;letter-spacing:.4px;font-weight:850;
       color:#e4f4e8;margin:12px 0 10px;display:flex;gap:9px;align-items:center; }
    #screen .pzc-v3-section-title::before { content:"";width:4px;height:17px;
       background:#c1ff4d;border-radius:5px; }
    #screen .pzc-v3-stats { margin-bottom:13px;grid-template-columns:repeat(4,minmax(0,1fr)); }
    #screen .pzc-v3-stats .stat { padding:14px 17px;border-radius:13px; }
    #screen .pzc-v3-stats .stat strong { font-size:24px; }
    #screen .pzc-v3-events .eventCard { background:#112c20;border-color:#2e6141; }

    /* Login is re-skinned, not rebuilt: Firebase and forms are untouched. */
    #screen .auth.pzc-v3-auth { border-color:#63834e;overflow:hidden;
       background:linear-gradient(90deg,#081a13ee,#092419d9),
       linear-gradient(160deg,#082b1f,#143e28);box-shadow:0 13px 36px #0004; }
    #screen .auth.pzc-v3-auth h2 { color:#d0ff85;letter-spacing:-.5px; }
    #screen .auth.pzc-v3-auth::before { content:'PZC HUB  /  ONE RIDE · ONE CREW';
       display:block;letter-spacing:2px;color:#baf37e;font-weight:800;
       font-size:10px;margin:0 0 14px; }

    @media (max-width:1190px) {
      #screen .pzc-v3-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
      #screen .pzc-v3-quick { grid-column:1/-1;display:grid;
         grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;align-items:center; }
      #screen .pzc-v3-quick h3 { grid-column:1/-1;margin:0; }
      #screen .pzc-v3-quick button { margin:0; }
    }
    @media (max-width:800px) {
      body.pzc-premium .content { padding:13px 12px 115px; }
      body.pzc-premium .topbar { padding:12px 15px; }
      body.pzc-premium .topbar h1 { font-size:20px; }
      body.pzc-premium .mobileNav { overflow-x:auto;justify-content:flex-start; }
      body.pzc-premium .mobileNav button { flex:0 0 auto;width:auto;min-width:61px; }
      body.pzc-premium .mobileNav button.active { background:#32613b;color:#c1ff4d; }
      #screen .pzc-v3-hero { min-height:0; }
      #screen .pzc-v3-hero-copy { width:100%;padding:23px 18px 210px; }
      #screen .pzc-v3-hero::before { background:
         linear-gradient(180deg,#071b13ed 0%,#071b13c9 53%,#071b132b 100%); }
      #screen .pzc-v3-hero-wordmark { font-size:52px;letter-spacing:-2px;margin:7px 0 10px; }
      #screen .pzc-v3-hero h2 { font-size:26px; }
      #screen .pzc-v3-hero p { font-size:12px;max-width:420px; }
      #screen .pzc-v3-hero-bike { width:calc(100% - 36px);height:190px;left:18px;
          right:18px;bottom:12px;top:auto;border-radius:12px; }
      #screen .pzc-v3-hero-credit { bottom:208px;left:18px; }
      #screen .pzc-v3-grid { grid-template-columns:repeat(2,minmax(0,1fr));gap:9px; }
      #screen .pzc-v3-feature { min-height:129px;padding:13px 12px; }
      #screen .pzc-v3-feature strong { font-size:14px; }
      #screen .pzc-v3-feature small { font-size:10px; }
      #screen .pzc-v3-quick { grid-column:1/-1;grid-template-columns:repeat(2,minmax(0,1fr)); }
      #screen .pzc-v3-stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
    }
    @media (max-width:360px) {
      #screen .pzc-v3-hero-copy { padding-bottom:194px; }
      #screen .pzc-v3-hero-bike { height:174px; }
      #screen .pzc-v3-hero-credit { bottom:191px; }
      #screen .pzc-v3-hero-wordmark { font-size:45px; }
      #screen .pzc-v3-hero .actions button { font-size:11px;padding:8px; }
    }
    @media (prefers-reduced-motion:reduce) {
      #screen .pzc-v3-feature,body.pzc-premium .btn { transition:none; }
    }
  `;
  document.head.appendChild(style);

  function svg(kind) {
    const paths = {
      members: '<circle cx="9" cy="8" r="3"/><path d="M2.5 20v-2a6.5 6.5 0 0 1 13 0v2"/><path d="M16 5a3 3 0 0 1 0 6m1.5 3a5 5 0 0 1 4 5v1"/>',
      events: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 2v6m8-6v6M3 11h18m-12 5h2"/>',
      gallery: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.3"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
      sponsors: '<path d="m3 7 4-3 4 3 3-2 7 6-4 4-5-2-4 3-6-5z"/><path d="m8 16 4 4 3-3m-5-8 4 4"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[kind] || '') + '</svg>';
  }

  function chrome() {
    document.body.classList.add('pzc-premium');
    document.title = 'PZC Hub | Putrajaya Zontes Community';
    const brand = document.querySelector('.sidebar .brand');
    if (brand) {
      const name = brand.querySelector('b');
      const tagline = brand.querySelector('small');
      if (name) name.textContent = 'PUTRAJAYA ZONTES COMMUNITY';
      if (tagline) tagline.textContent = 'PZC HUB · PZC CLUBOS v2.0';
    }
    const topSmall = document.querySelector('.topbar small');
    if (topSmall) topSmall.textContent = 'ONE RIDE · ONE CREW · MANY JOURNEYS';
  }

  function authDecoration() {
    chrome();
    const box = document.querySelector('#screen .auth.hero');
    if (box) {
      box.classList.add('pzc-v3-auth');
      const title = box.querySelector('h2');
      if (title) title.textContent = 'Putrajaya Zontes Community';
    }
  }

  function feature(id, icon, title, subtitle) {
    return '<button type="button" class="pzc-v3-feature" data-act="nav" data-id="' + id + '">' +
      svg(icon) + '<span><strong>' + title + '</strong><small>' + subtitle + '</small></span></button>';
  }

  function homeDecoration() {
    chrome();
    const member = state.self && state.self.member;
    if (!member || member.status !== 'APPROVED' || state.view !== 'home') return;
    const screen = document.getElementById('screen');
    const hero = screen && screen.querySelector('section.panel.hero');
    if (!hero || screen.querySelector('.pzc-v3-grid')) return;
    const callsign = esc(member.callsign || 'Rider');
    const memberNumberDisplay = esc(memberNo(member.member_no) || '—');
    const year = new Date().getFullYear();
    hero.classList.add('pzc-v3-hero');
    hero.innerHTML = `
      <div class="pzc-v3-hero-backdrop"></div>
      <div class="pzc-v3-hero-copy">
        <div class="kicker">PUTRAJAYA ZONTES COMMUNITY · MEMBER ${memberNumberDisplay}</div>
        <div class="pzc-v3-hero-wordmark">PZC <em>Hub</em></div>
        <h2>Ride Together.<br><span>Build the Community.</span></h2>
        <p>Salam ${callsign}! Selamat datang ke komuniti kita. Satu identiti kekal — banyak ride, cerita dan kenangan.</p>
        <div class="actions">
          <button type="button" class="btn" data-act="nav" data-id="events">Jelajah Ride →</button>
          <button type="button" class="btn alt" data-act="nav" data-id="gallery">📷 Foto Album</button>
          <button type="button" class="btn gray" data-act="nav" data-id="profile">Kad Ahli</button>
        </div>
      </div>
      <div class="pzc-v3-hero-bike"><img alt="Zontes 368G sebenar, sumber fotografi Zontes" loading="eager"><div class="pzc-v3-hero-bike-label">ZONTES <span>368G</span></div></div>
      <div class="pzc-v3-hero-credit">Putrajaya: <a href="https://commons.wikimedia.org/wiki/File:Iron_mosque_Putrajaya_at_night_2011.jpg" target="_blank" rel="noopener noreferrer">Ezry Abdul Rahman / CC BY 2.0</a> · Foto Zontes untuk STAGING</div>`;
    const bg = hero.querySelector('.pzc-v3-hero-backdrop');
    if (bg) bg.style.backgroundImage = 'url("' + MEDIA.putrajayaPhoto + '")';
    const motorcycle = hero.querySelector('.pzc-v3-hero-bike img');
    if (motorcycle) {
      motorcycle.addEventListener('error', function () {
        this.style.display = 'none'; // Keep attractive gradient if source blocks hotlink.
      }, { once: true });
      motorcycle.src = MEDIA.zontes368gPhoto;
    }

    const tiles = document.createElement('section');
    tiles.className = 'pzc-v3-grid';
    tiles.setAttribute('aria-label','Pintasan PZC Hub');
    tiles.innerHTML =
      feature('members','members','Crew Directory','Kenali ahli dan komuniti PZC.') +
      feature('events','events','Ride Events','Ride, TTS dan acara bersama.') +
      feature('gallery','gallery','Photo Gallery','Terus ke album dan foto ride.') +
      feature('sponsors','sponsors','Sponsors','Rakan niaga komuniti kita.') +
      `<aside class="pzc-v3-quick"><h3>⚡ Quick Actions</h3>
        <button type="button" data-act="nav" data-id="profile"><b>＋</b> My Profile</button>
        <button type="button" data-act="nav" data-id="spot"><b>⌖</b> SPOT ME!!</button>
        <button type="button" data-act="nav" data-id="chat"><b>☷</b> Crew Chat</button>
        <button type="button" data-act="nav" data-id="${typeof isAdmin==='function' && isAdmin()?'admin':'events'}"><b>✦</b> ${typeof isAdmin==='function' && isAdmin()?'Admin Centre':'Explore Rides'}</button>
      </aside>`;
    hero.after(tiles);

    const stats = screen.querySelector('.stats');
    if (stats) {
      stats.classList.add('pzc-v3-stats');
      const label = document.createElement('div');
      label.className = 'pzc-v3-section-title';
      label.textContent = 'My Crew Dashboard';
      stats.before(label);
    }
    const h2 = Array.from(screen.querySelectorAll('h2')).find(x=>/Upcoming|Active|Akan Datang/i.test(x.textContent||''));
    if (h2 && !h2.classList.contains('pzc-v3-section-title')) h2.classList.add('pzc-v3-section-title');
    console.info('PZC Hub premium v3 dashboard active.',year);
  }

  const originalNav = renderNav;
  renderNav = function (...args) {
    const result = originalNav.apply(this,args);
    chrome();
    return result;
  };
  const originalAuth = renderAuth;
  renderAuth = function (...args) {
    const result = originalAuth.apply(this,args);
    authDecoration();
    return result;
  };
  const originalHome = home;
  home = async function (...args) {
    const result = await originalHome.apply(this,args);
    homeDecoration();
    return result;
  };
  chrome();
  authDecoration();
})();



