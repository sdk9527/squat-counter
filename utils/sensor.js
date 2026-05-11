/*
  深蹲检测器
  用「重力方向投影」提取上下方向的加速度分量，过滤左右晃动。
  原理：用低通滤波估算重力方向，将每次加速度读数投影到该方向，
  投影值 ≈ 1.0（静止）、< 阈值（下蹲）、> 阈值（起立）。
*/
const STATE = { IDLE: 0, GOING_DOWN: 1, GOING_UP: 2 };

const SPEED_PRESETS = {
  1: { down: 0.84, up: 1.16, idleLow: 0.85, idleHigh: 1.15, confirm: 2, downMs: 100, range: 0.30 },
  2: { down: 0.78, up: 1.22, idleLow: 0.85, idleHigh: 1.15, confirm: 3, downMs: 150, range: 0.40 },
  3: { down: 0.72, up: 1.28, idleLow: 0.85, idleHigh: 1.15, confirm: 3, downMs: 200, range: 0.50 },
};
const MIN_CYCLE_MS = 300;
const MAX_CYCLE_MS = 4000;

class SquatDetector {
  constructor() {
    this.state = STATE.IDLE;
    this.confirm = 0;
    this.lastCountTime = 0;
    this.phaseStartTime = 0;
    this.countCallback = null;
    this.waveformCallback = null;
    this.running = false;
    this.history = [];
    this.th = SPEED_PRESETS[2]; // 默认中速

    // 重力方向估算
    this.gx = 0;
    this.gy = 0;
    this.gz = -1;
    this.gravityReady = false;

    this._onData = this._onData.bind(this);
  }

  start(countCallback, waveformCallback, speedLevel) {
    this.state = STATE.IDLE;
    this.confirm = 0;
    this.lastCountTime = 0;
    this.phaseStartTime = 0;
    this.history = [];
    this.gravityReady = false;
    this.peakLow = 1.0;
    this.peakHigh = 1.0;
    this.countCallback = countCallback || null;
    this.waveformCallback = waveformCallback || null;
    this.th = SPEED_PRESETS[speedLevel] || SPEED_PRESETS[2];
    this.running = true;

    wx.startAccelerometer({
      interval: 'game',
      success: () => wx.onAccelerometerChange(this._onData),
      fail: () => { this.running = false; }
    });
  }

  stop() {
    this.running = false;
    try { wx.stopAccelerometer(); wx.offAccelerometerChange(this._onData); } catch (e) {}
  }

  // 获取沿重力方向的加速度投影值
  _getVertical(x, y, z) {
    if (!this.gravityReady) {
      this.gx = x; this.gy = y; this.gz = z;
      this.gravityReady = true;
      return 1.0;
    }
    const alpha = 0.02;
    this.gx += alpha * (x - this.gx);
    this.gy += alpha * (y - this.gy);
    this.gz += alpha * (z - this.gz);
    const len = Math.sqrt(this.gx * this.gx + this.gy * this.gy + this.gz * this.gz);
    return x * (this.gx / len) + y * (this.gy / len) + z * (this.gz / len);
  }

  _onData(res) {
    if (!this.running) return;
    const v = this._getVertical(res.x, res.y, res.z);
    this.history.push(v);
    if (this.history.length > 80) this.history.shift();
    if (this.waveformCallback) this.waveformCallback(v, this.history);
    this._detectSquat(v);
  }

  _detectSquat(v) {
    const now = Date.now();
    const t = this.th;

    switch (this.state) {
      case STATE.IDLE:
        if (v < t.down) {
          this.confirm++;
          if (this.confirm >= t.confirm) {
            this.state = STATE.GOING_DOWN;
            this.confirm = 0;
            this.phaseStartTime = now;
            this.peakLow = v;
            this.peakHigh = v;
          }
        } else {
          this.confirm = 0;
        }
        break;

      case STATE.GOING_DOWN:
        this.peakLow = Math.min(this.peakLow, v);
        this.peakHigh = Math.max(this.peakHigh, v);
        if (v > t.up && now - this.phaseStartTime >= t.downMs) {
          this.confirm++;
          if (this.confirm >= t.confirm) {
            this.state = STATE.GOING_UP;
            this.confirm = 0;
            this.phaseStartTime = now;
          }
        } else {
          this.confirm = 0;
        }
        if (now - this.phaseStartTime > MAX_CYCLE_MS) {
          this.state = STATE.IDLE; this.confirm = 0;
        }
        break;

      case STATE.GOING_UP:
        this.peakLow = Math.min(this.peakLow, v);
        this.peakHigh = Math.max(this.peakHigh, v);
        if (v > t.idleLow && v < t.idleHigh) {
          this.confirm++;
          if (this.confirm >= t.confirm) {
            if (now - this.lastCountTime >= MIN_CYCLE_MS) {
              // 检查波峰波谷幅度是否足够大（过滤小幅度误触）
              if (this.peakHigh - this.peakLow >= t.range) {
                this.lastCountTime = now;
                this.state = STATE.IDLE;
                this.confirm = 0;
                if (this.countCallback) this.countCallback();
              } else {
                this.state = STATE.IDLE; this.confirm = 0;
              }
            } else {
              this.state = STATE.IDLE; this.confirm = 0;
            }
          }
        } else {
          this.confirm = 0;
        }
        if (now - this.phaseStartTime > MAX_CYCLE_MS) {
          this.state = STATE.IDLE; this.confirm = 0;
        }
        break;
    }
  }

  getMagnitude() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : 1.0;
  }
}

module.exports = SquatDetector;
