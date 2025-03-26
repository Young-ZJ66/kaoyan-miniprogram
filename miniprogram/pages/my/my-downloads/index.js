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
        env: 'cloud1-9gbyqyqyb5f2cb69',
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
        // 处理时间格式
        const downloadsList = res.result.data.map(item => ({
          ...item,
          downloadTime: this.formatTime(item.downloadTime)
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
    const id = e.currentTarget.dataset.id;
    console.log('点击下载记录，资源ID：', id);
    
    if (!id) {
      console.error('资源ID为空');
      wx.showToast({
        title: '资源信息不完整',
        icon: 'none'
      });
      return;
    }

    // 跳转到资源详情页面
    wx.navigateTo({
      url: `/pages/resource/detail/index?id=${id}`,
      fail: (err) => {
        console.error('跳转失败：', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  }
}) 