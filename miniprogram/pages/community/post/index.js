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
  async publishPost() {
    if (!this.data.canPublish) return

    wx.showLoading({
      title: '发布中...',
    })

    try {
      // 上传图片到云存储
      const uploadTasks = this.data.images.map(filePath => {
        return wx.cloud.uploadFile({
          cloudPath: `posts/${Date.now()}-${Math.random().toString(36).substr(2)}.${filePath.match(/\.[^.]+?$/)[0]}`,
          filePath
        })
      })

      let fileIDs = []
      if (uploadTasks.length > 0) {
        const uploadResults = await Promise.all(uploadTasks)
        fileIDs = uploadResults.map(res => res.fileID)
      }

      // 调用云函数发布帖子
      const result = await wx.cloud.callFunction({
        name: 'createPost',
        data: {
          content: this.data.content.trim(),
          images: fileIDs
        }
      })

      if (result.result.success) {
        wx.showToast({
          title: '发布成功',
          icon: 'success'
        })
        
        // 返回上一页并刷新
        setTimeout(() => {
          const pages = getCurrentPages()
          const prevPage = pages[pages.length - 2]
          if (prevPage) {
            prevPage.loadPosts && prevPage.loadPosts()
          }
          wx.navigateBack()
        }, 1500)
      } else {
        throw new Error(result.result.message || '发布失败')
      }
    } catch (error) {
      wx.showToast({
        title: error.message || '发布失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  }
}) 