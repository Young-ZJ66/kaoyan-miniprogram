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
    try {
      const result = await wx.cloud.callFunction({
        name: 'major',
        data: {
          type: 'getCollections',
          data: {}
        }
      })

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
  }
}) 