const SquatDetector = require('../../utils/sensor');
const storage = require('../../utils/storage');

const RING_SIZE = 200;
const RING_LINEWIDTH = 10;
const RING_R = 86;

const SPEED_LABELS = ['', '慢速 / 灵敏', '中速 / 标准', '快速 / 费力'];

Page({
  data: {
    sessionCount: 0,
    todayCount: 0,
    dailyGoal: 100,
    running: false,
    elapsed: '00:00',
    calories: 0,
    lastSession: false,
    sensorReady: false,
    sensorStatusText: '等待开始',
    waveBars: [],
    speedLevel: 2,
    speedLabel: '中速 / 标准',
    showSpeedPicker: false
  },

  onLoad() {
    const settings = storage.getSettings();
    const todayCount = storage.getTodayCount();
    const speedLevel = storage.getSpeedLevel();
    this.setData({
      dailyGoal: settings.dailyGoal,
      todayCount,
      speedLevel,
      speedLabel: SPEED_LABELS[speedLevel]
    });
    this.detector = new SquatDetector();
    this._initWaveBars();
  },

  onReady() {
    const query = wx.createSelectorQuery();
    query.select('#ringCanvas')
      .fields({ node: true, size: true })
      .exec(res => {
        if (!res[0] || !res[0].node) return;
        this._canvas = res[0].node;
        this._ctx = this._canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        this._canvas.width = RING_SIZE * dpr;
        this._canvas.height = RING_SIZE * dpr;
        this._ctx.scale(dpr, dpr);
        this._drawRing(storage.getTodayCount() / this.data.dailyGoal);
      });
  },

  onShow() {
    if (!this.data.running) {
      const todayCount = storage.getTodayCount();
      this.setData({ todayCount });
      this._drawRing(todayCount / this.data.dailyGoal);
    }
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
    this.detector.stop();
  },

  _initWaveBars() {
    const bars = [];
    for (let i = 0; i < 40; i++) {
      bars.push({ h: 10, active: false });
    }
    this.setData({ waveBars: bars });
  },

  toggleRunning() {
    if (this.data.running) {
      this._stopSession();
    } else {
      this._startSession();
    }
  },

  openSpeedPicker() {
    if (this.data.running) return;
    this.setData({ showSpeedPicker: true });
  },

  closeSpeedPicker() {
    this.setData({ showSpeedPicker: false });
  },

  selectSpeed(e) {
    const level = parseInt(e.currentTarget.dataset.level);
    if (level === this.data.speedLevel) {
      this.closeSpeedPicker();
      return;
    }
    storage.setSpeedLevel(level);
    this.setData({
      speedLevel: level,
      speedLabel: SPEED_LABELS[level],
      showSpeedPicker: false
    });
    wx.showToast({ title: `已切换为「${SPEED_LABELS[level]}」`, icon: 'none' });
  },

  _startSession() {
    this.sessionCount = 0;
    this.sessionSeconds = 0;
    this.sessionStart = Date.now();

    this.setData({
      running: true,
      sensorStatusText: '校准中...',
      lastSession: false,
      sessionCount: 0,
      elapsed: '00:00',
      calories: 0
    });
    this._drawRing(0);

    this.detector.start(
      () => this._onSquat(),
      (mag, history) => this._onWaveform(mag, history),
      this.data.speedLevel
    );

    setTimeout(() => {
      this.setData({ sensorReady: true, sensorStatusText: '自动检测中' });
    }, 800);

    this._timer = setInterval(() => {
      this.sessionSeconds = Math.floor((Date.now() - this.sessionStart) / 1000);
      this.setData({
        elapsed: storage.formatDuration(this.sessionSeconds),
        calories: Math.floor(this.sessionCount * 0.5)
      });
    }, 1000);
  },

  _stopSession() {
    this.detector.stop();
    clearInterval(this._timer);

    const record = {
      id: storage.generateId(),
      date: storage.formatDate(new Date()),
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      count: this.sessionCount,
      duration: this.sessionSeconds,
      calories: Math.floor(this.sessionCount * 0.5),
      timestamp: Date.now()
    };

    storage.saveRecord(record);

    const todayCount = storage.getTodayCount();
    this._drawRing(todayCount / this.data.dailyGoal);

    this.setData({
      running: false,
      sensorReady: false,
      sensorStatusText: '已停止',
      lastSession: true,
      todayCount,
      elapsed: storage.formatDuration(this.sessionSeconds),
      waveBars: this.data.waveBars.map(() => ({ h: 10, active: false }))
    });

    wx.showToast({ title: `完成 ${this.sessionCount} 次！`, icon: 'success' });
  },

  _onSquat() {
    this.sessionCount++;
    this.setData({ sessionCount: this.sessionCount });
    this._drawRing(this.sessionCount / this.data.dailyGoal);
    wx.vibrateShort({ type: 'light' });
  },

  _onWaveform(mag, history) {
    const bars = this.data.waveBars;
    for (let i = 0; i < bars.length; i++) {
      const idx = history.length - bars.length + i;
      if (idx < 0) continue;
      const v = history[idx];
      const h = Math.max(5, Math.min(100, ((v - 0.3) / 1.4) * 100));
      bars[i] = { h, active: (v > 1.22 || v < 0.78) };
    }
    this.setData({ waveBars: bars });
  },

  manualPlus() {
    if (!this.data.running) return;
    this.sessionCount++;
    this.setData({ sessionCount: this.sessionCount });
    this._drawRing(this.sessionCount / this.data.dailyGoal);
    wx.vibrateShort({ type: 'light' });
  },

  manualMinus() {
    if (!this.data.running || this.sessionCount <= 0) return;
    this.sessionCount--;
    this.setData({ sessionCount: this.sessionCount });
    this._drawRing(this.sessionCount / this.data.dailyGoal);
  },

  _drawRing(pct) {
    if (!this._ctx) return;
    pct = Math.min(pct, 1);
    const ctx = this._ctx;
    const cx = RING_SIZE / 2;
    const cy = RING_SIZE / 2;

    ctx.clearRect(0, 0, RING_SIZE, RING_SIZE);

    // 背景圆环
    ctx.beginPath();
    ctx.arc(cx, cy, RING_R, 0, 2 * Math.PI);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = RING_LINEWIDTH;
    ctx.lineCap = 'round';
    ctx.stroke();

    if (pct <= 0) return;

    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + 2 * Math.PI * pct;
    ctx.beginPath();
    ctx.arc(cx, cy, RING_R, startAngle, endAngle);
    ctx.strokeStyle = '#FF6B35';
    ctx.lineWidth = RING_LINEWIDTH;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
});
