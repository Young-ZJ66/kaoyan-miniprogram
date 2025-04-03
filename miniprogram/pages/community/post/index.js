const app = getApp()

Page({
  data: {
    content: '',
    images: [],
    canPublish: false,
    hasContent: false
  },

  onLoad() {
    // 页面加载时的逻辑
  },

  // 页面显示时的逻辑
  onShow() {
    this.checkCanPublish()
  },

  // 页面即将关闭时的逻辑
  onUnload() {
    // 页面关闭时的清理逻辑
  },

  // 处理点击左上角返回按钮
  onNavigateBack() {
    if (this.data.hasContent) {
      wx.showModal({
        title: '提示',
        content: '确定要放弃此次编辑吗？',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack()
          }
        }
      })
    } else {
      wx.navigateBack()
    }
  },

  // 内容输入处理
  onContentInput(e) {
    this.setData({
      content: e.detail.value
    })
    this.checkCanPublish()
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 9 - this.data.images.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFiles
        const newImages = tempFiles.map(file => file.tempFilePath)
        this.setData({
          images: [...this.data.images, ...newImages]
        })
        this.checkCanPublish()
      }
    })
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({
      current: url,
      urls: this.data.images
    })
  },

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.images
    images.splice(index, 1)
    this.setData({ images })
    this.checkCanPublish()
  },

  // 检查是否可以发布
  checkCanPublish() {
    const hasContent = this.data.content.trim().length > 0 || this.data.images.length > 0
    const canPublish = hasContent
    this.setData({ canPublish, hasContent })
  },

  // 发布帖子
  async submitPost() {
    const { content, images } = this.data
    
    if (!content && images.length === 0) {
      wx.showToast({
        title: '请输入内容或上传图片',
        icon: 'none'
      })
      return
    }
    
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }
    
    wx.showLoading({
      title: '发布中...'
    })
    
    try {
      // 上传图片到云存储
      let uploadedImages = []
      if (images.length > 0) {
        wx.showLoading({
          title: '上传图片中...'
        })
        
        const uploadPromises = images.map((filePath, index) => {
          return new Promise((resolve, reject) => {
            const cloudPath = `posts/${Date.now()}_${index}_${Math.random().toString(36).substring(2)}.${filePath.match(/\.([^.]+)$/)[1] || 'png'}`
            wx.cloud.uploadFile({
              cloudPath,
              filePath,
              success: res => {
                resolve(res.fileID)
              },
              fail: err => {
                reject(err)
              }
            })
          })
        })
        
        try {
          uploadedImages = await Promise.all(uploadPromises)
        } catch (uploadError) {
          wx.hideLoading()
          wx.showToast({
            title: '图片上传失败',
            icon: 'none'
          })
          return
        }
      }
      
      // 调用云函数发布帖子
      const result = await wx.cloud.callFunction({
        name: 'forum',
        data: {
          type: 'createPost',
          data: {
            content,
            images: uploadedImages
          }
        }
      })
      
      wx.hideLoading()
      
      if (result.result.success) {
        // 设置需要刷新社区页面的标记
        if (getApp().globalData) {
          getApp().globalData.forumNeedsRefresh = true
        }
        
        wx.showToast({
          title: '发布成功',
          icon: 'success',
          duration: 2000,
          success: () => {
            // 延迟返回，让用户看到成功提示
            setTimeout(() => {
              wx.navigateBack()
            }, 1500)
          }
        })
      } else {
        wx.showToast({
          title: result.result.message || '发布失败',
          icon: 'none'
        })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({
        title: '发布失败',
        icon: 'none'
      })
    }
  }
}) 