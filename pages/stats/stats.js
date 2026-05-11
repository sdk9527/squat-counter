const storage = require('../../utils/storage');

Page({
  data: {
    weekTotal: 0,
    monthTotal: 0,
    totalCount: 0,
    streak: 0,
    chartData: [],
    maxCount: 1,
    best: { maxCount: 0, maxDuration: 0 },
    bestDurationText: '00:00',
    monthGoal: 600,
    monthPct: 0
  },

  onShow() {
    this.loadStats();
  },

  loadStats() {
    const week = storage.getWeekStats();
    const month = storage.getMonthStats();
    const total = storage.getTotalStats();
    const chartData = storage.getWeeklyChartData();
    const streak = storage.getStreak();
    const best = storage.getBestRecord();
    const maxCount = Math.max(1, ...chartData.map(d => d.count));
    const monthGoal = 600;
    const monthPct = Math.min(100, Math.floor(month.total / monthGoal * 100));

    this.setData({
      weekTotal: week.total,
      monthTotal: month.total,
      totalCount: total.total,
      streak,
      chartData,
      maxCount,
      best,
      bestDurationText: storage.formatDuration(best.maxDuration),
      monthGoal,
      monthPct
    });
  }
});
