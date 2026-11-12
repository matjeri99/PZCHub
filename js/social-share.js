/**
 * PZC Hub Social Sharing v1.0
 * Standalone progressive enhancement: does not touch Firebase, tokens or PZC API.
 * Event share intentionally links to public Home until a public event permalink exists.
 */
(function(){
  'use strict';
  const PUBLIC_URL='https://pzchub.com/';
  const HOME_TITLE='PZC Hub | Putrajaya Zontes Community';
  const HOME_TEXT='🏍️ Putrajaya Zontes Community\nOne Ride · One Crew · Many Journeys';
  let dialog, current={title:HOME_TITLE,text:HOME_TEXT,url:PUBLIC_URL,kind:'home'};

  function notice(text){
    const target=document.getElementById('toast');
    if(target){target.textContent=text;setTimeout(()=>{if(target.textContent===text)target.textContent='';},4000);}
  }
  function clean(s,max=140){return String(s||'').trim().replace(/\s+/g,' ').slice(0,max);}
  function eventInfo(title,date,location){
    const lines=[`🏍️ ${clean(title)}`];
    if(date)lines.push(`📅 ${clean(date,80)}`);
    if(location&&location!=='-')lines.push(`📍 ${clean(location,100)}`);
    lines.push('Putrajaya Zontes Community');
    lines.push('Lihat butiran melalui PZC Hub (log masuk ahli diperlukan).');
    return {title:clean(title),text:lines.join('\n'),url:PUBLIC_URL,kind:'event'};
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
      ? 'Versi ini berkongsi maklumat acara + pautan utama Hub. Pautan terus dan preview khusus acara menyusul apabila halaman acara awam tersedia.'
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
      const metadata=detailsFromCard(card);
      if(!metadata.title)continue;
      const btn=document.createElement('button');
      btn.type='button';btn.className='pzc-event-share';btn.textContent='↗ Kongsi Event';
      btn.addEventListener('click',()=>openShare(eventInfo(metadata.title,metadata.date,metadata.location)));
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
          btn.addEventListener('click',()=>openShare(eventInfo(title,date,location)));
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
    event:({title,date,location,status}={})=>{if(status&&status!=='PUBLISHED')return;openShare(eventInfo(title,date,location));}
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
