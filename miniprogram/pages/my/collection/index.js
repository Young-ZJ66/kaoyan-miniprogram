Page({
  data: {
    collections: []
  },

  onLoad() {
    this.loadCollections()
  },

  onShow() {
    this.loadCollections()
  },

  // 加载收藏列表
  async loadCollections() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    try {
      const result = await wx.cloud.callFunction({
        name: 'major',
        data: {
          type: 'getCollections',
          data: {}
        }
      })

      wx.hideLoading();
      const { code, data } = result.result
      if (code === 0) {
        this.setData({
          collections: data.list
        })
      } else {
        wx.showToast({
          title: data.message || '加载收藏列表失败',
          icon: 'none'
        })
      }
    } catch (err) {
      wx.hideLoading();
      console.error('加载收藏列表失败：', err)
      wx.showToast({
        title: '加载收藏列表失败',
        icon: 'none'
      })
    }
  },

  // 跳转到专业详情
  navigateToMajorDetail(e) {
    const { majorId, schoolId } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/school/major/detail/index?majorId=${majorId}&schoolId=${schoolId}`
    })
  },

  // 下拉刷新函数
  onPullDownRefresh: function() {
    // 显示加载中提示框
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    // 重新加载收藏列表
    wx.cloud.callFunction({
      name: 'major',
      data: {
        type: 'getCollections',
        data: {}
      }
    }).then(result => {
      const { code, data } = result.result
      if (code === 0) {
        this.setData({
          collections: data.list
        })
      }
    }).catch(err => {
      console.error('刷新收藏列表失败：', err)
    }).finally(() => {
      // 隐藏加载提示框
      wx.hideLoading();
      // 停止下拉刷新动画
      wx.stopPullDownRefresh();
    });
  }
}) 