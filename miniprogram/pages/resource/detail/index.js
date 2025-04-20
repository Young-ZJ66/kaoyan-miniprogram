const app = getApp()

Page({
  data: {
    resourceDetail: null,
    loading: true,
    loadingText: '加载中...',
    categoryMap: {
      'politics': '政治',
      'english': '英语',
      'math': '数学',
      'major': '专业课'
    },
    isUploader: false,
    userOpenid: '',
    isOwner: false,
    hasPermission: false
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
      // 先获取openid，再加载详情
      const isLoggedIn = wx.getStorageSync('isLoggedIn');
      if (isLoggedIn) {
        this.getOpenId().then(openid => {
          this.setData({ userOpenid: openid });
          this.loadResourceDetail(options.id);
        });
      } else {
        this.loadResourceDetail(options.id);
      }
    }
  },

  // 获取用户openid
  async getOpenId() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getOpenId'
      });
      return res.result.openid;
    } catch (err) {
      console.error('获取openid失败：', err);
      return null;
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

  // 检查是否为上传者
  checkIsUploader: function(resourceDetail) {
    const userInfo = wx.getStorageSync('userInfo');
    return userInfo && this.data.userOpenid && resourceDetail._openid && 
           this.data.userOpenid === resourceDetail._openid;
  },

  // 加载资料详情
  loadResourceDetail: function(id) {
    
    // 显示加载提示
    wx.showLoading({
      title: '加载中...',
    })
    
    // 先检查缓存
    const cachedData = wx.getStorageSync(`resource_${id}`);
    if (cachedData) {
      const resourceDetail = {
        ...cachedData,
        createdAt: this.formatTime(cachedData.createdAt),
        updatedAt: this.formatTime(cachedData.updatedAt)
      };
      this.setData({
        resourceDetail: resourceDetail,
        loading: false,
        isUploader: this.checkIsUploader(resourceDetail)
      });
    }

    // 同时请求新数据
    wx.cloud.callFunction({
      name: 'resources',
      data: {
        type: 'getDetail',
        data: { id }
      }
    }).then(res => {
      if (res.result.success) {
        const data = res.result.data;
        
        // 处理时间格式
        const resourceDetail = {
          ...data,
          createdAt: this.formatTime(data.createdAt),
          updatedAt: this.formatTime(data.updatedAt)
        };
        
        // 检查必要的字段是否存在
        if (!resourceDetail.fileID) {
          console.error('资源详情缺少 fileID')
          wx.showToast({
            title: '资源文件不存在',
            icon: 'none'
          })
          return
        }
        
        // 更新缓存
        wx.setStorageSync(`resource_${id}`, data);
        
        // 检查是否为上传者
        const isUploader = this.checkIsUploader(resourceDetail);
        
        this.setData({
          resourceDetail: resourceDetail,
          loading: false,
          isUploader: isUploader
        }, () => {
          // 延迟加载权限检查
          setTimeout(() => {
            this.checkUserPermission();
          }, 0);
        });
      } else {
        console.error('获取资源详情失败：', res.result)
        wx.showToast({
          title: res.result.message || '获取资料详情失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('获取资源详情失败：', err)
      wx.showToast({
        title: '获取资料详情失败',
        icon: 'none'
      })
    }).finally(() => {
      // 隐藏加载提示
      wx.hideLoading()
    })
  },

  // 检查用户权限
  checkUserPermission: function() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      this.setData({ hasPermission: false });
      return;
    }

    // 检查是否为上传者或管理员
    const isOwner = this.data.isUploader || userInfo.role === 'admin';
    this.setData({ 
      isOwner: isOwner,
      hasPermission: isOwner
    });
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

    wx.showLoading({
      title: '下载中...',
    })

    // 先获取文件下载链接
    wx.cloud.getTempFileURL({
      fileList: [{
        fileID: this.data.resourceDetail.fileID,
        maxAge: 3600 // 链接有效期1小时
      }]
    }).then(res => {
      if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
        const tempFileURL = res.fileList[0].tempFileURL;
        
        // 构建保存路径，使用原始文件名
        const fileName = this.data.resourceDetail.fileName || '未命名文件';
        const savePath = `${wx.env.USER_DATA_PATH}/${fileName}`;

        // 下载文件
        wx.downloadFile({
          url: tempFileURL,
          filePath: savePath,  // 使用指定的保存路径
          success: (res) => {
            if (res.statusCode === 200) {
              // 增加下载次数
              wx.cloud.callFunction({
                name: 'resources',
                data: {
                  type: 'incrementDownloads',
                  data: { id: this.data.resourceDetail._id }
                }
              }).then(res => {
                if (res.result.success) {
                  // 更新本地显示的下载次数
                  this.setData({
                    'resourceDetail.downloads': this.data.resourceDetail.downloads + 1
                  });
                }
              }).catch(err => {
                console.error('增加下载次数失败：', err);
              });

              // 记录下载历史
              wx.cloud.callFunction({
                name: 'resources',
                data: {
                  type: 'recordDownload',
                  data: { id: this.data.resourceDetail._id }
                }
              }).catch(err => {
                console.error('记录下载历史失败：', err);
              });

              // 打开文件
              wx.openDocument({
                filePath: savePath,  // 使用保存的文件路径
                showMenu:true,
                success: () => {
                  
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
          },
          fail: (err) => {
            console.error('下载文件失败：', err)
            wx.showToast({
              title: '下载文件失败',
              icon: 'none'
            })
          }
        })
      } else {
        console.error('获取下载链接失败')
        wx.showToast({
          title: '获取下载链接失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('获取下载链接失败：', err)
      wx.showToast({
        title: '获取下载链接失败',
        icon: 'none'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  // 删除资料
  deleteResource: function() {
    if (!this.data.resourceDetail || !this.data.resourceDetail._id) {
      console.error('资源ID不存在')
      return
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个资料吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
          })

          wx.cloud.callFunction({
            name: 'resources',
            data: {
              type: 'delete',
              data: { id: this.data.resourceDetail._id }
            }
          }).then(res => {
            if (res.result.success) {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              })
              // 返回上一页
              setTimeout(() => {
                wx.navigateBack()
              }, 1500)
            } else {
              console.error('删除资源失败：', res.result)
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
  },

  // 编辑资料
  editResource: function() {
    if (!this.data.resourceDetail || !this.data.resourceDetail._id) {
      console.error('资源ID不存在')
      return
    }

    wx.navigateTo({
      url: `/pages/resource/edit/index?id=${this.data.resourceDetail._id}`
    })
  }
}) 