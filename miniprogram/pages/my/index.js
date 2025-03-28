const app = getApp()

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    openid: ''
  },

  onLoad() {
    // 检查是否已登录
    const auth = wx.getStorageSync('auth');
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    
    if (auth && auth.token && Date.now() < auth.expireTime && userInfo && isLoggedIn) {
      this.setData({
        userInfo,
        isLoggedIn: true
      });
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
      this.setData({
        userInfo,
        isLoggedIn: true
      });
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
        url: '/pages/register/index'
      });
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    if (!this.data.userInfo) {
      // 未登录状态，跳转到注册页面
      wx.navigateTo({
        url: '/pages/register/index'
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

    try {
      wx.showLoading({
        title: '登录中...'
      });

      // 1. 获取微信登录凭证
      const loginRes = await wx.login();
      console.log('微信登录结果：', loginRes);

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
                url: '/pages/register/index'
              });
            }
          }
        });
        return;
      }

      if (!authRes.result.success) {
        throw new Error(authRes.result.message || '认证失败');
      }

      const { token, userInfo, expireTime } = authRes.result.data;
      
      // 4. 保存认证信息
      wx.setStorageSync('auth', {
        token,
        expireTime
      });
      
      // 5. 保存用户信息
      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('isLoggedIn', true);
      wx.setStorageSync('loginTime', Date.now());

      // 6. 更新页面状态
      this.setData({ 
        userInfo,
        isLoggedIn: true
      });

      wx.hideLoading();
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });

      // 7. 记录登录日志
      await this.logLogin(userInfo._id);

    } catch (err) {
      console.error('登录失败：', err);
      wx.hideLoading();
      wx.showToast({
        title: err.message || '登录失败，请稍后重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 生成随机字符串
  generateNonce() {
    return Math.random().toString(36).substring(2, 15);
  },

  // 记录登录日志
  async logLogin(userId) {
    try {
      const deviceInfo = wx.getSystemInfoSync();
      await wx.cloud.callFunction({
        name: 'logOperation',
        data: {
          type: 'login',
          userId,
          timestamp: Date.now(),
          deviceInfo: {
            model: deviceInfo.model,
            system: deviceInfo.system,
            platform: deviceInfo.platform,
            version: deviceInfo.version,
            SDKVersion: deviceInfo.SDKVersion
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
          this.clearLoginData();
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
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

    // 已登录，跳转到修改信息页面
    wx.navigateTo({
      url: '/pages/my/edit/index'
    });
  },

  // 格式化时间
  formatTime: function(timestamp) {
    if (!timestamp) return '';
    return timestamp; // 直接返回数据库中的时间字符串
  },
}) 