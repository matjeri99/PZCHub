/** PZC Hub add-on v1.2: public event, guest review, CSV and print/PDF.
 * Load AFTER js/app.js, without changing original Firebase/login logic.
 */
(()=>{'use strict';
  const API_BASE='https://pzc-public-events.matjeri99.workers.dev'; // Worker awam PZC
  const SHARE_BASE='https://pzc-public-events.matjeri99.workers.dev'; // pautan kongsi event
  const api=String(API_BASE).replace(/\/$/,'');
  const shareBase=String(SHARE_BASE).replace(/\/$/,'');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getState=()=>{try{return typeof state!=='undefined'?state:null;}catch(_){return null;}};
  const validId=id=>/^[A-Za-z0-9_-]{1,100}$/.test(id||'');
  const deepId=new URLSearchParams(location.search).get('event');
  let deepConsumed=false,busyPanel=false;
  async function call(path,{method='GET',body=null}={}){
    const token=getState()?.idToken;
    if(!token)throw Error('Log masuk diperlukan');
    const r=await fetch(api+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'Permintaan tidak berjaya');return j.data;
  }
  function small(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
  function settingField(label,type,name,defaultValue){
    const wrap=document.createElement('label');wrap.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:14px;padding:7px 0';
    wrap.appendChild(small('span',label));const inp=document.createElement('input');inp.type=type;inp.name=name;
    if(type==='checkbox')inp.checked=!!defaultValue;
    else{inp.value=defaultValue??'';inp.style.cssText='max-width:64%;min-width:120px';}
    wrap.appendChild(inp);return wrap;
  }
  function makeCard(){const section=document.createElement('section');section.className='panel pzc-public-admin-card';section.style.marginTop='18px';return section;}
  function shareEvent(e){
    const link=shareBase?`${shareBase}/e/${encodeURIComponent(e.id)}`:`https://pzchub.com/event/?id=${encodeURIComponent(e.id)}`;
    const text=`🏍️ Jom ride bersama PZC!\n${e.title||'Event PZC'}\nJom tambah kenalan dan eratkan silaturahim!\n${link}`;
    window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');
  }
  // CSV formula injection prevention (avoid spreadsheet-executable user input).
  function csvCell(value){
    let s=String(value??'').replace(/\u0000/g,'');
    if(/^\s*[=+@-]/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function csvDownload(rows,id){
    const fields=[['reference','No. Rujukan'],['submitted_at','Tarikh Mohon'],['name','Nama / Callsign'],['phone','WhatsApp'],['motorcycle','Motosikal'],['pillion','Pillion'],['status','Status'],['message','Catatan']];
    const csv='\uFEFF'+fields.map(f=>csvCell(f[1])).join(',')+'\r\n'+rows.map(g=>fields.map(f=>csvCell(g[f[0]])).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const href=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=href;a.download='PZC_GUEST_'+id+'_'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1200);
  }
  function printRegister(rows,id,title){
    const w=window.open('','_blank');if(!w){alert('Popup disekat. Benarkan popup untuk mencetak / menyimpan PDF.');return;}
    const columns=[['reference','Rujukan'],['name','Nama / Callsign'],['phone','WhatsApp'],['motorcycle','Motosikal'],['pillion','Pillion'],['status','Status']];
    const lines=rows.map((g,i)=>'<tr><td>'+String(i+1)+'</td>'+columns.map(([key])=>'<td>'+esc(g[key])+'</td>').join('')+'</tr>').join('');
    const stamp=new Date().toLocaleString('ms-MY',{timeZone:'Asia/Kuala_Lumpur'});
    const html=`<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"><title>Daftar Tetamu PZC</title><style>
      *{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#18251e;padding:22px}h1{font-size:20px;margin:0 0 6px}.sub{margin:0 0 17px;color:#56695d}.private{border:1px solid #999;padding:8px;margin-top:15px;font-size:11px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #888;padding:7px 5px;overflow-wrap:anywhere;vertical-align:top}thead{background:#e9f1eb}th{text-align:left}tr{break-inside:avoid}@page{size:A4 landscape;margin:12mm} @media screen{body{max-width:1250px;margin:auto}}
    </style></head><body><h1>PUTRAJAYA ZONTES COMMUNITY — DAFTAR TETAMU</h1>
    <p class="sub"><b>Event:</b> ${esc(title||id)} &nbsp; <b>ID:</b> ${esc(id)} &nbsp; <b>Dicetak:</b> ${esc(stamp)} &nbsp; <b>Jumlah:</b> ${rows.length}</p>
    <table><thead><tr><th style="width:38px">No.</th>${columns.map(([key,title])=>'<th>'+esc(title)+'</th>').join('')}</tr></thead><tbody>${lines||'<tr><td colspan="7">Tiada permohonan</td></tr>'}</tbody></table>
    <p class="private">SULIT DALAMAN PZC • Mengandungi nombor telefon tetamu. Untuk Admin / Captain yang diberi kuasa sahaja. Tidak boleh dikongsi kepada umum. Tetamu APPROVED tidak masuk ke Manifest ahli secara automatik.</p></body></html>`;
    w.document.open();w.document.write(html);w.document.close();w.focus();
    // Provide a manual print control: avoids timing-related automatic print failures.
    const btn=w.document.createElement('button');btn.type='button';btn.textContent='Cetak / Simpan sebagai PDF';
    btn.style.cssText='display:block;margin:0 0 16px;padding:9px 15px;border:0;border-radius:7px;background:#15462b;color:#fff;cursor:pointer';
    const style=w.document.createElement('style');style.textContent='@media print{button{display:none!important}}';w.document.head.appendChild(style);
    btn.addEventListener('click',()=>w.print());w.document.body.prepend(btn);
  }
  async function addPanel(form){
    const eventId=form.querySelector('input[name="id"]')?.value||form.dataset.eventId||String(getState()?.event?.id||'');
    if(!api||!validId(eventId)||document.querySelector('.pzc-public-admin-card'))return;
    const card=makeCard();card.append(small('h3','🌍 Public Event & Guest Requests'));
    const info=small('p','Memaparkan maklumat terpilih kepada umum. Event DRAFT tidak akan kelihatan.');info.className='small muted';card.append(info);
    const loading=small('p','Sedang membaca tetapan awam...');card.append(loading);
    form.insertAdjacentElement('afterend',card);
    try{
      const result=await call('/v1/admin/settings?event_id='+encodeURIComponent(eventId));
      if(!card.isConnected)return;
      loading.remove();const s=result.settings||{};
      const fields=document.createElement('div');fields.style.cssText='display:grid;gap:10px';
      fields.append(
        settingField('Paparkan event kepada umum','checkbox','is_public',s.is_public),
        settingField('Terima permohonan tetamu','checkbox','allow_guests',s.allow_guests),
        settingField('Lokasi UMUM (jangan isi RV tepat)','text','public_place',s.public_place),
        settingField('Ayat jemputan awam','text','public_summary',s.public_summary),
        settingField('URL poster awam (HTTPS)','url','poster_url',s.poster_url),
        settingField('Kuota tetamu (0 = tiada kuota khusus)','number','guest_quota',s.guest_quota||0)
      );
      card.append(fields);
      const output=small('p','');output.className='small';card.append(output);
      const buttons=document.createElement('div');buttons.className='actions';
      const save=small('button','Simpan Tetapan Public');save.type='button';save.className='btn';
      const open=small('a','Lihat Public Event');open.className='btn alt';open.href='https://pzchub.com/event/?id='+encodeURIComponent(eventId);open.target='_blank';open.rel='noopener';
      const share=small('button','↗ Kongsi WhatsApp');share.className='btn alt';share.type='button';
      buttons.append(save,open,share);card.append(buttons);
      save.addEventListener('click',async()=>{
        const input=n=>fields.querySelector(`[name="${n}"]`);
        const payload={event_id:eventId,is_public:input('is_public').checked,allow_guests:input('allow_guests').checked,public_place:input('public_place').value,public_summary:input('public_summary').value,poster_url:input('poster_url').value,guest_quota:Number(input('guest_quota').value||0)};
        save.disabled=true;output.textContent='Menyimpan...';
        try{await call('/v1/admin/settings',{method:'POST',body:payload});output.textContent='✅ Tetapan awam disimpan. Status event dalam Event Builder masih mesti PUBLISHED.';}
        catch(err){output.textContent='❌ '+err.message;}finally{save.disabled=false;}
      });
      share.addEventListener('click',()=>{const s=fields.querySelector('[name="is_public"]').checked;if(!s){output.textContent='Aktifkan & simpan Paparkan kepada umum dahulu.';return;}const status=form.querySelector('[name="status"]')?.value||'';if(status!=='PUBLISHED'){output.textContent='Publish event dalam Event Builder dahulu.';return;}shareEvent({id:eventId,title:result.event?.title||''});});
      const guestBox=document.createElement('div');guestBox.style.cssText='margin-top:18px;border-top:1px solid #355342;padding-top:14px';guestBox.append(small('h3','Permohonan Tetamu'));
      const refresh=small('button','Muat Semula Senarai Tetamu');refresh.className='btn gray';refresh.type='button';guestBox.append(refresh);
      // Export only after the authenticated admin API returns the event's rows.
      let cachedRows=[];
      const tools=document.createElement('div');tools.className='actions';tools.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:10px 0';
      const csvBtn=small('button','⬇ Muat Turun CSV');csvBtn.type='button';csvBtn.className='btn alt';csvBtn.disabled=true;
      const pdfBtn=small('button','🖨 Cetak / PDF');pdfBtn.type='button';pdfBtn.className='btn alt';pdfBtn.disabled=true;
      tools.append(csvBtn,pdfBtn);guestBox.append(tools);
      const stats=small('p','');stats.className='small muted';guestBox.append(stats);
      const list=document.createElement('div');guestBox.append(list);card.append(guestBox);
      csvBtn.addEventListener('click',()=>csvDownload(cachedRows,eventId));
      pdfBtn.addEventListener('click',()=>printRegister(cachedRows,eventId,result.event?.title||''));
      async function loadGuests(){list.textContent='Sedang membaca...';csvBtn.disabled=true;pdfBtn.disabled=true;try{
        const rows=await call('/v1/admin/requests?event_id='+encodeURIComponent(eventId));
        if(!Array.isArray(rows))throw Error('Format senarai tetamu tidak sah');
        cachedRows=rows;list.replaceChildren();
        csvBtn.disabled=rows.length===0;pdfBtn.disabled=rows.length===0;
        const count=s=>rows.filter(g=>g.status===s).length;
        stats.textContent=`Jumlah ${rows.length} · Pending ${count('PENDING')} · Lulus ${count('APPROVED')} · Tunggu ${count('WAITLIST')} · Tolak ${count('REJECTED')}`;
        if(!rows.length){list.textContent='Belum ada permohonan.';return;}
        for(const g of rows){const box=document.createElement('div');box.style.cssText='padding:11px 0;border-bottom:1px solid #345543';
          box.innerHTML=`<b>${esc(g.name)}</b> · <small>${esc(g.status)}</small><div class="small">${esc(g.motorcycle)} · ${esc(g.phone)} · Pillion ${Number(g.pillion)||0}</div><div class="small">Rujukan ${esc(g.reference)}</div>`;
          if(['PENDING','WAITLIST'].includes(g.status)){const act=document.createElement('div');act.className='actions';
            for(const [decision,label] of [['APPROVED','Lulus'],['WAITLIST','Senarai Tunggu'],['REJECTED','Tolak']]){
              const b=small('button',label);b.className='btn alt';b.type='button';b.addEventListener('click',async()=>{if(!confirm(label+' permohonan '+g.name+'?'))return;b.disabled=true;try{await call('/v1/admin/decide',{method:'POST',body:{event_id:eventId,reference:g.reference,decision}});await loadGuests();}catch(err){alert(err.message);}finally{b.disabled=false;}});act.append(b);
            }box.append(act);
          }list.append(box);
        }
      }catch(err){cachedRows=[];csvBtn.disabled=true;pdfBtn.disabled=true;stats.textContent='';list.textContent='Tidak boleh membaca permohonan: '+err.message;}}
      refresh.addEventListener('click',loadGuests);loadGuests();
      const note=small('p','Nota: Tetamu yang diluluskan direkod dalam Guest Register berasingan; belum dimasukkan automatik ke Manifest ahli.');note.className='small muted';card.append(note);
    }catch(err){loading.textContent='Tetapan awam belum tersedia atau akses tidak dibenarkan. '+err.message;}
  }
  function tick(){
    const s=getState();if(!s)return;
    if(!deepConsumed&&validId(deepId)&&s.self?.member?.status==='APPROVED'&&s.ready&&s.view==='home'&&document.querySelector('#screen .panel.hero')){
      deepConsumed=true;s.event={id:deepId};history.replaceState(null,'',location.pathname);
      // In-app event view remains protected and uses existing Firebase membership.
      if(typeof go==='function')go('event');
    }
    if(api&&!busyPanel){const form=document.querySelector('#screen form[data-form="editEvent"]');
      if(form&&!document.querySelector('.pzc-public-admin-card')){busyPanel=true;addPanel(form).finally(()=>{busyPanel=false;});}
    }
  }
  function start(){const screen=document.getElementById('screen');if(!screen)return;new MutationObserver(tick).observe(screen,{childList:true,subtree:true});tick();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
