/* PZC Rider ICE v1.0 UAT — addon for existing Hub. No health data in browser storage. */
(()=>{
  'use strict';
  const html=s=>esc(s==null?'':s);
  const bloodGroups=['UNKNOWN','A+','A-','B+','B-','AB+','AB-','O+','O-'];
  const oldHome=home,oldProfile=profile,oldGo=go;
  let lastIce=null;

  function icePanel(x){
    if(!isApproved())return '';
    const ready=x?.status==='ACTIVE';
    return `<section class="panel ice-promo"><div><span class="ice-eyebrow">✚ PZC RIDER ICE</span><h2>${ready?'ICE READY ✓':'Lengkapkan Rider ICE'}</h2><p>${ready?'Maklumat kecemasan anda aktif. Semak atau muat turun kod QR.':'Sediakan nombor waris dan maklumat penting bagi bantuan ketika kecemasan.'}</p></div><div class="actions"><button class="btn" data-act="iceOpen">${ready?'Buka QR Saya':'Lengkapkan Sekarang'}</button>${!ready?'<button class="btn gray" data-act="iceLater">Ingatkan Nanti</button>':''}</div></section>`;
  }
  function iceOptions(value){return bloodGroups.map(v=>`<option value="${html(v)}" ${v===value?'selected':''}>${v==='UNKNOWN'?'Tidak pasti':v}</option>`).join('');}
  async function iceLoad(){try{lastIce=await api('iceMine');return lastIce;}catch(e){console.warn('ICE belum tersedia di backend staging:',e.message);return null;}}
  home=async function(){await oldHome();if(!isApproved())return;const data=await iceLoad();if(!data)return;
    const box=$('screen');if(box){const tmp=document.createElement('div');tmp.innerHTML=icePanel(data);box.prepend(tmp.firstElementChild);}
  };
  profile=async function(){await oldProfile();if(!isApproved())return;const data=await iceLoad();if(data)$('screen').insertAdjacentHTML('afterbegin',icePanel(data));};
  go=async function(view){if(view==='ice'){
    if(!state.self)return oldGo('home');state.view='ice';renderNav();$('pageTitle').textContent='Rider ICE';
    if(!isApproved()){toast('Hanya ahli diluluskan boleh menggunakan ICE.');return oldGo('profile');}
    try{await iceScreen();}catch(e){$('screen').innerHTML=`<section class="panel"><h2>Rider ICE belum tersedia</h2><p>${html(e.message)}</p><button class="btn gray" data-act="nav" data-id="profile">Kembali</button></section>`;}return;
  }return oldGo(view);};
  async function iceScreen(){const r=await api('iceMine');lastIce=r;const v=r.data||{};const ready=r.status==='ACTIVE';
    $('screen').innerHTML=`<div class="ice-shell"><section class="ice-head"><span class="ice-eyebrow">✚ PZC HUB • RIDER ICE</span><h2>${ready?'ICE READY':'Emergency Rider Profile'}</h2><p>Maklumat ini boleh dibaca oleh sesiapa yang mengimbas QR. Isikan hanya data yang anda mahu dedahkan ketika kecemasan.</p></section>
    ${ready?`<section class="ice-qr-card"><div class="ice-ready">✓ ICE READY</div><p>QR khas untuk kad ahli dan stiker helmet/motosikal.</p><div id="iceQr" aria-label="Kod QR kecemasan"></div><div class="actions"><button class="btn" data-act="icePrint">Cetak Kad / Stiker</button><button class="btn alt" data-act="iceRotate">Ganti QR</button><a class="btn gray" href="${html(r.url)}" target="_blank" rel="noreferrer noopener">Uji Halaman QR</a></div></section>`:''}
    <section class="panel ice-form-panel"><h3>Maklumat Kecemasan</h3><form data-form="ice"><div class="formgrid">
    <div class="field"><label>Waris utama *</label><input name="waris1_name" maxlength="100" value="${html(v.waris1_name)}" required></div>
    <div class="field"><label>Telefon waris utama *</label><input name="waris1_phone" type="tel" maxlength="17" value="${html(v.waris1_phone)}" required></div>
    <div class="field"><label>Waris kedua (pilihan)</label><input name="waris2_name" maxlength="100" value="${html(v.waris2_name)}"></div>
    <div class="field"><label>Telefon waris kedua</label><input name="waris2_phone" type="tel" maxlength="17" value="${html(v.waris2_phone)}"></div>
    <div class="field"><label>Kumpulan darah (pilihan, tidak disahkan)</label><select name="blood_group">${iceOptions(v.blood_group||'UNKNOWN')}</select></div>
    </div><label class="ice-check"><input type="checkbox" name="show_medical" ${v.show_medical==='TRUE'?'checked':''}> Benarkan maklumat perubatan pilihan dipaparkan pada QR</label>
    <div class="formgrid"><div class="field"><label>Alahan serius</label><textarea name="allergies" maxlength="250" rows="2">${html(v.allergies)}</textarea></div><div class="field"><label>Keadaan kesihatan penting</label><textarea name="conditions" maxlength="250" rows="2">${html(v.conditions)}</textarea></div><div class="field"><label>Ubat penting / antikoagulan</label><textarea name="medications" maxlength="250" rows="2">${html(v.medications)}</textarea></div><div class="field"><label>Implan atau alat perubatan</label><textarea name="implants" maxlength="250" rows="2">${html(v.implants)}</textarea></div></div>
    <label class="ice-check"><input type="checkbox" name="consent" required> Saya faham bahawa sesiapa yang memiliki pautan QR boleh melihat maklumat ICE yang saya benarkan. Saya bersetuju untuk tujuan kecemasan.</label>
    <button class="btn" type="submit">Simpan & Aktifkan ICE</button></form>
    ${ready?'<hr><button class="btn red" data-act="iceDisable">Nyahaktifkan QR Saya</button>':''}
    <p class="small muted">Hubungi 999 dalam kecemasan. Kumpulan darah dan maklumat kesihatan ialah pengisytiharan ahli, bukan rekod perubatan yang disahkan.</p></section></div>`;
    if(ready)renderQr(r.url);
  }
  function renderQr(url){const target=$('iceQr');if(!target)return;
    if(!url){target.textContent='URL QR staging belum dikonfigurasi.';return;}
    if(typeof QRCode!=='function'){target.textContent='Penjana QR tidak dapat dimuatkan. Semak sambungan internet.';return;}
    new QRCode(target,{text:url,width:210,height:210,colorDark:'#092017',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
  }
  async function saveIce(form){const p=values(form);p.consent=Boolean(p.consent);p.show_medical=Boolean(p.show_medical);
    const out=await api('iceSave',p);lastIce=out;toast('Rider ICE disimpan.');await iceScreen();}
  function printIce(){if(!lastIce?.url)throw Error('Aktifkan ICE dahulu.');
    const canvas=$('iceQr')?.querySelector('canvas');const img=$('iceQr')?.querySelector('img');
    const qr=canvas?.toDataURL('image/png')||img?.src;if(!qr)throw Error('QR belum siap.');
    const m=state.profile?.member||state.self?.member||{};
    const w=window.open('','_blank');if(!w)throw Error('Benarkan pop-up untuk cetakan.');
    const content=`<!doctype html><html><head><meta name="referrer" content="no-referrer"><title>PZC ICE Print UAT</title><style>body{font-family:Arial;color:#142b1d;padding:18px}.sheet{display:flex;flex-wrap:wrap;gap:14px}.card{box-sizing:border-box;width:85.6mm;height:54mm;border:1px solid #222;border-radius:4mm;padding:5mm;background:#0c2319;color:white}.sticker{box-sizing:border-box;width:50mm;height:50mm;background:#a8ff39;color:#122414;border-radius:3mm;text-align:center;padding:3mm}.card img{width:26mm;float:right}.sticker img{width:30mm}.sub{font-size:10px}.demo{font-size:11px;color:#a00;margin-top:22px}@media print{.demo{display:none}@page{size:A4;margin:10mm}}</style></head><body><div class="sheet"><div class="card"><div class="sub">PUTRAJAYA ZONTES COMMUNITY</div><h2>${html(m.callsign||'RIDER')}</h2><p>${html(memberNo(m.member_no))}</p><img src="${qr}"><div class="sub">RIDER ICE • IMBAS KETIKA KECEMASAN</div></div><div class="sticker"><b>PZC RIDER ICE</b><br><img src="${qr}"><div class="sub">SCAN IN CASE OF EMERGENCY</div></div></div><p class="demo">UAT sahaja: cetakan mesti diuji pada saiz sebenar sebelum produksi. QR boleh diimbas oleh orang awam.</p></body></html>`;
    w.document.write(content);w.document.close();w.focus();}
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-act^="ice"]');if(!b)return;e.preventDefault();b.disabled=true;
    try{if(b.dataset.act==='iceOpen')await go('ice');else if(b.dataset.act==='iceLater'){b.closest('.ice-promo')?.remove();}
      else if(b.dataset.act==='iceDisable'){if(confirm('Nyahaktifkan paparan QR kecemasan?')){await api('iceDisable');await iceScreen();}}
      else if(b.dataset.act==='iceRotate'){if(confirm('QR lama akan berhenti berfungsi. Cetak stiker baharu?')){await api('iceRotate');await iceScreen();}}
      else if(b.dataset.act==='icePrint')printIce();}
    catch(err){toast(err.message);}finally{if(b.isConnected)b.disabled=false;}
  },true);
  document.addEventListener('submit',async e=>{const f=e.target.closest('form[data-form="ice"]');if(!f)return;e.preventDefault();e.stopImmediatePropagation();
    const b=f.querySelector('button[type="submit"]');if(b)b.disabled=true;try{await saveIce(f);}catch(err){toast(err.message);}finally{if(b?.isConnected)b.disabled=false;}
  },true);
})();
