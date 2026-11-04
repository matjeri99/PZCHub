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



