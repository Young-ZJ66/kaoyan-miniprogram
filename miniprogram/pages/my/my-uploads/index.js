const app = getApp()

Page({
  data: {
    resourcesList: [],
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
    this.loadResources()
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      })
    }
    this.loadResources()
  },

  // 切换分类
  switchCategory: function(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      currentCategory: category
    });
    this.loadResources();
  },

  // 加载资源列表
  loadResources: function() {
    wx.showLoading({
      title: '加载中...',
    })

    wx.cloud.callFunction({
      name: 'getUploadList',
      data: {
        page: 1,
        pageSize: 20,
        category: this.data.currentCategory === 'all' ? null : this.data.currentCategory
      }
    }).then(res => {
      if (res.result.success) {
        // 处理时间格式
        const resourcesList = res.result.data.map(item => ({
          ...item,
          createdAt: this.formatTime(item.createdAt)
        }))
        this.setData({
          resourcesList: resourcesList
        })
      } else {
        wx.showToast({
          title: '获取上传记录失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('获取上传记录失败：', err)
      wx.showToast({
        title: '获取上传记录失败',
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

  // 跳转到资源详情
  goToResourceDetail: function(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/resource/detail/index?id=${id}`
    })
  }
}) 