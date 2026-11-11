<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import {
  fakeChineseIdCard,
  fakeChineseName,
  fakeChinesePhone,
  fakeCreditCard,
  fakeEmail,
  fakeEnglishName,
  generatePassword,
  lorem,
  nanoId,
  pickN,
  randomInRange,
  rollDice,
  scorePassword,
  ulid,
  uuidV4,
  type PasswordOptions
} from './generators';
import type { GeneratorHost, ThemeName } from './host/types';
import { renderQrPng, type QrErrorCorrectionLevel } from './qr';

const props = defineProps<{ host: GeneratorHost }>();

type Tab = 'password' | 'id' | 'qr' | 'lorem' | 'fake' | 'dice';
const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'password', label: '密码' },
  { id: 'id', label: 'ID' },
  { id: 'qr', label: '二维码' },
  { id: 'lorem', label: 'Lorem' },
  { id: 'fake', label: '假数据' },
  { id: 'dice', label: '骰子 / 抽奖' }
];

const active = ref<Tab>('password');
const theme = ref<ThemeName>('dark');
const connecting = ref(true);
const connectionError = ref('');
const feedback = ref('');
const feedbackKind = ref<'success' | 'error' | 'info'>('success');
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

const passwordOptions = ref<PasswordOptions>({
  length: 16,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: true
});
const passwordBatch = ref(5);
const passwords = ref<string[]>([]);
const passwordStrength = computed(() => (
  passwords.value[0] ? scorePassword(passwords.value[0]) : null
));

const idCount = ref(5);
const nanoSize = ref(21);
const idKind = ref<'uuid' | 'nanoid' | 'ulid'>('uuid');
const idValues = ref<string[]>([]);

const qrText = ref('https://example.com');
const qrEcLevel = ref<QrErrorCorrectionLevel>('M');
const qrModulePixels = ref(8);
const qrQuietZone = ref(4);
const qrDataUrl = ref('');
const qrBase64 = ref('');
const qrError = ref('');
const qrGenerating = ref(false);
let qrDebounce: ReturnType<typeof setTimeout> | undefined;
let qrReady = false;

const loremKind = ref<'en' | 'cn'>('cn');
const loremUnit = ref<'word' | 'sentence' | 'paragraph'>('paragraph');
const loremCount = ref(3);
const loremOutput = ref('');

interface FakeRow {
  cnName: string;
  enName: string;
  email: string;
  phone: string;
  idCard: string;
  visa: string;
}

const fakeCount = ref(5);
const fakeRows = ref<FakeRow[]>([]);

const diceCount = ref(2);
const diceSides = ref(6);
const diceResult = ref<number[]>([]);
const diceSum = computed(() => diceResult.value.reduce((sum, value) => sum + value, 0));
const rangeMin = ref(1);
const rangeMax = ref(100);
const rangeCount = ref(5);
const rangeResult = ref<number[]>([]);
const listRaw = ref('北京\n上海\n广州\n深圳\n杭州');
const listPickCount = ref(2);
const listResult = ref<string[]>([]);

watch(
  [qrText, qrEcLevel, qrModulePixels, qrQuietZone],
  () => {
    if (!qrReady) return;
    if (qrDebounce) clearTimeout(qrDebounce);
    qrDebounce = setTimeout(generateQr, 250);
  }
);

onMounted(async () => {
  generatePasswords();
  generateFakeRows();
  qrReady = true;
  generateQr();
  try {
    theme.value = await props.host.initialize((value) => {
      theme.value = value;
      applyTheme();
    });
    applyTheme();
  } catch (error) {
    connectionError.value = error instanceof Error ? error.message : String(error);
  } finally {
    connecting.value = false;
  }
});

onBeforeUnmount(() => {
  if (feedbackTimer) clearTimeout(feedbackTimer);
  if (qrDebounce) clearTimeout(qrDebounce);
  props.host.dispose();
});

function applyTheme() {
  document.documentElement.dataset.theme = theme.value;
}

async function toggleTheme() {
  theme.value = await props.host.toggleTheme();
  applyTheme();
}

function showFeedback(message: string, kind: 'success' | 'error' | 'info' = 'success') {
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedback.value = message;
  feedbackKind.value = kind;
  feedbackTimer = setTimeout(() => {
    feedback.value = '';
  }, 1800);
}

async function copy(value: string) {
  if (!value) return;
  try {
    await props.host.copy(value);
    showFeedback('已复制');
  } catch {
    showFeedback('复制失败', 'error');
  }
}

function generatePasswords() {
  const count = clampInteger(passwordBatch.value, 1, 50);
  const output = Array.from({ length: count }, () => generatePassword(passwordOptions.value));
  if (output.some((value) => !value)) {
    passwords.value = [];
    showFeedback('请至少选择一种字符集', 'error');
    return;
  }
  passwords.value = output;
}

function generateIds(kind: 'uuid' | 'nanoid' | 'ulid') {
  idKind.value = kind;
  const count = clampInteger(idCount.value, 1, 100);
  idValues.value = Array.from({ length: count }, () => {
    if (kind === 'uuid') return uuidV4();
    if (kind === 'nanoid') return nanoId(clampInteger(nanoSize.value, 4, 50));
    return ulid();
  });
}

function generateQr() {
  qrError.value = '';
  qrDataUrl.value = '';
  qrBase64.value = '';
  if (!qrText.value.trim()) return;
  qrGenerating.value = true;
  try {
    const result = renderQrPng(qrText.value, {
      ecLevel: qrEcLevel.value,
      modulePixels: clampInteger(qrModulePixels.value, 1, 40),
      quietZone: clampInteger(qrQuietZone.value, 0, 20)
    });
    qrDataUrl.value = result.dataUrl;
    qrBase64.value = result.base64;
  } catch (error) {
    qrError.value = error instanceof Error ? error.message : String(error);
  } finally {
    qrGenerating.value = false;
  }
}

async function saveQr() {
  if (!qrBase64.value) return;
  try {
    const saved = await props.host.savePng('qrcode.png', qrBase64.value);
    showFeedback(saved ? 'PNG 已保存' : '已取消保存', saved ? 'success' : 'info');
  } catch {
    showFeedback('PNG 保存失败', 'error');
  }
}

function generateLorem() {
  loremOutput.value = lorem(
    loremKind.value,
    loremUnit.value,
    clampInteger(loremCount.value, 1, 50)
  );
}

function generateFakeRows() {
  const count = clampInteger(fakeCount.value, 1, 50);
  fakeRows.value = Array.from({ length: count }, () => ({
    cnName: fakeChineseName(),
    enName: fakeEnglishName(),
    email: fakeEmail(),
    phone: fakeChinesePhone(),
    idCard: fakeChineseIdCard(),
    visa: fakeCreditCard('visa')
  }));
}

function copyFakeRow(row: FakeRow) {
  return copy(`${row.cnName} | ${row.enName} | ${row.email} | ${row.phone} | ${row.idCard} | ${row.visa}`);
}

function roll() {
  diceResult.value = rollDice(
    clampInteger(diceCount.value, 1, 20),
    clampInteger(diceSides.value, 2, 1000)
  );
}

function pickRange() {
  rangeResult.value = randomInRange(
    Math.trunc(rangeMin.value),
    Math.trunc(rangeMax.value),
    clampInteger(rangeCount.value, 1, 50)
  );
}

function pickList() {
  const items = listRaw.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  listResult.value = pickN(items, clampInteger(listPickCount.value, 1, Math.max(1, items.length)));
}

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(Number(value) || min)));
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">G</span>
        <div class="brand-copy">
          <strong>生成器</strong>
          <span>随机数据与开发素材</span>
        </div>
      </div>
      <div class="top-actions">
        <span v-if="feedback" class="feedback" :class="`is-${feedbackKind}`">{{ feedback }}</span>
        <span class="host-badge">{{ host.mode === 'plugin' ? '平台插件' : '独立应用' }}</span>
        <button
          v-if="host.mode === 'standalone'"
          class="icon-button"
          type="button"
          :title="theme === 'dark' ? '切换到浅色' : '切换到深色'"
          :aria-label="theme === 'dark' ? '切换到浅色' : '切换到深色'"
          @click="toggleTheme"
        >
          <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z"/></svg>
        </button>
      </div>
    </header>

    <div v-if="connecting" class="center-state">正在连接宿主</div>
    <div v-else-if="connectionError" class="center-state error-state">
      <strong>无法启动生成器</strong>
      <span>{{ connectionError }}</span>
    </div>

    <template v-else>
      <nav class="tabs" aria-label="生成器">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          :class="{ active: active === tab.id }"
          @click="active = tab.id"
        >{{ tab.label }}</button>
      </nav>

      <section class="workspace">
        <template v-if="active === 'password'">
          <article class="panel">
            <header><strong>参数</strong></header>
            <div class="panel-body">
              <label class="field grow"><span>长度 {{ passwordOptions.length }}</span><input v-model.number="passwordOptions.length" type="range" min="4" max="64"></label>
              <div class="option-row">
                <label><input v-model="passwordOptions.lowercase" type="checkbox">小写 a-z</label>
                <label><input v-model="passwordOptions.uppercase" type="checkbox">大写 A-Z</label>
                <label><input v-model="passwordOptions.digits" type="checkbox">数字 0-9</label>
                <label><input v-model="passwordOptions.symbols" type="checkbox">符号 !@#$...</label>
                <label><input v-model="passwordOptions.excludeAmbiguous" type="checkbox">排除易混（Il1O0oB8Z2S5）</label>
              </div>
              <div class="action-row"><label class="field compact"><span>批量生成</span><input v-model.number="passwordBatch" type="number" min="1" max="50"></label><button class="primary" type="button" @click="generatePasswords">生成</button><button v-if="passwords.length > 1" type="button" @click="copy(passwords.join('\n'))">全部复制</button></div>
            </div>
          </article>
          <article class="panel">
            <header><strong>结果（{{ passwords.length }}）</strong><span v-if="passwordStrength" class="strength" :class="`level-${passwordStrength.score}`">强度：{{ passwordStrength.label }}</span></header>
            <ul class="result-list"><li v-for="(password, index) in passwords" :key="index"><span class="mono break">{{ password }}</span><button type="button" @click="copy(password)">复制</button></li></ul>
          </article>
        </template>

        <template v-else-if="active === 'id'">
          <article class="panel"><header><strong>参数</strong></header><div class="panel-body">
            <div class="action-row"><label class="field compact"><span>数量</span><input v-model.number="idCount" type="number" min="1" max="100"></label><label class="field compact"><span>NanoID 长度</span><input v-model.number="nanoSize" type="number" min="4" max="50"></label></div>
            <div class="action-row"><button class="primary" type="button" @click="generateIds('uuid')">UUID v4</button><button type="button" @click="generateIds('nanoid')">NanoID</button><button type="button" @click="generateIds('ulid')">ULID</button></div>
          </div></article>
          <article v-if="idValues.length" class="panel"><header><strong>{{ idKind.toUpperCase() }} 结果（{{ idValues.length }}）</strong><button type="button" @click="copy(idValues.join('\n'))">全部复制</button></header><ul class="result-list"><li v-for="(value, index) in idValues" :key="index"><span class="mono break">{{ value }}</span><button type="button" @click="copy(value)">复制</button></li></ul></article>
        </template>

        <template v-else-if="active === 'qr'">
          <div class="qr-layout">
            <article class="panel"><header><strong>内容</strong></header><div class="panel-body">
              <textarea v-model="qrText" class="compact-textarea" placeholder="URL / 文本"></textarea>
              <div class="action-row"><label class="field"><span>纠错级别</span><select v-model="qrEcLevel"><option value="L">L（容错 ~7%）</option><option value="M">M（容错 ~15%）</option><option value="Q">Q（容错 ~25%）</option><option value="H">H（容错 ~30%）</option></select></label><label class="field compact"><span>模块像素</span><input v-model.number="qrModulePixels" type="number" min="1" max="40"></label><label class="field compact"><span>留白</span><input v-model.number="qrQuietZone" type="number" min="0" max="20"></label></div>
            </div></article>
            <article class="panel"><header><strong>预览</strong><button type="button" :disabled="!qrBase64 || qrGenerating" @click="saveQr">保存 PNG</button></header><div class="panel-body"><p v-if="qrError" class="inline-error">{{ qrError }}</p><div v-else-if="qrDataUrl" class="qr-preview"><img :src="qrDataUrl" alt="二维码预览"></div><div v-else class="empty-result">{{ qrGenerating ? '正在生成' : '输入内容后生成预览' }}</div></div></article>
          </div>
        </template>

        <template v-else-if="active === 'lorem'">
          <article class="panel"><header><strong>参数</strong></header><div class="panel-body"><div class="action-row"><label class="field"><span>语言</span><select v-model="loremKind"><option value="cn">中文</option><option value="en">英文</option></select></label><label class="field"><span>单位</span><select v-model="loremUnit"><option value="paragraph">段</option><option value="sentence">句</option><option value="word">词</option></select></label><label class="field compact"><span>数量</span><input v-model.number="loremCount" type="number" min="1" max="50"></label><button class="primary" type="button" @click="generateLorem">生成</button></div></div></article>
          <article v-if="loremOutput" class="panel"><header><strong>结果</strong><button type="button" @click="copy(loremOutput)">复制</button></header><div class="text-output">{{ loremOutput }}</div></article>
        </template>

        <template v-else-if="active === 'fake'">
          <article class="panel"><header><strong>参数</strong></header><div class="panel-body"><div class="action-row"><label class="field compact"><span>条数</span><input v-model.number="fakeCount" type="number" min="1" max="50"></label><button class="primary" type="button" @click="generateFakeRows">重新生成</button></div><p class="note">全部随机拼装，用于填测试表单。不是真实身份，勿用于任何认证或欺诈场景。</p></div></article>
          <article class="panel"><header><strong>结果（{{ fakeRows.length }}）</strong></header><div class="table-scroll"><div class="fake-table fake-head"><span>中文名</span><span>英文名</span><span>邮箱</span><span>手机</span><span>身份证</span><span>Visa</span><span></span></div><div v-for="(row, index) in fakeRows" :key="index" class="fake-table fake-row"><button class="cell mono" type="button" @click="copy(row.cnName)">{{ row.cnName }}</button><button class="cell mono" type="button" @click="copy(row.enName)">{{ row.enName }}</button><button class="cell mono" type="button" @click="copy(row.email)">{{ row.email }}</button><button class="cell mono" type="button" @click="copy(row.phone)">{{ row.phone }}</button><button class="cell mono" type="button" @click="copy(row.idCard)">{{ row.idCard }}</button><button class="cell mono" type="button" @click="copy(row.visa)">{{ row.visa }}</button><button type="button" @click="copyFakeRow(row)">整行</button></div></div></article>
        </template>

        <template v-else>
          <article class="panel"><header><strong>骰子</strong></header><div class="panel-body"><div class="action-row"><label class="field compact"><span>数量</span><input v-model.number="diceCount" type="number" min="1" max="20"></label><label class="field compact"><span>面数</span><input v-model.number="diceSides" type="number" min="2" max="1000"></label><button class="primary" type="button" @click="roll">掷</button></div><div v-if="diceResult.length" class="dice-result"><span v-for="(value, index) in diceResult" :key="index" class="die mono">{{ value }}</span><span class="muted">= {{ diceSum }}</span></div></div></article>
          <article class="panel"><header><strong>区间随机</strong></header><div class="panel-body"><div class="action-row"><label class="field compact"><span>最小</span><input v-model.number="rangeMin" type="number"></label><label class="field compact"><span>最大</span><input v-model.number="rangeMax" type="number"></label><label class="field compact"><span>个数</span><input v-model.number="rangeCount" type="number" min="1" max="50"></label><button class="primary" type="button" @click="pickRange">生成</button></div><div v-if="rangeResult.length" class="inline-result"><span class="mono">{{ rangeResult.join(', ') }}</span><button type="button" @click="copy(rangeResult.join(','))">复制</button></div></div></article>
          <article class="panel"><header><strong>从列表抽奖</strong></header><div class="panel-body list-pick"><textarea v-model="listRaw" class="compact-textarea" placeholder="每行一个候选项"></textarea><div class="action-row"><label class="field compact"><span>抽几个</span><input v-model.number="listPickCount" type="number" min="1" max="50"></label><button class="primary" type="button" @click="pickList">抽</button></div><ol v-if="listResult.length" class="winner-list"><li v-for="winner in listResult" :key="winner" class="mono">{{ winner }}</li></ol></div></article>
        </template>
      </section>
    </template>
  </main>
</template>
