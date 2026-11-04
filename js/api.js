// Backend adapter. Deliberately fail closed until an authenticated gateway exists.
window.PZC_API = Object.freeze({
  async rpc(idToken, action, payload = {}) {
    const base = String(window.ZTG_CONFIG?.apiBase || '').replace(/\/$/, '');
    if (!base) throw new Error('PZC Hub GitHub sedang dalam ujian. API gateway belum disambungkan; sila gunakan portal sedia ada.');
    if (!idToken) throw new Error('Sila log masuk.');
    const response = await fetch(`${base}/rpc`, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':`Bearer ${idToken}`},
      body: JSON.stringify({action,payload}),
      cache: 'no-store'
    });
    const data = await response.json();
    if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Permintaan gagal.');
    return data?.data;
  }
});
