// 소원의 숲 - 페이로드 디코더 (규격 v1)
// C#의 WishForest.WishCodec 과 반드시 동일하게 동작해야 함.
//   v1|q|var|marker|yymmdd|seq|소원   → UTF-8 → base64url
(function (root) {
  'use strict';

  var VERSION = 'v1';
  var FIELD_COUNT = 7;
  var SEP = '|';

  function fromBase64Url(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    var m = s.length % 4;
    if (m === 1) throw new Error('bad base64url length');
    if (m === 2) s += '==';
    else if (m === 3) s += '=';
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('bad base64 chars');
    var bin = atob(s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // 마지막 필드(소원)는 나머지 전부 — C#의 Split(sep, 7) 과 동일
  function splitLimit(raw, sep, limit) {
    var out = [], rest = raw;
    for (var i = 0; i < limit - 1; i++) {
      var k = rest.indexOf(sep);
      if (k < 0) { out.push(rest); return out; }
      out.push(rest.slice(0, k));
      rest = rest.slice(k + 1);
    }
    out.push(rest);
    return out;
  }

  function isInt(s) { return /^-?\d+$/.test(s); }

  // 표시용 방어. C#의 Sanitize + 제어문자 제거.
  // 정상 페이로드는 인코딩 시점에 이미 정제되므로, 이건 조작된 URL 대비용이다.
  var MAX_WISH_LEN = 45;
  function sanitizeWish(w) {
    if (w == null) return '';
    w = w.replace(/[\r\n\t]/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '');
    w = w.trim();
    if (w.length > MAX_WISH_LEN) w = w.slice(0, MAX_WISH_LEN);
    return w;
  }

  function decode(d) {
    if (!d) return { ok: false, error: 'empty' };

    var bytes;
    try { bytes = fromBase64Url(d); }
    catch (e) { return { ok: false, error: 'base64: ' + e.message }; }

    var raw;
    try { raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (e) { return { ok: false, error: 'utf8' }; }

    var f = splitLimit(raw, SEP, FIELD_COUNT);
    if (f.length < FIELD_COUNT) return { ok: false, error: 'field count ' + f.length };
    if (f[0] !== VERSION) return { ok: false, error: 'version ' + f[0] };

    if (!isInt(f[1])) return { ok: false, error: 'question' };
    if (!isInt(f[2])) return { ok: false, error: 'variant' };
    if (!isInt(f[5])) return { ok: false, error: 'seq' };
    var q = parseInt(f[1], 10), v = parseInt(f[2], 10), seq = parseInt(f[5], 10);
    if (q < 1 || q > 6) return { ok: false, error: 'question range' };
    if (v < 0 || v > 15) return { ok: false, error: 'variant range' };

    var ds = f[4];
    if (!/^\d{6}$/.test(ds)) return { ok: false, error: 'date ' + ds };
    var yy = +ds.slice(0, 2), mm = +ds.slice(2, 4), dd = +ds.slice(4, 6);
    var year = 2000 + yy;
    var dt = new Date(Date.UTC(year, mm - 1, dd));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd)
      return { ok: false, error: 'date ' + ds };

    return {
      ok: true,
      question: q,
      variant: v,
      marker: f[3],
      planted: dt,
      dateText: year + '-' + ('0' + mm).slice(-2) + '-' + ('0' + dd).slice(-2),
      seq: seq,
      wish: f[6],              // C# 파싱 결과와 바이트 단위로 동일
      wishDisplay: sanitizeWish(f[6])   // 화면에 그릴 값
    };
  }

  var api = { decode: decode, fromBase64Url: fromBase64Url, sanitizeWish: sanitizeWish, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WishCodec = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
