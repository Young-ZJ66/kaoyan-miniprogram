const app = getApp()

Page({
  data: {
    title: '',
    description: '',
    fileName: '',
    filePath: '',
    fileSize: 0,
    formattedFileSize: '',
    currentCategory: 'math',  // 默认选择政治
    categoryMap: {
      'politics': '政治',
      'english': '英语',
      'math': '数学',
      'major': '专业课'
    }
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

    // 检查用户是否登录
    this.checkLoginStatus()
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再上传文件',
        showCancel: false,
        success: () => {
          // 返回上一页
          wx.navigateBack()
        }
      })
      return false
    }
    return true
  },

  // 切换分类
  switchCategory: function(e) {
    const category = e.currentTarget.dataset.category
    
    this.setData({
      currentCategory: category
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

  // 选择文件
  chooseFile: function() {
    // 检查登录状态
    if (!this.checkLoginStatus()) return

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        const file = res.tempFiles[0]
        
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

  // 删除文件
  deleteFile: function() {
    this.setData({
      fileName: '',
      filePath: '',
      fileSize: 0,
      formattedFileSize: ''
    })
  },

  // 上传文件
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

  // 提交上传
  submitUpload: function() {
    // 检查登录状态
    if (!this.checkLoginStatus()) return

    if (!this.data.title) {
      wx.showToast({
        title: '请输入资料标题',
        icon: 'none'
      })
      return
    }

    if (!this.data.filePath) {
      wx.showToast({
        title: '请选择要上传的文件',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '上传中...',
    })

    // 先上传文件
    this.uploadFile(this.data.filePath).then(fileID => {
      // 调用云函数保存资料信息
      const userInfo = wx.getStorageSync('userInfo')
      return wx.cloud.callFunction({
        name: 'resources',
        data: {
          type: 'add',
          data: {
            title: this.data.title,
            category: this.data.currentCategory,
            description: this.data.description,
            fileID: fileID,
            fileName: this.data.fileName,
            size: this.data.formattedFileSize,
            rawSize: this.data.fileSize,
            nickName: userInfo.nickName
          }
        }
      })
    }).then(res => {
      // 先隐藏上传中的loading提示
      wx.hideLoading()
      
      if (res.result.success) {
        wx.showToast({
          title: '上传成功',
          icon: 'success'
        })
        
        // 延迟返回，让用户看到成功提示
        setTimeout(() => {
          // 查找并刷新首页
          const pages = getCurrentPages()
          
          // 遍历所有页面，查找首页
          let indexPage = null
          for (let i = 0; i < pages.length; i++) {
            if (pages[i].route === 'pages/index/index') {
              indexPage = pages[i]
              break
            }
          }
          
          // 如果找到首页，重置页数并刷新资料列表
          if (indexPage) {
            indexPage.setData({
              page: 1,
              resourcesList: []
            }, () => {
              indexPage.loadResources()
            })
          }
          
          // 返回上一页
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({
          title: res.result.message || '上传失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      // 确保发生错误时也隐藏loading提示
      wx.hideLoading()
      
      console.error('上传失败：', err)
      wx.showToast({
        title: '上传失败',
        icon: 'none'
      })
    })
  }
}) 