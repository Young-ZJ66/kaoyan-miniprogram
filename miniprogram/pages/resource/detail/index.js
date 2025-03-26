const app = getApp()

Page({
  data: {
    resourceDetail: null,
    loading: true,
    categoryMap: {
      'politics': '政治',
      'english': '英语',
      'math': '数学',
      'major': '专业课'
    },
    isUploader: false,
    userOpenid: ''
  },

  onLoad: function(options) {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-9gbyqyqyb5f2cb69',
        traceUser: true,
      })
    }

    if (options.id) {
      // 先检查登录状态
      const isLoggedIn = wx.getStorageSync('isLoggedIn');
      if (isLoggedIn) {
        // 已登录状态，获取openid并加载详情
        this.getOpenId().then(() => {
          this.loadResourceDetail(options.id);
        });
      } else {
        // 未登录状态，直接加载详情
        this.loadResourceDetail(options.id);
      }
    }
  },

  // 获取用户openid
  async getOpenId() {
    try {
      // 检查登录状态
      const isLoggedIn = wx.getStorageSync('isLoggedIn');
      if (!isLoggedIn) {
        console.log('用户未登录，无法获取openid');
        return;
      }

      const res = await wx.cloud.callFunction({
        name: 'getOpenId'
      });
      
      this.setData({ userOpenid: res.result.openid });
    } catch (err) {
      console.error('获取openid失败：', err);
    }
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

  // 加载资料详情
  loadResourceDetail: function(id) {
    console.log('开始加载资源详情，ID：', id)
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
        // 处理时间格式
        const resourceDetail = {
          ...res.result.data,
          createTime: this.formatTime(res.result.data.createTime),
          updateTime: this.formatTime(res.result.data.updateTime)
        };
        console.log('处理后的资源详情：', resourceDetail)
        // 检查必要的字段是否存在
        if (!resourceDetail.fileID) {
          console.error('资源详情缺少 fileID')
          wx.showToast({
            title: '资源文件不存在',
            icon: 'none'
          })
          return
        }
        
        // 检查用户是否登录
        const userInfo = wx.getStorageSync('userInfo');
        // 检查是否为上传者（确保用户已登录、两个openid都存在且相等）
        const isUploader = userInfo && this.data.userOpenid && resourceDetail._openid && 
                          this.data.userOpenid === resourceDetail._openid;
        
        console.log('用户身份检查：', {
          isLoggedIn: !!userInfo,
          userOpenid: this.data.userOpenid,
          resourceOpenid: resourceDetail._openid,
          isUploader: isUploader
        });
        
        this.setData({
          resourceDetail: resourceDetail,
          loading: false,
          isUploader: isUploader
        })
      } else {
        console.error('获取资源详情失败：', res.result)
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

  // 获取文件扩展名
  getFileExtension: function(fileName) {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  },

  // 下载资料
  downloadResource: function() {
    // 检查用户是否登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再下载',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/my/index'
            });
          }
        }
      });
      return;
    }

    if (!this.data.resourceDetail) {
      console.error('资源详情为空')
      return
    }

    if (!this.data.resourceDetail.fileID) {
      console.error('资源文件ID为空')
      wx.showToast({
        title: '资源文件不存在',
        icon: 'none'
      })
      return
    }

    console.log('开始下载资源，fileID：', this.data.resourceDetail.fileID)

    wx.showLoading({
      title: '下载中...',
    })

    // 先获取文件下载链接
    wx.cloud.getTempFileURL({
      fileList: [{
        fileID: this.data.resourceDetail.fileID,
        maxAge: 3600 // 链接有效期一小时
      }]
    }).then(res => {
      console.log('获取下载链接结果：', res)
      if (!res.fileList || !res.fileList[0]) {
        throw new Error('获取下载链接失败：返回结果为空')
      }
      
      if (res.fileList[0].status !== 0) {
        throw new Error(`获取下载链接失败：${res.fileList[0].errMsg || '未知错误'}`)
      }

      if (!res.fileList[0].tempFileURL) {
        throw new Error('获取下载链接失败：链接为空')
       }

      const downloadUrl = res.fileList[0].tempFileURL
      console.log('获取到的下载链接：', downloadUrl)

      // 下载文件
      return new Promise((resolve, reject) => {
        const fileName = this.data.resourceDetail.fileName || '未命名文件'
        // 获取文件扩展名
        const fileExt = this.getFileExtension(fileName)
        // 构建保存路径，使用原始文件名
        const savePath = `${wx.env.USER_DATA_PATH}/${fileName}`
        console.log('文件保存路径：', savePath)

        wx.downloadFile({
          url: downloadUrl,
          filePath: savePath,  // 直接指定完整的文件路径和文件名
          success: (downloadRes) => {
            console.log('下载文件结果：', downloadRes)
            if (downloadRes.statusCode === 200) {
              resolve(downloadRes.filePath)  // 使用下载后的文件路径
            } else {
              reject(new Error(`下载失败，状态码：${downloadRes.statusCode}`))
            }
          },
          fail: (err) => {
            console.error('下载文件失败：', err)
            reject(new Error('下载文件失败：' + (err.errMsg || '未知错误')))
          }
        })
      })
    }).then(filePath => {
      console.log('文件下载成功，路径：', filePath)
      // 文件下载成功后，更新下载次数
      return wx.cloud.callFunction({
        name: 'resources',
        data: {
          type: 'download',
          data: { id: this.data.resourceDetail._id }
        }
      }).then(res => {
        console.log('更新下载次数结果：', res)
        if (!res.result.success) {
          console.error('更新下载次数失败：', res.result)
          throw new Error('更新下载次数失败')
        }
        // 检查用户是否登录
        const userInfo = wx.getStorageSync('userInfo')
        if (userInfo) {
          // 用户已登录，记录下载历史
          return wx.cloud.callFunction({
            name: 'resources',
            data: {
              type: 'recordDownload',
              data: { id: this.data.resourceDetail._id }
            }
          }).then(res => {
            console.log('记录下载历史结果：', res)
            if (!res.result.success) {
              console.error('记录下载历史失败：', res.result)
              throw new Error('记录下载历史失败')
            }
            return filePath
          })
        } else {
          // 用户未登录，直接返回文件路径
          return filePath
        }
      })
    }).then(filePath => {
      // 显示成功提示并打开文件
      wx.showModal({
        title: '下载成功',
        content: `文件"${this.data.resourceDetail.fileName}"已保存到本地，是否立即打开？`,
        success: (res) => {
          if (res.confirm) {
            // 打开文件
            wx.openDocument({
              filePath: filePath,
              showMenu: true,
              success: () => {
                console.log('打开文件成功')
              },
              fail: (err) => {
                console.error('打开文件失败：', err)
                wx.showToast({
                  title: '打开文件失败',
                  icon: 'none'
                })
              }
            })
          }
        }
      })
    }).catch(err => {
      console.error('下载失败：', err)
      wx.showModal({
        title: '提示',
        content: err.message || '文件下载失败，请稍后重试',
        showCancel: false
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  // 跳转到编辑页面
  goToEdit: function() {
    if (!this.data.resourceDetail) return;
    
    wx.navigateTo({
      url: `/pages/resource/edit/index?id=${this.data.resourceDetail._id}`,
      fail: (err) => {
        console.error('跳转到编辑页面失败：', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 删除资源
  deleteResource: function() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个资料吗？此操作不可恢复。',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
          })

          wx.cloud.callFunction({
            name: 'resources',
            data: {
              type: 'delete',
              data: {
                id: this.data.resourceDetail._id
              }
            }
          }).then(res => {
            if (res.result.success) {
              wx.showToast({
                title: '删除成功',
                icon: 'success',
                duration: 2000,
                success: () => {
                  // 延迟返回上一页，让用户看到成功提示
                  setTimeout(() => {
                    wx.navigateBack()
                  }, 2000)
                }
              })
            } else {
              wx.showToast({
                title: res.result.message || '删除失败',
                icon: 'none'
              })
            }
          }).catch(err => {
            console.error('删除资源失败：', err)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }).finally(() => {
            wx.hideLoading()
          })
        }
      }
    })
  }
}) 