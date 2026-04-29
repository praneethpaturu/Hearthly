// ─────────────────────────────────────────────────────────────────────
// Pure-JS perceptual hash (pHash) + EXIF extractor.
//
// Runs entirely in the browser — no server-side image decoding needed.
// Worker / citizen captures a photo → we compute a 64-bit pHash plus
// EXIF metadata locally → both are POSTed to /api/photo-verify which
// returns the verdict (ok / suspect_duplicate / suspect_tamper).
//
// Algorithm (canonical pHash):
//   1. downscale to 32×32 RGBA via Canvas
//   2. greyscale (BT.601 luma)
//   3. 2-D DCT-II (separable, naïve N²; 32 is small enough)
//   4. take top-left 8×8 (low-freq), drop DC at [0,0]
//   5. threshold each coefficient against the median → 63-bit hash
//   6. emit as 16-char hex (left-padded)
//
// No external deps. The browser does ~10 ms of work per image.
// Server only receives + stores + Hamming-compares the hash string.
// ─────────────────────────────────────────────────────────────────────

window.phash = (() => {
  // 1-D DCT-II: cos(((2k+1) i π) / (2N))
  function dct1d(input, N, output) {
    for (let k = 0; k < N; k++) {
      let sum = 0;
      const c = Math.PI / (2 * N);
      for (let n = 0; n < N; n++) {
        sum += input[n] * Math.cos((2 * n + 1) * k * c);
      }
      output[k] = sum;
    }
  }

  function dct2d(matrix, N) {
    // Row pass, then column pass.
    const tmp = new Float32Array(N * N);
    const out = new Float32Array(N * N);
    const row = new Float32Array(N);
    const rowOut = new Float32Array(N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) row[x] = matrix[y * N + x];
      dct1d(row, N, rowOut);
      for (let x = 0; x < N; x++) tmp[y * N + x] = rowOut[x];
    }
    const col = new Float32Array(N);
    const colOut = new Float32Array(N);
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) col[y] = tmp[y * N + x];
      dct1d(col, N, colOut);
      for (let y = 0; y < N; y++) out[y * N + x] = colOut[y];
    }
    return out;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  async function computeHash(file) {
    const img = await loadImage(file);
    const N = 32;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    // Best-fit, no aspect preservation (pHash is rotation/aspect-tolerant
    // only marginally — but most "duplicate-photo" fraud reuses the same
    // photo unmodified, so this is fine).
    ctx.drawImage(img, 0, 0, N, N);
    const px = ctx.getImageData(0, 0, N, N).data;
    const gray = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) {
      gray[i] = 0.299 * px[i*4] + 0.587 * px[i*4+1] + 0.114 * px[i*4+2];
    }
    const dct = dct2d(gray, N);

    // Top-left 8×8, drop [0,0] (DC component dominates everything else).
    const lowFreq = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (x === 0 && y === 0) continue;
        lowFreq.push(dct[y * N + x]);
      }
    }
    const sorted = [...lowFreq].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    let bits = '';
    for (const v of lowFreq) bits += v > median ? '1' : '0';
    // 63 bits, prepend a 0 to make 64 → 16 hex chars.
    bits = '0' + bits;
    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  }

  // ── EXIF extractor (DateTimeOriginal + GPS only, no full parser) ──
  // Returns null if the file isn't a JPEG with an APP1/EXIF segment.
  // Pure JS; no exifr/piexif dep.
  async function extractExif(file) {
    try {
      if (!file.type || !file.type.includes('jpeg')) return null;
      // First 256 KB is enough for the EXIF header on every camera.
      const head = await file.slice(0, Math.min(256 * 1024, file.size)).arrayBuffer();
      const v = new DataView(head);
      // SOI marker
      if (v.getUint16(0) !== 0xFFD8) return null;
      // Walk segments looking for APP1 (0xFFE1) starting with "Exif\0\0".
      let off = 2;
      while (off + 4 < v.byteLength) {
        if (v.getUint8(off) !== 0xFF) return null;
        const marker = v.getUint8(off + 1);
        const size = v.getUint16(off + 2);
        if (marker === 0xE1) {
          const id = String.fromCharCode(...new Uint8Array(head, off + 4, 6));
          if (id === 'Exif\0\0') {
            return parseTiff(head, off + 10, size - 8);
          }
        }
        off += 2 + size;
        if (marker === 0xDA) return null; // start of scan — no EXIF before this
      }
      return null;
    } catch { return null; }
  }
  function parseTiff(buffer, offset, length) {
    const v = new DataView(buffer, offset, length);
    const little = v.getUint16(0) === 0x4949;
    const ifd0 = v.getUint32(4, little);
    const out = { takenAt: null, lat: null, lng: null };
    let exifIfd = null, gpsIfd = null;
    function readIfd(ifdOffset) {
      const count = v.getUint16(ifdOffset, little);
      for (let i = 0; i < count; i++) {
        const eOff = ifdOffset + 2 + i * 12;
        const tag  = v.getUint16(eOff, little);
        const type = v.getUint16(eOff + 2, little);
        const cnt  = v.getUint32(eOff + 4, little);
        const valOff = eOff + 8;
        if (tag === 0x8769) exifIfd = v.getUint32(valOff, little); // Exif sub-IFD
        if (tag === 0x8825) gpsIfd  = v.getUint32(valOff, little); // GPS sub-IFD
      }
    }
    function readDateTimeOriginal(ifdOffset) {
      const count = v.getUint16(ifdOffset, little);
      for (let i = 0; i < count; i++) {
        const eOff = ifdOffset + 2 + i * 12;
        const tag  = v.getUint16(eOff, little);
        if (tag === 0x9003) {
          const cnt = v.getUint32(eOff + 4, little);
          const dataOff = v.getUint32(eOff + 8, little);
          let s = '';
          for (let k = 0; k < cnt - 1; k++) s += String.fromCharCode(v.getUint8(dataOff + k));
          // EXIF DateTimeOriginal: 'YYYY:MM:DD HH:MM:SS'
          const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
          if (m) {
            out.takenAt = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
          }
        }
      }
    }
    function readRational(off) {
      const num = v.getUint32(off, little);
      const den = v.getUint32(off + 4, little);
      return den ? num / den : 0;
    }
    function dms2deg(off) {
      const deg = readRational(off);
      const min = readRational(off + 8);
      const sec = readRational(off + 16);
      return deg + min / 60 + sec / 3600;
    }
    function readGps(ifdOffset) {
      const count = v.getUint16(ifdOffset, little);
      let lat, latRef, lng, lngRef;
      for (let i = 0; i < count; i++) {
        const eOff = ifdOffset + 2 + i * 12;
        const tag  = v.getUint16(eOff, little);
        const dataOff = v.getUint32(eOff + 8, little);
        if (tag === 1) latRef = String.fromCharCode(v.getUint8(eOff + 8));
        if (tag === 2) lat = dms2deg(dataOff);
        if (tag === 3) lngRef = String.fromCharCode(v.getUint8(eOff + 8));
        if (tag === 4) lng = dms2deg(dataOff);
      }
      if (lat && latRef === 'S') lat = -lat;
      if (lng && lngRef === 'W') lng = -lng;
      if (lat) out.lat = lat;
      if (lng) out.lng = lng;
    }
    readIfd(ifd0);
    if (exifIfd) readDateTimeOriginal(exifIfd);
    if (gpsIfd)  readGps(gpsIfd);
    return out;
  }

  // Compose: capture a single { hash, exif } payload from a File.
  async function fingerprint(file) {
    const [hash, exif] = await Promise.all([computeHash(file), extractExif(file)]);
    return { hash, exif: exif || {}, size: file.size, type: file.type };
  }

  return { computeHash, extractExif, fingerprint };
})();
