/* PZC Hub Hero Photo Manager v2.1 - additive frontend module.
 * Requires app.js to load first and RPC routes in Apps Script Api.gs.
 */
(function(){
  'use strict';
  function safe(str){return esc(str==null?'':String(str));}
  function isStaff(){return typeof isAdmin==='function'&&isAdmin();}

  async function paintHomeHero(){
    if(!state.self?.member||state.view!=='home')return;
    const image=document.querySelector('#screen .pzc-v3-hero-bike img');
    if(!image)return;
    try{
      const current=await api('heroCurrent');
      if(state.view!=='home'||!current?.active||!current.dataUri)return;
      image.src=current.dataUri;
      image.alt=current.caption||'Gambar pilihan komuniti PZC';
      image.style.display='block';
      const label=document.querySelector('#screen .pzc-v3-hero-bike-label');
      if(label)label.textContent='FOTO KOMUNITI PZC';
      const credit=document.querySelector('#screen .pzc-v3-hero-credit');
      if(credit)credit.textContent='Foto pilihan Putrajaya Zontes Community';
    }catch(error){
      // Preserve the original image when the optional Hero endpoint is unavailable.
      console.warn('Hero Photo Manager belum tersedia:',error.message||error);
    }
  }

  async function heroManage(){
    if(!isStaff())throw Error('Akses Admin diperlukan.');
    state.view='heroManage';
    renderNav();
    $('pageTitle').textContent='Hero Photo Manager';
    busy('Memuatkan gambar komuniti...');
    const items=await api('heroList');
    const cards=items.map(item=>`<article class="panel" style="max-width:340px">
      <img src="${item.thumbDataUri}" alt="${safe(item.caption||'Hero PZC')}" style="width:100%;height:160px;object-fit:cover;border-radius:12px">
      <p class="small">${safe(item.caption||'Gambar komuniti')}</p>
      <div class="actions">
        ${item.active?'<span class="badge">GAMBAR UTAMA</span>':`<button class="btn" data-act="heroActivate" data-id="${safe(item.id)}">Jadikan Utama</button><button class="btn gray" data-act="heroHide" data-id="${safe(item.id)}">Sembunyikan</button>`}
      </div></article>`).join('');
    $('screen').innerHTML=`<section class="panel hero"><div class="kicker">ADMIN ONLY</div><h2>Hero Photo Manager</h2>
      <p>Pilih gambar komuniti untuk Home. Upload tidak menukar gambar sehingga Admin tekan Jadikan Utama.</p></section>
      <section class="panel"><h3>Upload Gambar Home</h3><form data-form="heroUpload">
        <label>Foto melintang JPG / PNG / WebP</label><input name="hero_file" type="file" accept="image/jpeg,image/png,image/webp" required>
        <label>Kapsyen / Kredit ringkas</label><input name="caption" maxlength="180" placeholder="Contoh: Ride Cameron 2026 - foto ahli PZC">
        <p class="small muted">Disyorkan 16:9. Gambar diproses dalam browser dan disimpan secara peribadi di Drive.</p>
        <div data-hero-progress aria-live="polite" class="muted small"></div><button class="btn" type="submit">Upload Gambar</button>
      </form></section>
      <section class="panel"><h3>Gambar Tersimpan (${items.length})</h3>${items.length?`<div class="grid">${cards}</div>`:'<p class="muted">Belum ada gambar Hero.</p>'}</section>
      <button class="btn gray" data-act="nav" data-id="admin">Kembali Admin Centre</button>`;
  }

  async function heroUpload(form){
    if(!isStaff())throw Error('Akses Admin diperlukan.');
    const file=form.querySelector('[name="hero_file"]')?.files?.[0];
    if(!file)throw Error('Pilih satu gambar.');
    if(file.size>12*1024*1024)throw Error('Gambar asal melebihi 12 MB.');
    const progress=form.querySelector('[data-hero-progress]');
    if(progress)progress.textContent='Memproses gambar...';
    const dimensions=await new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file),image=new Image();
      image.onload=()=>{URL.revokeObjectURL(url);resolve({w:image.naturalWidth,h:image.naturalHeight});};
      image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Tidak dapat membaca gambar.'));};
      image.src=url;
    });
    if(dimensions.w/dimensions.h<1.3||dimensions.w/dimensions.h>2.8)
      throw Error('Pilih gambar melintang. Nisbah disyorkan 16:9.');
    let base64='';
    for(const size of [1600,1280,960,720]){
      base64=await mediaFileToJpeg(file,size);
      if(Math.ceil(base64.length*3/4)<=900000)break;
    }
    if(Math.ceil(base64.length*3/4)>900000)throw Error('Gambar masih terlalu besar. Pilih gambar lain.');
    const thumbBase64=await mediaFileToJpeg(file,240);
    if(Math.ceil(thumbBase64.length*3/4)>120000)throw Error('Thumbnail terlalu besar.');
    if(progress)progress.textContent='Menyimpan ke Google Drive...';
    await api('heroUpload',{mime:'image/jpeg',base64,thumbBase64,caption:form.elements.caption.value});
    toast('Gambar disimpan. Tekan Jadikan Utama untuk paparkan kepada ahli.');
    await heroManage();
  }

  const previousAdmin=admin;
  admin=async function(...args){
    await previousAdmin.apply(this,args);
    if(isStaff()&&$('screen')){
      $('screen').insertAdjacentHTML('beforeend',`<section class="panel"><h3>Home Photo Manager</h3>
        <p class="muted">Tukar gambar utama PZC Hub tanpa edit GitHub.</p>
        <button class="btn" data-act="heroManage">Urus Gambar Home</button></section>`);
    }
  };

  const previousHome=home;
  home=async function(...args){
    await previousHome.apply(this,args);
    await paintHomeHero();
  };

  const previousAction=handleAction;
  handleAction=async function(button){
    const act=button.dataset.act,id=button.dataset.id;
    if(act==='heroManage')return heroManage();
    if(act==='heroActivate'){
      if(!confirm('Jadikan gambar ini sebagai gambar utama Home untuk semua ahli?'))return;
      await api('heroActivate',{id});toast('Gambar utama dikemas kini.');return heroManage();
    }
    if(act==='heroHide'){
      if(!confirm('Sembunyikan gambar daripada pilihan Admin?'))return;
      await api('heroHide',{id});toast('Gambar disembunyikan.');return heroManage();
    }
    return previousAction(button);
  };

  const previousForm=handleForm;
  handleForm=async function(form){
    if(form.dataset.form==='heroUpload')return heroUpload(form);
    return previousForm(form);
  };
})();
