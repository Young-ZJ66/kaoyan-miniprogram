const app = getApp()

Page({
  data: {
    downloadsList: [],
    categoryMap: {
      'politics': '政治',
      'english': '英语',
      'math': '数学',
      'major': '专业课'
    },
    currentCategory: 'all'
  },

  onLoad: function() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud-young-2gcblx0nb59a75fc',
        traceUser: true,
      })
    }
    this.loadDownloads()
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      })
    }
    this.loadDownloads()
  },

  // 切换分类
  switchCategory: function(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      currentCategory: category
    });
    this.loadDownloads();
  },

  // 加载下载记录
  loadDownloads: function() {
    wx.showLoading({
      title: '加载中...',
    })

    wx.cloud.callFunction({
      name: 'getDownloadList',
      data: {
        category: this.data.currentCategory === 'all' ? null : this.data.currentCategory
      }
    }).then(res => {
      if (res.result.success) {
        // 格式化数据和时间
        const downloadsList = res.result.data.map(item => ({
          ...item,
          createdAt: this.formatTime(item.createdAt)
        }))
        this.setData({
          downloadsList: downloadsList
        })
      } else {
        wx.showToast({
          title: '获取下载记录失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('获取下载记录失败：', err)
      wx.showToast({
        title: '获取下载记录失败',
        icon: 'none'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  // 格式化时间
  formatTime: function(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hour = d.getHours().toString().padStart(2, '0');
    const minute = d.getMinutes().toString().padStart(2, '0');
    const second = d.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  },

  // 点击列表项
  onItemTap: function(e) {
    const resourceId = e.currentTarget.dataset.resourceId;
    ;
    
    if (!resourceId) {
      console.error('资源ID为空');
      wx.showToast({
        title: '资源信息不完整',
        icon: 'none'
      });
      return;
    }

    // 跳转到资源详情页面
    wx.navigateTo({
      url: `/pages/resource/detail/index?id=${resourceId}`,
      fail: (err) => {
        console.error('跳转失败：', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 长按删除记录
  onItemLongPress: function(e) {
    const id = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;
    const title = this.data.downloadsList[index].title;

    wx.showModal({
      title: '删除下载记录',
      content: `确定要删除"${title}"的下载记录吗？`,
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.deleteDownloadRecord(id);
        }
      }
    });
  },

  // 删除下载记录
  deleteDownloadRecord: function(id) {
    wx.showLoading({
      title: '删除中...',
    });

    wx.cloud.callFunction({
      name: 'deleteDownloadRecord',
      data: { id }
    }).then(res => {
      if (res.result.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        // 重新加载下载记录
        this.loadDownloads();
      } else {
        wx.showToast({
          title: res.result.message || '删除失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('删除下载记录失败：', err);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }).finally(() => {
      wx.hideLoading();
    });
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    // 显示加载中提示框
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    // 重新加载下载记录
    wx.cloud.callFunction({
      name: 'getDownloadList',
      data: {
        category: this.data.currentCategory === 'all' ? null : this.data.currentCategory
      }
    }).then(res => {
      if (res.result.success) {
        // 格式化数据和时间
        const downloadsList = res.result.data.map(item => ({
          ...item,
          createdAt: this.formatTime(item.createdAt)
        }))
        this.setData({
          downloadsList: downloadsList
        })
      }
      // 不显示失败提示
    }).catch(err => {
      // 只记录错误，不显示提示
      console.error('刷新下载记录失败：', err)
    }).finally(() => {
      // 隐藏加载提示框
      wx.hideLoading();
      // 停止下拉刷新动画
      wx.stopPullDownRefresh();
    });
  }
}) 