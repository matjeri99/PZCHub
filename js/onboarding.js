/* PZC Hub Membership Onboarding v1 — additive frontend module.
 * Load AFTER app.js and hero-manager.js. No WhatsApp group URL lives here.
 */
(function () {
  'use strict';

  const labels = {
    PENDING_WELCOME:'Belum dihubungi', CONTACTED:'Sudah dihubungi',
    CONSENTED:'Ahli setuju', INVITED:'Pautan telah dihantar',
    JOINED:'Sudah masuk grup', DECLINED:'Tidak bersetuju',
    EXISTING:'Ahli sedia ada'
  };
  const order = ['PENDING_WELCOME','CONTACTED','CONSENTED','INVITED','DECLINED','JOINED'];
  const actionText = {
    CONTACTED:'Saya sudah menghantar mesej WhatsApp secara peribadi kepada ahli ini.',
    CONSENTED:'Saya SAHKAN ahli ini telah membalas dengan persetujuan jelas untuk menerima pautan grup.',
    DECLINED:'Saya SAHKAN ahli ini tidak bersetuju. Tiada pautan grup akan ditawarkan.',
    INVITED:'Saya SAHKAN pautan grup rasmi telah dihantar secara peribadi selepas ahli bersetuju.',
    JOINED:'Saya telah menyemak bahawa ahli ini sudah berada dalam grup WhatsApp rasmi.'
  };

  function staff() {
    return isApproved() && ['SUPERADMIN','ADMIN','CAPTAIN'].includes(currentRole());
  }
  function actButton(id,stage,label,kind='alt') {
    return `<button type="button" class="btn ${kind} small" data-act="onboardMark" data-id="${esc(id)}" data-stage="${esc(stage)}">${esc(label)}</button>`;
  }
  function rowButtons(m) {
    const id=m.id, stage=m.stage;
    if (stage==='PENDING_WELCOME') return `
      <button type="button" class="btn small" data-act="onboardWhatsApp" data-id="${esc(id)}">WhatsApp Welcome</button>
      ${actButton(id,'CONTACTED','Tandakan sudah mesej')}`;
    if (stage==='CONTACTED') return `
      <button type="button" class="btn gray small" data-act="onboardWhatsApp" data-id="${esc(id)}">Buka WhatsApp</button>
      ${actButton(id,'CONSENTED','Ahli SETUJU')}
      ${actButton(id,'DECLINED','Tidak setuju','gray')}`;
    if (stage==='CONSENTED') return actButton(id,'INVITED','Pautan sudah dihantar');
    if (stage==='INVITED') return actButton(id,'JOINED','Sahkan sudah masuk grup');
    return '<span class="muted small">Tiada tindakan</span>';
  }

  function panel(members) {
    const newMembers=members.filter(m=>m.stage!=='EXISTING');
    newMembers.sort((a,b)=>order.indexOf(a.stage)-order.indexOf(b.stage));
    const waiting=newMembers.filter(m=>m.stage==='PENDING_WELCOME').length;
    const consent=newMembers.filter(m=>m.stage==='CONSENTED').length;
    const legacy=members.length-newMembers.length;
    return `<section id="pzcOnboardSection" class="panel">
      <div class="row between"><h2>WhatsApp Onboarding</h2><span class="badge">${waiting} belum dihubungi</span></div>
      <p class="muted">Aliran rasmi: <b>Daftar pzchub.com → Admin luluskan → WhatsApp peribadi → Persetujuan jelas → Jemputan grup.</b></p>
      <p class="small muted">Admin/Captain sahaja. Klik WhatsApp Welcome untuk menyediakan mesej; klik pautan yang muncul dan <b>hantar sendiri</b> dari WhatsApp. Membuka pautan tidak dianggap mesej telah dihantar. Captain/penyelia grup memberi pautan hanya selepas persetujuan ahli.</p>
      <div class="row" style="gap:10px;margin-bottom:12px"><span class="badge">${consent} sedia dijemput</span><span class="badge">${legacy} ahli lama dikecualikan</span></div>
      ${newMembers.length?`<div class="tablewrap"><table>
        <thead><tr><th>Ahli</th><th>Status WhatsApp</th><th>Tindakan</th></tr></thead>
        <tbody>${newMembers.map(m=>`<tr>
          <td><b>${esc(m.callsign)}</b><div class="small muted">${esc(m.member_no?'PZC'+String(m.member_no).padStart(3,'0'):'')} · ${esc(m.full_name)}</div></td>
          <td>${esc(labels[m.stage]||m.stage)}</td>
          <td><div class="actions" style="flex-wrap:wrap">${rowButtons(m)}</div>
            <div id="onboard-link-${esc(m.id)}" class="small"></div></td>
          </tr>`).join('')}</tbody>
      </table></div>`:'<p class="muted">Tiada permohonan baharu selepas pemasangan modul ini.</p>'}
      <p class="small muted">Status hanya berubah selepas pengesahan manual petugas. Pautan grup dan perbualan peribadi tidak disimpan dalam Hub.</p>
    </section>`;
  }

  const previousAdmin=admin;
  admin=async function (...args) {
    await previousAdmin.apply(this,args);
    if (!staff() || state.view!=='admin') return;
    const screen=$('screen');
    if (!screen) return;
    try {
      const members=await api('onboardingList');
      if (state.view==='admin' && screen.isConnected && !screen.querySelector('#pzcOnboardSection'))
        screen.insertAdjacentHTML('beforeend',panel(members));
    } catch (error) {
      if (state.view==='admin' && screen.isConnected)
        screen.insertAdjacentHTML('beforeend',`<section class="panel"><h3>WhatsApp Onboarding</h3><p class="small muted">Modul belum aktif di backend: ${esc(error.message||'Sila semak API dan setup sheet.')}</p></section>`);
    }
  };

  const previousAction=handleAction;
  handleAction=async function (button) {
    const action=button.dataset.act,id=button.dataset.id;
    if (action!=='onboardWhatsApp' && action!=='onboardMark') return previousAction(button);
    if (!staff()) throw Error('Akses Admin/Captain diperlukan.');
    if (action==='onboardWhatsApp') {
      const result=await api('onboardingWelcome',{member_id:id});
      if (!/^https:\/\/wa\.me\/601\d{8,9}\?text=/.test(result.url||''))
        throw Error('Pautan WhatsApp tidak sah.');
      const holder=document.getElementById('onboard-link-'+id);
      if (holder) holder.innerHTML=`<p><a href="${esc(result.url)}" target="_blank" rel="noopener noreferrer">📲 Buka WhatsApp peribadi</a></p><span class="muted">Selepas hantar mesej, tekan “Tandakan sudah mesej”.</span>`;
      return;
    }
    const stage=button.dataset.stage;
    if (!actionText[stage]) throw Error('Status tidak dikenali.');
    if (!confirm(actionText[stage]+'\n\nTeruskan rekod status ini?')) return;
    await api('onboardingMark',{member_id:id,stage,confirmed:true});
    toast('Status WhatsApp dikemas kini: '+labels[stage]);
    return admin();
  };

  // Clarify the process at registration, without implying opt-in to a group.
  const previousRegistrationForm=registrationForm;
  registrationForm=function (...args) {
    return previousRegistrationForm.apply(this,args).replace('<h2>New Member Registration</h2>',
      `<h2>Mohon Keahlian PZC</h2><p class="muted">Daftar profil di pzchub.com dahulu. Selepas Admin meluluskan permohonan, Admin/Captain mungkin menghubungi anda melalui WhatsApp untuk memperkenalkan komuniti. <b>Jemputan grup hanya diberikan jika anda menyatakan persetujuan.</b> Pendaftaran tidak memasukkan anda ke grup secara automatik.</p>`);
  };

  const previousHome=home;
  home=async function (...args) {
    await previousHome.apply(this,args);
    if (state.self?.member && !isApproved() && state.view==='home') {
      const box=$('screen')?.querySelector('.panel.hero');
      if(box) box.insertAdjacentHTML('beforeend',
        '<p class="small muted">Selepas diluluskan, Admin/Captain akan menghubungi anda melalui WhatsApp. Jemputan grup hanya ditawarkan jika anda setuju.</p>');
    }
  };
})();
