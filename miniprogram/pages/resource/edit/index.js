const app = getApp()

Page({
  data: {
    id: '',
    title: '',
    description: '',
    currentCategory: 'math',  // 默认选择数学
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
    loading: false,
    resourceDetail: null  // 添加 resourceDetail 字段
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
          resourceDetail,  // 保存完整的资源详情
          title: resourceDetail.title,
          description: resourceDetail.description || '',
          currentCategory: resourceDetail.category,
          fileID: resourceDetail.fileID,
          fileName: resourceDetail.fileName,
          fileSize: resourceDetail.rawSize || 0,  // 使用原始大小
          formattedFileSize: resourceDetail.size || '0B'  // 使用格式化后的大小
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
  formatFileSize(size) {
    const fileSize = parseInt(size) || 0;
    
    if (fileSize < 1024) {
      return fileSize + 'B';
    } else if (fileSize < 1024 * 1024) {
      return (fileSize / 1024).toFixed(2) + 'KB';
    } else if (fileSize < 1024 * 1024 * 1024) {
      return (fileSize / (1024 * 1024)).toFixed(2) + 'MB';
    } else {
      return (fileSize / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
    }
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

  // 提交表单
  async onSubmit() {
    try {
      const { title, currentCategory, description, filePath, fileName } = this.data;
      
      // 表单验证
      if (!title) {
        wx.showToast({
          title: '请输入标题',
          icon: 'none'
        });
        return;
      }

      if (!currentCategory) {
        wx.showToast({
          title: '请选择分类',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '保存中...'
      });

      let fileID = this.data.fileID;
      let size = this.data.fileSize;
      let formattedSize = this.data.formattedFileSize;

      // 如果上传了新文件
      if (filePath) {
        // 1. 获取文件信息
        const fileInfo = await wx.getFileInfo({
          filePath: filePath
        });

        // 格式化文件大小
        formattedSize = this.formatFileSize(fileInfo.size);
        size = fileInfo.size;

        // 2. 上传文件到云存储
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `resources/${Date.now()}_${Math.random().toString(36).substring(2)}_${fileName}`,
          filePath: filePath
        });

        if (!uploadRes.fileID) {
          throw new Error('文件上传失败');
        }

        fileID = uploadRes.fileID;
      }

      // 3. 调用云函数更新资源
      const res = await wx.cloud.callFunction({
        name: 'resources',
        data: {
          type: 'update',
          data: {
            id: this.data.resourceDetail._id,
            title,
            category: currentCategory,
            description,
            fileID,
            fileName,
            size: formattedSize,
            rawSize: size
          }
        }
      });

      if (!res.result || !res.result.success) {
        throw new Error(res.result?.message || '更新失败');
      }

      wx.hideLoading();
      wx.showToast({
        title: '更新成功',
        icon: 'success',
        duration: 2000,
        success: () => {
          // 获取页面栈
          const pages = getCurrentPages();
          
          // 遍历页面栈，找到需要刷新的页面
          pages.forEach(page => {
            // 刷新详情页
            if (page.route === 'pages/resource/detail/index') {
              page.loadResourceDetail(this.data.resourceDetail._id);
            }
            // 刷新首页资料列表
            if (page.route === 'pages/index/index') {
              page.loadResources();
            }
          });
          
          // 延迟返回，让用户看到成功提示
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });

    } catch (err) {
      console.error('更新失败：', err);
      wx.hideLoading();
      wx.showToast({
        title: err.message || '更新失败，请稍后重试',
        icon: 'none',
        duration: 2000
      });
    }
  }
}) 