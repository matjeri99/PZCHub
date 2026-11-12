/**
 * PZC Hub Social Sharing v1.0
 * Standalone progressive enhancement: does not touch Firebase, tokens or PZC API.
 * Event share uses verified public event details and a direct permalink.
 */
(function(){
  'use strict';
  const PUBLIC_URL='https://pzchub.com/';
  const EVENT_URL='https://pzchub.com/event/?id=';
  const EVENT_API='https://pzc-public-events.matjeri99.workers.dev/v1/events/';
  const validId=id=>/^[A-Za-z0-9_-]{1,100}$/.test(String(id||''));
  const HOME_TITLE='PZC Hub | Putrajaya Zontes Community';
  const HOME_TEXT='🏍️ Putrajaya Zontes Community\nOne Ride · One Crew · Many Journeys';
  let dialog, current={title:HOME_TITLE,text:HOME_TEXT,url:PUBLIC_URL,kind:'home'};

  function notice(text){
    const target=document.getElementById('toast');
    if(target){target.textContent=text;setTimeout(()=>{if(target.textContent===text)target.textContent='';},4000);}
  }
  function clean(s,max=140){return String(s||'').trim().replace(/\s+/g,' ').slice(0,max);}
  function eventInfo(e){
    const id=String(e.id||'');
    const direct=EVENT_URL+encodeURIComponent(id);
    const title=clean(e.title,160);
    const date=clean(String(e.start_date||'').replace('T',' · '),80);
    const location=clean(e.location,100); // Public place from API, NOT private RV
    const lines=[`🏍️ ${title}`];
    if(date)lines.push(`📅 ${date}`);
    if(location)lines.push(`📍 ${location}`);
    lines.push('Jom tambah kenalan dan eratkan silaturahim bersama PZC!');
    lines.push('Lihat butiran event dan mohon penyertaan di sini:');
    return {title,text:lines.join('\n'),url:direct,kind:'event'};
  }
  async function openVerifiedEventShare(id){
    if(!validId(id)){notice('ID event tidak dijumpai. Cuba buka butiran event dahulu.');return;}
    try{
      const res=await fetch(EVENT_API+encodeURIComponent(id),{
        method:'GET',headers:{'Accept':'application/json'},cache:'no-store'
      });
      const obj=await res.json();
      if(!res.ok||obj.ok!==true||!obj.data||obj.data.status!=='PUBLISHED'){
        throw Error('Event belum dibuka kepada umum');
      }
      openShare(eventInfo(obj.data));
    }catch(err){
      notice('Event ini belum dibuka kepada umum atau API tidak dapat dihubungi. Sila semak tetapan Public Event.');
    }
  }
  function fullText(data){return `${data.text}\n${data.url}`;}
  function socialLink(platform,data){
    const txt=encodeURIComponent(fullText(data));
    const url=encodeURIComponent(data.url);
    if(platform==='whatsapp')return `https://wa.me/?text=${txt}`;
    if(platform==='telegram')return `https://t.me/share/url?url=${url}&text=${encodeURIComponent(data.text)}`;
    if(platform==='facebook')return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    return '';
  }
  function createDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.className='pzc-share-dialog';
    dialog.setAttribute('aria-labelledby','pzc-share-heading');
    dialog.innerHTML=`<div class="pzc-share-dialog-header"><h2 id="pzc-share-heading">Kongsi PZC Hub</h2><button class="pzc-share-close" type="button" aria-label="Tutup">×</button></div>
      <p id="pzc-share-excerpt"></p>
      <div class="pzc-share-options">
        <button type="button" class="pzc-native-share" data-share="native">↗ Kongsi melalui telefon</button>
        <button type="button" data-share="whatsapp">WhatsApp</button>
        <button type="button" data-share="facebook">Facebook</button>
        <button type="button" data-share="telegram">Telegram</button>
        <button type="button" data-share="copy">Salin Pautan</button>
      </div><p class="pzc-share-note" id="pzc-share-note"></p>`;
    document.body.appendChild(dialog);
    dialog.querySelector('.pzc-share-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
    dialog.addEventListener('click',async e=>{
      const btn=e.target.closest('button[data-share]');
      if(!btn)return;
      const mode=btn.dataset.share;
      if(mode==='native'){
        if(!navigator.share){notice('Telefon / pelayar tidak menyokong menu kongsi. Pilih aplikasi di bawah.');return;}
        try{await navigator.share({title:current.title,text:current.text,url:current.url});dialog.close();}
        catch(err){if(err?.name!=='AbortError')notice('Gagal membuka menu kongsi. Pilih aplikasi di bawah.');}
      }else if(mode==='copy'){
        try{
          if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(fullText(current));
          else{
            const area=document.createElement('textarea');area.value=fullText(current);area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();
            const ok=document.execCommand('copy');area.remove();if(!ok)throw Error('copy unavailable');
          }
          dialog.close();notice('Teks dan pautan berjaya disalin.');
        }catch(_){notice('Tidak dapat menyalin. Cuba menu kongsi telefon.');}
      }else{
        const url=socialLink(mode,current);
        if(url)window.open(url,'_blank','noopener,noreferrer');
      }
    });
    return dialog;
  }
  function openShare(data){
    current=data||{title:HOME_TITLE,text:HOME_TEXT,url:PUBLIC_URL,kind:'home'};
    const d=createDialog();
    d.querySelector('#pzc-share-heading').textContent=current.kind==='event'?'Kongsi Event':'Kongsi PZC Hub';
    d.querySelector('#pzc-share-excerpt').textContent=current.title;
    d.querySelector('#pzc-share-note').textContent=current.kind==='event'
      ? 'Pautan ini terus ke halaman event awam. Preview WhatsApp menggunakan metadata umum sehingga pautan preview khas Worker dipilih.'
      : 'Penerima akan melihat tajuk dan gambar preview PZC Hub apabila platform memuat semula Open Graph.';
    const nativeButton=d.querySelector('[data-share="native"]');
    nativeButton.hidden=!navigator.share;
    if(!d.open)d.showModal();
  }
  function addHomeButton(){
    const header=document.querySelector('.topbar');
    const badge=document.getElementById('accountBadge');
    if(!header||!badge||header.querySelector('.pzc-share-trigger'))return;
    const button=document.createElement('button');
    button.type='button';button.className='pzc-share-trigger';
    button.innerHTML='<span class="pzc-share-icon" aria-hidden="true">↗</span> Kongsi Hub';
    button.setAttribute('aria-label','Kongsi PZC Hub ke media sosial');
    button.addEventListener('click',()=>openShare({title:HOME_TITLE,text:HOME_TEXT,url:PUBLIC_URL,kind:'home'}));
    header.insertBefore(button,badge);
  }
  function detailsFromCard(card){
    const title=clean(card.querySelector('h3')?.textContent);
    const lines=[...card.querySelectorAll('.small')].map(n=>n.textContent.trim());
    const date=clean((lines.find(s=>s.includes('📅'))||'').replace('📅',''),80);
    const location=clean((lines.find(s=>s.includes('📍'))||'').replace('📍',''),100);
    return {title,date,location};
  }
  function addEventButtons(){
    const screen=document.getElementById('screen');
    if(!screen)return;
    for(const card of screen.querySelectorAll('.eventCard')){
      if(card.querySelector('.pzc-event-share'))continue;
      const badges=[...card.querySelectorAll('.badge')].map(n=>n.textContent.trim().toUpperCase());
      if(!badges.includes('PUBLISHED'))continue; // do not share drafts, closed or private events
      const action=card.querySelector('[data-act="event"]');
      if(!action)continue;
      const eventId=action.dataset.id;
      if(!validId(eventId))continue;
      const btn=document.createElement('button');
      btn.type='button';btn.className='pzc-event-share';btn.textContent='↗ Kongsi Event';
      btn.addEventListener('click',()=>openVerifiedEventShare(eventId));
      const actions=action.closest('.actions');
      if(actions)actions.appendChild(btn);
      else action.insertAdjacentElement('afterend',btn);
    }
    // Detailed event view, never share roster or member details.
    const hero=screen.querySelector(':scope > .panel.hero');
    if(hero&&!hero.querySelector('.pzc-event-share')){
      const kicker=hero.querySelector('.kicker')?.textContent||'';
      if(/\bPUBLISHED\b/i.test(kicker)&&/\b(RIDE|MERCH|TTS|DINNER|EVENT)\b/i.test(kicker)){
        const title=clean(hero.querySelector('h2')?.textContent);
        const badges=[...hero.querySelectorAll('.badge')].map(x=>x.textContent.trim());
        const date=clean((badges.find(x=>x.includes('📅'))||'').replace('📅',''),80);
        const location=clean((badges.find(x=>x.includes('📍'))||'').replace('📍',''),100);
        if(title){
          const btn=document.createElement('button');btn.type='button';
          btn.className='pzc-event-share pzc-event-share-detail';btn.textContent='↗ Kongsi Event';
          btn.addEventListener('click',()=>{
            let eventId='';
            try{eventId=typeof state!=='undefined'?state.event?.id||'':'';}catch(_){}
            openVerifiedEventShare(eventId);
          });
          const summary=hero.querySelector('.row');
          if(summary)summary.insertAdjacentElement('afterend',btn);
          else hero.appendChild(btn);
        }
      }
    }
  }
  function init(){
    addHomeButton();addEventButtons();
    const screen=document.getElementById('screen');
    if(screen){const observer=new MutationObserver(()=>addEventButtons());observer.observe(screen,{childList:true,subtree:true});}
  }
  window.PZC_SHARE=Object.freeze({
    home:()=>openShare({title:HOME_TITLE,text:HOME_TEXT,url:PUBLIC_URL,kind:'home'}),
    event:({id,status}={})=>{
      if(status&&status!=='PUBLISHED')return;
      let eventId=id;
      if(!eventId)try{eventId=typeof state!=='undefined'?state.event?.id:'';}catch(_){}
      return openVerifiedEventShare(eventId);
    }
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
