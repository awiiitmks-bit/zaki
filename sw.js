// Service worker Kenali Binatang: membuat aplikasi bisa dibuka tanpa internet.
// Jika mengganti rekaman suara, naikkan angka versi supaya perangkat mengambil file yang baru.
var VERSI = 'kenali-binatang-v2';
var INTI = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
var ID = ['kucing', 'anjing', 'sapi', 'ayam', 'bebek', 'kambing', 'kuda', 'singa', 'gajah', 'katak', 'babi', 'burung'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSI).then(function (cache) {
      return cache.addAll(INTI).then(function () {
        // Rekaman disimpan satu per satu; file yang tidak ada dilewati tanpa membatalkan pemasangan.
        var daftar = ['zaki.png'];
        ID.forEach(function (id) {
          daftar.push('suara/' + id + '.mp3', 'suara/nama-' + id + '.mp3');
        });
        return Promise.all(daftar.map(function (u) { return cache.add(u).catch(function () {}); }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (nama) {
      return Promise.all(nama.filter(function (n) { return n !== VERSI; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Browser meminta audio sepotong-sepotong (header Range); jawab dari file lengkap yang tersimpan.
function jawabAudio(req) {
  return caches.open(VERSI).then(function (cache) {
    return cache.match(req.url).then(function (res) {
      if (res) return res;
      return fetch(req.url).then(function (net) {
        if (net.ok) cache.put(req.url, net.clone());
        return net;
      });
    });
  }).then(function (res) {
    var range = req.headers.get('range');
    if (!range || !res.ok) return res;
    return res.arrayBuffer().then(function (buf) {
      var m = /bytes=(\d*)-(\d*)/.exec(range);
      var total = buf.byteLength;
      var mulai = m && m[1] ? parseInt(m[1], 10) : 0;
      var akhir = m && m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
      return new Response(buf.slice(mulai, akhir + 1), {
        status: 206,
        headers: {
          'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
          'Content-Range': 'bytes ' + mulai + '-' + akhir + '/' + total,
          'Content-Length': String(akhir - mulai + 1)
        }
      });
    });
  }).catch(function () { return new Response('', { status: 504 }); });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.indexOf('/suara/') !== -1) {
    event.respondWith(jawabAudio(req));
    return;
  }
  // Halaman dan berkas lain: ambil yang terbaru bila ada internet, jika tidak pakai simpanan.
  event.respondWith(
    fetch(req).then(function (net) {
      if (net.ok) {
        var salinan = net.clone();
        caches.open(VERSI).then(function (cache) { cache.put(req, salinan); });
      }
      return net;
    }).catch(function () {
      return caches.match(req).then(function (res) { return res || caches.match('index.html'); });
    })
  );
});
