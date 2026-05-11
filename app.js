App({
  onLaunch() {
    const settings = wx.getStorageSync('settings') || {};
    if (!settings.dailyGoal) {
      wx.setStorageSync('settings', { dailyGoal: 100, calibrated: false });
    }
  },

  globalData: {
    currentSession: null
  }
});
