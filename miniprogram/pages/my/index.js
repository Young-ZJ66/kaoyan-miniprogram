const app = getApp()

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    openid: '',
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    _loginInProgress: false
  },

  onLoad() {
    // 检查是否已登录
    const auth = wx.getStorageSync('auth');
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    
    if (auth && auth.token && Date.now() < auth.expireTime && userInfo && isLoggedIn) {
      // 检查用户状态
      if (userInfo.status === false) {
        // 用户被封禁，强制登出
        wx.showModal({
          title: '账号已禁用',
          content: '您的账号已被禁用，请联系管理员。',
          showCancel: false,
          success: () => {
            this.clearLoginData();
          }
        });
        return;
      }
      
      this.setData({
        userInfo,
        isLoggedIn: true
      });
      
      // 检查本地头像
      this.checkLocalAvatar(userInfo);
    } else {
      // 未登录状态，清除可能存在的旧数据
      this.clearLoginData();
    }
  },

  onShow() {
    // 设置底部导航栏选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      });
    }

    // 检查登录状态
    const auth = wx.getStorageSync('auth');
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    
    if (auth && auth.token && Date.now() < auth.expireTime && userInfo && isLoggedIn) {
      // 检查用户状态
      if (userInfo.status === false) {
        // 用户被封禁，强制登出
        wx.showModal({
          title: '账号已禁用',
          content: '您的账号已被禁用，请联系管理员。',
          showCancel: false,
          success: () => {
            this.clearLoginData();
          }
        });
        return;
      }
      
      this.setData({
        userInfo,
        isLoggedIn: true
      });
      
      // 检查本地头像
      this.checkLocalAvatar(userInfo);
    } else {
      // 未登录状态，清除可能存在的旧数据
      this.clearLoginData();
    }
  },

  // 清除登录数据
  clearLoginData() {
    // 清除本地存储的登录相关数据
    wx.removeStorageSync('auth');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('isLoggedIn');
    wx.removeStorageSync('loginTime');
    
    // 更新页面状态
    this.setData({
      userInfo: null,
      isLoggedIn: false
    });
  },

  // 点击头像或未登录文字
  onLogin() {
    if (!this.data.userInfo) {
      // 未登录状态，跳转到注册页面
      wx.navigateTo({
        url: '/pages/my/register/index'
      });
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    if (!this.data.userInfo) {
      // 未登录状态，跳转到注册页面
      wx.navigateTo({
        url: '/pages/my/register/index'
      });
      return;
    }

    const { avatarUrl } = e.detail;
    // 更新头像
    this.updateUserInfo({ avatarUrl });
  },

  // 更新用户信息
  async updateUserInfo(data) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: {
          openid: this.data.openid,
          ...data
        }
      });

      if (res.result.success) {
        // 更新本地存储的用户信息
        const userInfo = { ...this.data.userInfo, ...data };
        wx.setStorageSync('userInfo', userInfo);
        this.setData({ userInfo });

        wx.showToast({
          title: '更新成功',
          icon: 'success'
        });
      } else {
        throw new Error(res.result.message || '更新失败');
      }
    } catch (err) {
      console.error('更新用户信息失败：', err);
      wx.showToast({
        title: err.message || '更新失败',
        icon: 'none'
      });
    }
  },

  // 下载记录
  async onMyDownloads() {
    try {
      // 检查登录状态
      const auth = wx.getStorageSync('auth');
      const userInfo = wx.getStorageSync('userInfo');
      const isLoggedIn = wx.getStorageSync('isLoggedIn');
      
      if (!auth || !auth.token || Date.now() > auth.expireTime || !userInfo || !isLoggedIn) {
        wx.showModal({
          title: '提示',
          content: '请先登录后再查看下载记录',
          confirmText: '登录',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // 用户点击确认，执行登录
              this.handleLogin();
            }
          }
        });
        return;
      }

      // 用户已登录，跳转到下载记录页面
      wx.navigateTo({
        url: '/pages/my/my-downloads/index'
      });
    } catch (err) {
      console.error('获取用户信息失败：', err);
      wx.showToast({
        title: '获取用户信息失败',
        icon: 'none'
      });
    }
  },

  // 上传记录
  async onMyUploads() {
    try {
      // 检查登录状态
      const auth = wx.getStorageSync('auth');
      const userInfo = wx.getStorageSync('userInfo');
      const isLoggedIn = wx.getStorageSync('isLoggedIn');
      
      if (!auth || !auth.token || Date.now() > auth.expireTime || !userInfo || !isLoggedIn) {
        wx.showModal({
          title: '提示',
          content: '请先登录后再查看上传记录',
          confirmText: '登录',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // 用户点击确认，执行登录
              this.handleLogin();
            }
          }
        });
        return;
      }

      // 用户已登录，跳转到上传记录页面
      wx.navigateTo({
        url: '/pages/my/my-uploads/index'
      });
    } catch (err) {
      console.error('获取用户信息失败：', err);
      wx.showToast({
        title: '获取用户信息失败',
        icon: 'none'
      });
    }
  },

  // 关于我们
  onAbout() {
    // TODO: 跳转到关于我们页面
  },

  // 输入昵称
  onInputNickname(e) {
    this.setData({
      tempNickName: e.detail.value
    });
  },

  // 提交表单
  async onSubmit() {
    try {
      const { tempAvatarUrl, tempNickName } = this.data;
      
      if (!tempAvatarUrl || !tempNickName) {
        wx.showToast({
          title: '请选择头像并输入昵称',
          icon: 'none'
        });
        return;
      }

      // 1. 获取微信登录凭证
      const loginRes = await wx.login();
      console.log('微信登录结果：', loginRes);

      if (!loginRes.code) {
        throw new Error('获取登录凭证失败');
      }

      // 2. 调用云函数进行登录
      const authRes = await wx.cloud.callFunction({
        name: 'login',
        data: {
          code: loginRes.code,
          timestamp: Date.now(),
          nonce: this.generateNonce()
        }
      });

      if (!authRes.result || !authRes.result.success) {
        throw new Error(authRes.result?.message || '登录失败');
      }

      const { token, userInfo, expireTime } = authRes.result.data;
      
      // 3. 保存认证信息
      wx.setStorageSync('auth', {
        token,
        expireTime
      });
      
      // 4. 保存用户信息
      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('isLoggedIn', true);
      wx.setStorageSync('loginTime', Date.now());

      // 5. 更新页面状态
      this.setData({
        userInfo,
        isLoggedIn: true,
        tempAvatarUrl: '',
        tempNickName: ''
      });

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });
    } catch (err) {
      console.error('登录失败：', err);
      wx.showToast({
        title: err.message || '登录失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 处理登录
  async handleLogin() {
    if (this.data.isLoggedIn) return;
    
    // 添加防抖处理，避免多次触发
    if (this._loginInProgress) return;
    this._loginInProgress = true;

    try {
      wx.showLoading({
        title: '登录中...'
      });

      // 1. 获取微信登录凭证
      const loginRes = await wx.login();

      if (!loginRes.code) {
        throw new Error('获取登录凭证失败');
      }

      // 2. 调用云函数进行认证
      const authRes = await wx.cloud.callFunction({
        name: 'login',
        data: {
          code: loginRes.code,
          timestamp: Date.now(),
          nonce: this.generateNonce()
        }
      });

      if (!authRes.result) {
        throw new Error('认证失败');
      }

      // 3. 处理未注册用户
      if (!authRes.result.success && authRes.result.code === 'USER_NOT_REGISTERED') {
        wx.hideLoading();
        wx.showModal({
          title: '提示',
          content: '您还未注册，是否立即注册？',
          confirmText: '注册',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.navigateTo({
                url: '/pages/my/register/index'
              });
            }
          }
        });
        this._loginInProgress = false;
        return;
      }
      
      // 处理账号被禁用的情况
      if (!authRes.result.success && authRes.result.code === 'USER_BANNED') {
        wx.hideLoading();
        wx.showModal({
          title: '账号已禁用',
          content: '您的账号已被禁用，请联系管理员。',
          showCancel: false
        });
        this._loginInProgress = false;
        return;
      }

      if (!authRes.result.success) {
        throw new Error(authRes.result.message || '认证失败');
      }

      const { token, userInfo, expireTime } = authRes.result.data;
      
      // 检查用户状态是否被禁用
      if (userInfo.status === false) {
        wx.hideLoading();
        wx.showModal({
          title: '账号已禁用',
          content: '您的账号已被禁用，请联系管理员。',
          showCancel: false
        });
        this._loginInProgress = false;
        return;
      }
      
      // 4. 保存认证信息
      wx.setStorageSync('auth', {
        token,
        expireTime
      });
      
      // 5. 下载头像并保存到本地
      if (userInfo.avatarUrl && userInfo.avatarUrl.startsWith('cloud://')) {
        try {
          // 直接调用下载头像的方法
          this.downloadAvatarToLocal(userInfo.avatarUrl, userInfo._openid);
        } catch (error) {
          // 下载失败不影响登录流程
        }
      }
      
      // 6. 保存用户信息
      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('isLoggedIn', true);
      wx.setStorageSync('loginTime', Date.now());

      // 7. 更新页面状态
      this.setData({ 
        userInfo,
        isLoggedIn: true
      });

      wx.hideLoading();
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });

      // 8. 记录登录日志
      await this.logLogin(userInfo._openid);

    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: err.message || '登录失败，请稍后重试',
        icon: 'none',
        duration: 2000
      });
    } finally {
      // 无论成功失败，都重置登录状态
      this._loginInProgress = false;
    }
  },

  // 生成随机字符串
  generateNonce() {
    return Math.random().toString(36).substring(2, 15);
  },

  // 记录登录日志
  async logLogin(openid) {
    try {
      const systemInfo = wx.getDeviceInfo();
      const appBaseInfo = wx.getAppBaseInfo();
      
      await wx.cloud.callFunction({
        name: 'logOperation',
        data: {
          type: 'login',
          openid,
          deviceInfo: {
            model: systemInfo.model,
            system: systemInfo.system,
            platform: systemInfo.platform,
            version: appBaseInfo.version,
            SDKVersion: appBaseInfo.SDKVersion
          }
        }
      });
    } catch (err) {
      console.error('记录登录日志失败：', err);
      // 记录日志失败不影响登录流程，所以这里不抛出错误
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const auth = wx.getStorageSync('auth');
    if (!auth || !auth.token || Date.now() > auth.expireTime) {
      this.handleLogout();
      return false;
    }
    return true;
  },

  // 处理退出登录
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 获取用户openid用于记录日志
          const userInfo = wx.getStorageSync('userInfo');
          const openid = userInfo ? userInfo._openid : '';
          
          // 记录退出登录日志
          if (openid) {
            try {
              const systemInfo = wx.getDeviceInfo();
              const appBaseInfo = wx.getAppBaseInfo();
              
              wx.cloud.callFunction({
                name: 'logOperation',
                data: {
                  type: 'logout',
                  openid: openid,
                  deviceInfo: {
                    model: systemInfo.model,
                    system: systemInfo.system,
                    platform: systemInfo.platform,
                    version: appBaseInfo.version,
                    SDKVersion: appBaseInfo.SDKVersion
                  }
                }
              });
            } catch (err) {
              console.error('记录退出登录日志失败：', err);
              // 记录日志失败不影响退出登录流程
            }
          }
          
          this.clearLoginData();
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
          
          // 通知论坛页面刷新
          const pages = getCurrentPages();
          const communityPage = pages.find(page => page.route === 'pages/community/index');
          if (communityPage) {
            // 如果社区页面在页面栈中，则通知它重置
            communityPage.setData({
              page: 1,
              posts: [],
              hasMore: true
            });
            communityPage.loadPosts();
          }
          
          // 如果当前在帖子详情页，返回到首页
          const currentPage = pages[pages.length - 1];
          if (currentPage.route === 'pages/community/detail/index') {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        }
      }
    });
  },

  // 跳转到修改信息页面
  goToEdit() {
    // 检查登录状态
    const auth = wx.getStorageSync('auth');
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    
    if (!auth || !auth.token || Date.now() > auth.expireTime || !userInfo || !isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再修改信息',
        confirmText: '登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户点击确认，执行登录
            this.handleLogin();
          }
        }
      });
      return;
    }
    
    // 跳转到修改信息页面
    wx.navigateTo({
      url: '/pages/my/edit/index'
    });
  },

  // 处理头像加载错误
  handleAvatarError(e) {
    // 如果本地头像加载失败，尝试使用云存储头像或默认头像
    const userInfo = this.data.userInfo;
    if (userInfo && userInfo.localAvatarPath) {
      // 移除本地路径，使用云存储路径
      const updatedUserInfo = {...userInfo};
      delete updatedUserInfo.localAvatarPath;
      
      this.setData({
        userInfo: updatedUserInfo
      });
      
      // 从本地存储中更新信息
      wx.setStorageSync('userInfo', updatedUserInfo);
      
      // 尝试重新下载头像（在后台进行，不阻塞UI）
      this.downloadAvatarToLocal(userInfo.avatarUrl, userInfo._openid).catch(err => {
        console.error('重新下载头像失败:', err);
      });
    }
  },
  
  // 下载头像到本地
  async downloadAvatarToLocal(cloudPath, openid) {
    if (!cloudPath || !openid) return;
    
    // 检查微信版本是否支持相关API
    try {
      const appBaseInfo = wx.getAppBaseInfo();
      const sdkVersion = appBaseInfo.SDKVersion;
      const isLowVersion = this.compareVersion(sdkVersion, '2.7.0') < 0;
      
      if (isLowVersion) {
        // 低版本微信不支持相关文件操作API，直接返回
        return;
      }
      
      // 检查是否是云存储路径
      if (!cloudPath.startsWith('cloud://')) {
        return;
      }
      
      const fs = wx.getFileSystemManager();
      
      // 确保用户目录存在
      const userDir = `${wx.env.USER_DATA_PATH}/${openid}`;
      try {
        try {
          fs.accessSync(userDir);
        } catch (e) {
          // 目录不存在，创建目录
          fs.mkdirSync(userDir, true);
        }
        
        // 下载头像
        const res = await wx.cloud.downloadFile({
          fileID: cloudPath
        }).catch(err => {
          // 下载失败时只返回null，不抛出错误
          return null;
        });
        
        if (!res || !res.tempFilePath) return;
        
        const tmpPath = res.tempFilePath;
        
        // 检查临时文件是否存在
        try {
          fs.accessSync(tmpPath);
        } catch (e) {
          // 临时文件不存在，直接返回
          return;
        }
        
        // 复制到永久路径
        const localPath = `${userDir}/avatar.png`;
        try {
          fs.copyFileSync(tmpPath, localPath);
          
          // 更新本地存储的用户信息
          const userInfo = wx.getStorageSync('userInfo') || {};
          userInfo.localAvatarPath = localPath;
          wx.setStorageSync('userInfo', userInfo);
          
          // 更新当前页面数据
          if (this.data.userInfo) {
            this.setData({
              'userInfo.localAvatarPath': localPath
            });
          }
        } catch (e) {
          // 保存失败时不做处理
        }
      } catch (err) {
        // 捕获所有可能的错误，但不影响用户体验
      }
    } catch (err) {
      // 获取系统信息失败时，不做处理
    }
  },
  
  // 版本比较函数
  compareVersion(v1, v2) {
    v1 = v1.split('.');
    v2 = v2.split('.');
    const len = Math.max(v1.length, v2.length);
    
    while (v1.length < len) {
      v1.push('0');
    }
    while (v2.length < len) {
      v2.push('0');
    }
    
    for (let i = 0; i < len; i++) {
      const num1 = parseInt(v1[i]);
      const num2 = parseInt(v2[i]);
      
      if (num1 > num2) {
        return 1;
      } else if (num1 < num2) {
        return -1;
      }
    }
    
    return 0;
  },
  
  // 修改个人资料
  onEditProfile() {
    if (this.data.isLoggedIn) {
      this.goToEdit();
    } else {
      this.handleLogin();
    }
  },

  // 格式化时间
  formatTime: function(timestamp) {
    if (!timestamp) return '';
    return timestamp; // 直接返回数据库中的时间字符串
  },

  // 跳转到管理计划页面
  onManagePlan: function() {
    // 检查登录状态
    const auth = wx.getStorageSync('auth')
    const userInfo = wx.getStorageSync('userInfo')
    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    
    if (!auth || !auth.token || Date.now() > auth.expireTime || !userInfo || !isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再查看计划',
        confirmText: '登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户点击确认，执行登录
            this.handleLogin()
          }
        }
      })
      return
    }

    // 用户已登录，跳转到管理计划页面
    wx.navigateTo({
      url: '/pages/plan/manage/index'
    })
  },

  // 跳转到我的帖子页面
  onMyPosts: function() {
    // 检查登录状态
    const auth = wx.getStorageSync('auth')
    const userInfo = wx.getStorageSync('userInfo')
    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    
    if (!auth || !auth.token || Date.now() > auth.expireTime || !userInfo || !isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再查看我的帖子',
        confirmText: '登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户点击确认，执行登录
            this.handleLogin()
          }
        }
      })
      return
    }

    // 用户已登录，跳转到我的帖子页面
    wx.navigateTo({
      url: '/pages/my/my-posts/index'
    })
  },

  // 跳转到我的点赞页面
  onMyLikes: function() {
    // 检查登录状态
    const auth = wx.getStorageSync('auth')
    const userInfo = wx.getStorageSync('userInfo')
    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    
    if (!auth || !auth.token || Date.now() > auth.expireTime || !userInfo || !isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再查看我的点赞',
        confirmText: '登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户点击确认，执行登录
            this.handleLogin()
          }
        }
      })
      return
    }

    // 用户已登录，跳转到我的点赞页面
    wx.navigateTo({
      url: '/pages/my/my-likes/index'
    })
  },

  // 检查本地头像
  checkLocalAvatar(userInfo) {
    if (!userInfo || !userInfo.avatarUrl || !userInfo._openid) return;
    
    try {
      // 如果没有本地头像路径或本地头像文件不存在，尝试下载
      if (!userInfo.localAvatarPath) {
        // 在后台下载头像，不阻塞UI渲染
        this.downloadAvatarToLocal(userInfo.avatarUrl, userInfo._openid);
      } else {
        // 检查本地文件是否存在
        try {
          const fs = wx.getFileSystemManager();
          fs.accessSync(userInfo.localAvatarPath);
          // 文件存在，无需操作
        } catch (e) {
          // 文件不存在，重新下载，但不记录错误日志
          this.downloadAvatarToLocal(userInfo.avatarUrl, userInfo._openid);
        }
      }
    } catch (err) {
      // 捕获所有错误，但不抛出，避免影响用户体验
    }
  },

  // 跳转到关于我们页面
  onAbout: function() {
    wx.navigateTo({
      url: '/pages/my/about/index'
    })
  },

  // 跳转到我的收藏页面
  navigateToMyCollection() {
    // 检查登录状态
    const auth = wx.getStorageSync('auth')
    const userInfo = wx.getStorageSync('userInfo')
    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    
    if (!auth || !auth.token || Date.now() > auth.expireTime || !userInfo || !isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再查看收藏',
        confirmText: '登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户点击确认，执行登录
            this.handleLogin()
          }
        }
      })
      return
    }

    // 用户已登录，跳转到收藏页面
    wx.navigateTo({
      url: '/pages/my/collection/index'
    })
  },
}) 