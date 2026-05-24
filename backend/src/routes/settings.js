// 三套 API Key 设置路由
const express = require('express');
const fs = require('fs');
const config = require('../config');

const router = express.Router();

// 默认 settings 结构(三套通用 Key + 7 类分类 Key)
const DEFAULT_SETTINGS = {
  // 三套通用 Key
  zhenzhenApiKey: '',
  zhenzhenBaseUrl: config.ZHENZHEN_BASE_URL, // 固定 https://ai.t8star.org
  rhApiKey: '',
  rhBaseUrl: config.RH_BASE_URL,
  // v1.2.9.16: 取消 rhWalletApiKey —— RH 钱包应用节点与普通 RunningHub 节点统一使用 rhApiKey
  llmApiKey: '',
  llmBaseUrl: config.ZHENZHEN_BASE_URL, // 同贞贞工坊上游
  // 分类 Key（留空时 fallback 到 zhenzhenApiKey）
  gptImageApiKey: '',
  nanoBananaApiKey: '',
  mjApiKey: '',
  veoApiKey: '',
  grokApiKey: '',
  seedanceApiKey: '',
  sunoApiKey: '',
  // 其他偏好
  preferences: {
    theme: 'dark',
    language: 'zh-CN',
  },
};

// 分类 key 字段列表（供 GET 脱敏与 POST 合并使用）
const CLASSIFIED_KEY_FIELDS = [
  'gptImageApiKey', 'nanoBananaApiKey', 'mjApiKey', 'veoApiKey',
  'grokApiKey', 'seedanceApiKey', 'sunoApiKey',
];

function maskKey(k) {
  return k ? '****' + String(k).slice(-4) : '';
}

function loadSettings() {
  if (!fs.existsSync(config.SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
  try {
    const data = JSON.parse(fs.readFileSync(config.SETTINGS_FILE, 'utf-8'));
    // 强制 base URL 与配置一致(防篡改)
    return {
      ...DEFAULT_SETTINGS,
      ...data,
      zhenzhenBaseUrl: config.ZHENZHEN_BASE_URL,
      llmBaseUrl: config.ZHENZHEN_BASE_URL,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  fs.writeFileSync(config.SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

// GET /api/settings — 获取全部设置(脱敏 Key 仅返回最后4位)
router.get('/', (_req, res) => {
  const settings = loadSettings();
  const masked = {
    ...settings,
    zhenzhenApiKey: maskKey(settings.zhenzhenApiKey),
    rhApiKey: maskKey(settings.rhApiKey),
    llmApiKey: maskKey(settings.llmApiKey),
  };
  for (const f of CLASSIFIED_KEY_FIELDS) {
    masked[f] = maskKey(settings[f]);
  }
  res.json({ success: true, data: masked });
});

// GET /api/settings/raw — 内部接口,获取明文(供 Phase 4 代理调用使用)
router.get('/raw', (_req, res) => {
  res.json({ success: true, data: loadSettings() });
});

// POST /api/settings — 更新设置
router.post('/', (req, res) => {
  const current = loadSettings();
  const incoming = req.body || {};
  const merged = {
    ...current,
    ...incoming,
    // base URL 强制为配置值,不允许覆盖
    zhenzhenBaseUrl: config.ZHENZHEN_BASE_URL,
    llmBaseUrl: config.ZHENZHEN_BASE_URL,
  };
  saveSettings(merged);
  res.json({ success: true });
});

module.exports = router;
