const storage = require('../../utils/storage');

Page({
  data: { groups: [] },

  onShow() {
    this.loadRecords();
  },

  loadRecords() {
    const records = storage.getRecords();
    const today = storage.formatDate(new Date());
    const yesterday = storage.formatDate(
      new Date(Date.now() - 86400000)
    );

    const groups = [];
    const todayRecords = [];
    const yesterdayRecords = [];
    const olderRecords = [];

    records.forEach(r => {
      r.durationText = storage.formatDuration(r.duration || 0);
      if (r.date === today) {
        todayRecords.push(r);
      } else if (r.date === yesterday) {
        yesterdayRecords.push(r);
      } else {
        olderRecords.push(r);
      }
    });

    if (todayRecords.length) {
      groups.push({ label: '今天', records: todayRecords });
    }
    if (yesterdayRecords.length) {
      groups.push({ label: '昨天', records: yesterdayRecords });
    }
    if (olderRecords.length) {
      const byDate = {};
      olderRecords.forEach(r => {
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push(r);
      });
      Object.keys(byDate)
        .sort()
        .reverse()
        .forEach(date => {
          groups.push({
            label: `${date} ${this._dayOfWeek(date)}`,
            records: byDate[date]
          });
        });
    }

    this.setData({ groups });
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录',
      content: '确定要删除这条记录吗？',
      success: res => {
        if (res.confirm) {
          storage.deleteRecord(id);
          this.loadRecords();
        }
      }
    });
  },

  _dayOfWeek(dateStr) {
    const d = new Date(dateStr);
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  }
});
