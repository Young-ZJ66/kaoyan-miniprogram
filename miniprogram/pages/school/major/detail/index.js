Page({
  data: {
    schoolId: '',
    majorId: '',
    schoolInfo: {},
    majorInfo: {},
    isCollected: false,
    isLogin: false
  },

  onLoad(options) {
    if (options.majorId && options.schoolId) {
      this.setData({
        majorId: options.majorId,
        schoolId: options.schoolId
      })
      this.loadSchoolInfo()
      this.loadMajorInfo()
      this.checkCollectionStatus()
    }
    
    // 检查登录状态
    this.checkLoginStatus();
  },

  // 加载院校信息
  async loadSchoolInfo() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'school',
        data: {
          type: 'getSchoolDetail',
          data: {
            schoolId: this.data.schoolId
          }
        }
      })

      if (result.code === 0) {
        this.setData({
          schoolInfo: result.data
        })
      } else {
        wx.showToast({
          title: result.message || '加载院校信息失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.showToast({
        title: '加载院校信息失败',
        icon: 'none'
      })
    }
  },

  // 加载专业信息
  async loadMajorInfo() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'major',
        data: {
          type: 'getMajorDetail',
          data: {
            majorId: this.data.majorId,
            schoolId: this.data.schoolId
          }
        }
      })

      if (result.code === 0) {
        this.setData({
          majorInfo: result.data
        })
      } else {
        wx.showToast({
          title: result.message || '加载专业信息失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.showToast({
        title: '加载专业信息失败',
        icon: 'none'
      })
    }
  },

  // 检查收藏状态
  async checkCollectionStatus() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'major',
        data: {
          type: 'checkCollection',
          data: {
            majorId: this.data.majorId,
            schoolId: this.data.schoolId
          }
        }
      })

      const { code, data } = result.result
      if (code === 0) {
        this.setData({
          isCollected: data.isCollected
        })
      }
    } catch (err) {
      console.error('检查收藏状态失败：', err)
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({
      isLogin: !!userInfo
    });
  },
  
  // 显示登录提示
  showLoginTip() {
    wx.showModal({
      title: '提示',
      content: '请先登录后再收藏',
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/my/index'
          });
        }
      }
    });
  },

  // 切换收藏状态
  async toggleCollection() {
    if (!this.data.isLogin) {
      this.showLoginTip();
      return;
    }
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'major',
        data: {
          type: 'toggleCollection',
          data: {
            majorId: this.data.majorId,
            schoolId: this.data.schoolId
          }
        }
      })

      const { code, data } = result.result
      if (code === 0) {
        this.setData({
          isCollected: data.isCollected
        })
        wx.showToast({
          title: data.isCollected ? '收藏成功' : '已取消收藏',
          icon: 'success'
        })
      }
    } catch (err) {
      console.error('收藏操作失败：', err)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    // 显示加载中提示框
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    // 并行加载所有数据
    Promise.all([
      // 加载院校信息
      this.loadSchoolInfo().catch(err => {
        console.error('刷新院校信息失败：', err);
        return null;
      }),
      
      // 加载专业信息
      this.loadMajorInfo().catch(err => {
        console.error('刷新专业信息失败：', err);
        return null;
      }),
      
      // 检查收藏状态
      this.checkCollectionStatus().catch(err => {
        console.error('检查收藏状态失败：', err);
        return null;
      }),
      
      // 检查登录状态
      new Promise(resolve => {
        this.checkLoginStatus();
        resolve(null);
      })
    ])
    .finally(() => {
      // 隐藏加载提示框
      wx.hideLoading();
      // 停止下拉刷新动画
      wx.stopPullDownRefresh();
    });
  }
}) 