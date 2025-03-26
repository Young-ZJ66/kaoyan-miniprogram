const app = getApp()

Page({
  data: {
    id: '',
    title: '',
    description: '',
    currentCategory: 'politics',  // 默认选择政治
    categoryMap: {
      'politics': '政治',
      'english': '英语',
      'math': '数学',
      'major': '专业课'
    },
    fileID: '',
    fileName: '',
    filePath: '',
    fileSize: '',
    formattedFileSize: '',
    loading: false
  },

  onLoad: function(options) {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }

    if (options.id) {
      this.setData({ id: options.id })
      this.loadResourceDetail(options.id)
    }
  },

  // 加载资源详情
  loadResourceDetail: function(id) {
    wx.showLoading({
      title: '加载中...',
    })

    wx.cloud.callFunction({
      name: 'resources',
      data: {
        type: 'getDetail',
        data: { id }
      }
    }).then(res => {
      console.log('获取资源详情结果：', res)
      if (res.result.success) {
        const resourceDetail = res.result.data
        this.setData({
          title: resourceDetail.title,
          description: resourceDetail.description || '',
          currentCategory: resourceDetail.type,
          fileID: resourceDetail.fileID,
          fileName: resourceDetail.fileName,
          fileSize: resourceDetail.size
        })
      } else {
        wx.showToast({
          title: res.result.message || '获取资料详情失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('获取资料详情失败：', err)
      wx.showToast({
        title: '获取资料详情失败',
        icon: 'none'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  // 切换分类
  switchCategory: function(e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      currentCategory: category
    })
  },

  // 选择新文件
  chooseFile: function() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        const file = res.tempFiles[0]
        console.log('选择的文件：', file)
        // 获取文件大小并格式化
        const size = file.size
        const formattedSize = this.formatFileSize(size)
        this.setData({
          fileName: file.name,
          filePath: file.path,
          fileSize: size,
          formattedFileSize: formattedSize
        })
      }
    })
  },

  // 格式化文件大小
  formatFileSize: function(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  },

  // 删除文件
  deleteFile: function() {
    this.setData({
      fileName: '',
      filePath: '',
      fileSize: 0,
      formattedFileSize: ''
    })
  },

  // 上传新文件
  uploadFile: function(filePath) {
    return new Promise((resolve, reject) => {
      if (!filePath) {
        reject(new Error('请选择文件'))
        return
      }

      const cloudPath = `resources/${Date.now()}-${Math.random().toString(36).substr(2)}-${this.data.fileName}`
      
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
  },

  // 提交更新
  submitUpdate: function() {
    if (!this.data.title) {
      wx.showToast({
        title: '请输入资料标题',
        icon: 'none'
      })
      return
    }

    if (this.data.loading) return
    this.setData({ loading: true })

    wx.showLoading({
      title: '更新中...',
    })

    // 如果有新文件，先上传文件
    let updatePromise = Promise.resolve(this.data.fileID)
    if (this.data.filePath) {
      updatePromise = this.uploadFile(this.data.filePath)
    }

    updatePromise.then(fileID => {
      // 调用云函数更新资料信息
      return wx.cloud.callFunction({
        name: 'resources',
        data: {
          type: 'update',
          data: {
            id: this.data.id,
            title: this.data.title,
            category: this.data.currentCategory,
            description: this.data.description,
            fileID: fileID,
            fileName: this.data.fileName,
            size: this.data.formattedFileSize,
            rawSize: this.data.fileSize
          }
        }
      })
    }).then(res => {
      if (res.result.success) {
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        })
        // 延迟返回，让用户看到成功提示
        setTimeout(() => {
          // 返回详情页并刷新
          const pages = getCurrentPages()
          const prevPage = pages[pages.length - 2]
          if (prevPage) {
            prevPage.loadResourceDetail(this.data.id)
          }
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({
          title: res.result.message || '更新失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('更新失败：', err)
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }).finally(() => {
      wx.hideLoading()
      this.setData({ loading: false })
    })
  }
}) 