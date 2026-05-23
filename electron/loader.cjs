// ============================================================================
// T8-penguin-canvas Runtime Loader
//
// 职责:
//   1. 注册 .t8c 后缀的 require hook
//      → 读取磁盘加密文件 (T8ENC1\n + AES-256-CBC 密文)
//      → 内存解密为 V8 字节码 (.jsc 等价物)
//      → 通过 bytenode 加载 + Module._compile 把字节码包装为 CommonJS Module
//   2. 兼容相对路径 require('./xxx')(从 .t8c 入口 require 出去时,自动尝试同名 .t8c)
//
// 设计参考: gpt-image-2-web 的 ZZENC1 + py_compile,但改为 Node 体系
//   - Magic Header: T8ENC1\n
//   - Key 派生: SHA256("T8-penguin-canvas-T8star-2026")
//   - 算法: AES-256-CBC (16-byte 随机 IV 内嵌密文头)
//   - 字节码格式: bytenode 标准 .jsc (V8 cached data + 8-byte length header)
// ============================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');

const MAGIC = Buffer.from('T8ENC1\n', 'utf8'); // 7 bytes
const PASSPHRASE = 'T8-penguin-canvas-T8star-2026';
const KEY = crypto.createHash('sha256').update(PASSPHRASE, 'utf8').digest(); // 32 bytes
const IV_LEN = 16;

function isEncrypted(buf) {
  return Buffer.isBuffer(buf) && buf.length > MAGIC.length && buf.slice(0, MAGIC.length).equals(MAGIC);
}

function encryptBuffer(plain) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, ct]);
}

function decryptBuffer(enc) {
  if (!isEncrypted(enc)) {
    throw new Error('[T8ENC1] missing magic header');
  }
  const iv = enc.slice(MAGIC.length, MAGIC.length + IV_LEN);
  const ct = enc.slice(MAGIC.length + IV_LEN);
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

// ---------- bytenode 字节码 → Module ----------
// bytenode 0.x 的标准做法:把 .jsc 内容通过 vm.Script 解析为 cachedData,
// 再用 Module.wrap 重新装配。我们简化为直接调用 bytenode 的 compileFile/runBytecode。
let _bytenode = null;
function bytenode() {
  if (_bytenode) return _bytenode;
  _bytenode = require('bytenode');
  return _bytenode;
}

// ---------- 注册 .t8c require hook ----------
function registerLoader() {
  if (require.extensions['.t8c']) return; // 防重复注册
  // bytenode 注册 .jsc 扩展(若它还没装)
  try {
    bytenode();
  } catch (e) {
    console.error('[loader] bytenode require failed:', e.message);
    throw e;
  }

  require.extensions['.t8c'] = function (mod, filename) {
    const enc = fs.readFileSync(filename);
    const jsc = decryptBuffer(enc); // 解密成 .jsc 字节码缓冲
    // 写到 OS 临时目录(随进程生命周期),让 bytenode 读取
    const os = require('os');
    const tmpDir = path.join(os.tmpdir(), 't8pc-jsc');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(
      tmpDir,
      crypto.createHash('md5').update(filename).digest('hex') + '.jsc',
    );
    fs.writeFileSync(tmpFile, jsc);
    // 让 bytenode 通过其 .jsc 扩展加载
    mod.exports = require(tmpFile);
  };

  // 让 require('./foo') 在缺少 .js/.json 时自动尝试 .t8c
  const _origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, ...rest) {
    try {
      return _origResolve.call(this, request, parent, ...rest);
    } catch (e) {
      // 尝试 .t8c
      try {
        return _origResolve.call(this, request + '.t8c', parent, ...rest);
      } catch (_) {
        throw e;
      }
    }
  };
}

registerLoader();

module.exports = {
  registerLoader,
  encryptBuffer,
  decryptBuffer,
  isEncrypted,
  MAGIC,
};
