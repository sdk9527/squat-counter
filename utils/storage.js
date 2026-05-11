const RECORDS_KEY = 'squat_records';
const SETTINGS_KEY = 'settings';
const SPEED_KEY = 'squat_speed';

function getRecords() {
  return wx.getStorageSync(RECORDS_KEY) || [];
}

function saveRecord(record) {
  const records = getRecords();
  records.unshift(record);
  wx.setStorageSync(RECORDS_KEY, records);
  return records;
}

function deleteRecord(id) {
  let records = getRecords();
  records = records.filter(r => r.id !== id);
  wx.setStorageSync(RECORDS_KEY, records);
  return records;
}

function getSettings() {
  const defaults = { dailyGoal: 100 };
  const settings = wx.getStorageSync(SETTINGS_KEY) || {};
  return Object.assign(defaults, settings);
}

function saveSettings(settings) {
  const current = getSettings();
  wx.setStorageSync(SETTINGS_KEY, Object.assign(current, settings));
}

function getTodayCount() {
  const records = getRecords();
  const today = formatDate(new Date());
  return records
    .filter(r => r.date === today)
    .reduce((sum, r) => sum + r.count, 0);
}

function getWeekStats() {
  const records = getRecords();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const since = formatDate(weekAgo);

  const weekRecords = records.filter(r => r.date >= since);
  return {
    total: weekRecords.reduce((s, r) => s + r.count, 0),
    sessions: weekRecords.length
  };
}

function getMonthStats() {
  const records = getRecords();
  const now = new Date();
  const monthStart = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));

  const monthRecords = records.filter(r => r.date >= monthStart);
  return {
    total: monthRecords.reduce((s, r) => s + r.count, 0),
    sessions: monthRecords.length
  };
}

function getTotalStats() {
  const records = getRecords();
  return {
    total: records.reduce((s, r) => s + r.count, 0),
    sessions: records.length
  };
}

function getWeeklyChartData() {
  const records = getRecords();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    const dayTotal = records
      .filter(r => r.date === dateStr)
      .reduce((s, r) => s + r.count, 0);
    days.push({
      date: dateStr,
      label: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
      count: dayTotal
    });
  }
  return days;
}

function getStreak() {
  const records = getRecords();
  if (records.length === 0) return 0;

  const dates = [...new Set(records.map(r => r.date))].sort().reverse();
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    if (dates[i] === formatDate(expected)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function getBestRecord() {
  const records = getRecords();
  if (records.length === 0) return { maxCount: 0, maxDuration: 0 };

  const maxCount = Math.max(...records.map(r => r.count));
  const maxDuration = Math.max(...records.map(r => r.duration || 0));
  return { maxCount, maxDuration };
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 速度档位：1=慢速(灵敏) 2=中速(默认) 3=快速(费力)
function getSpeedLevel() {
  return wx.getStorageSync(SPEED_KEY) || 2;
}
function setSpeedLevel(level) {
  wx.setStorageSync(SPEED_KEY, level);
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = {
  getRecords,
  saveRecord,
  deleteRecord,
  getSettings,
  saveSettings,
  getTodayCount,
  getWeekStats,
  getMonthStats,
  getTotalStats,
  getWeeklyChartData,
  getStreak,
  getBestRecord,
  formatDate,
  formatDuration,
  generateId,
  getSpeedLevel,
  setSpeedLevel
};
