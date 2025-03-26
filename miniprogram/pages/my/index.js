const app = getApp()

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    openid: ''
  },

  onLoad() {
    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo')
    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    const openid = wx.getStorageSync('openid')
    
    console.log('onLoad - 检查登录状态：', { userInfo, isLoggedIn, openid })
    
    if (userInfo && isLoggedIn && openid) {
      this.setData({
        userInfo,
        isLoggedIn: true,
        openid
      })
    } else {
      // 未登录状态，清除可能存在的旧数据
      this.setData({
        userInfo: null,
        isLoggedIn: false,
        openid: ''
      })
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
    const userInfo = wx.getStorageSync('userInfo')
    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    const openid = wx.getStorageSync('openid')
    
    console.log('onShow - 检查登录状态：', { userInfo, isLoggedIn, openid })
    
    if (userInfo && isLoggedIn && openid) {
      this.setData({
        userInfo,
        isLoggedIn: true,
        openid
      })
    } else {
      // 未登录状态，清除可能存在的旧数据
      this.setData({
        userInfo: null,
        isLoggedIn: false,
        openid: ''
      })
    }
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
      // 获取用户openid
      const res = await wx.cloud.callFunction({
        name: 'getOpenId'
      });
      
      const openid = res.result.openid;
      this.setData({ openid });

      // 查询用户是否已注册
      const userRes = await wx.cloud.callFunction({
        name: 'getUserInfo',
        data: { openid }
      });

      if (!userRes.result.success) {
        // 用户未注册，跳转到注册页面
        wx.navigateTo({
          url: '/pages/register/index'
        });
        return;
      }

      // 检查是否已登录
      if (!this.data.isLoggedIn) {
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
      // 获取用户openid
      const res = await wx.cloud.callFunction({
        name: 'getOpenId'
      });
      
      const openid = res.result.openid;
      this.setData({ openid });

      // 查询用户是否已注册
      const userRes = await wx.cloud.callFunction({
        name: 'getUserInfo',
        data: { openid }
      });

      if (!userRes.result.success) {
        // 用户未注册，跳转到注册页面
        wx.navigateTo({
          url: '/pages/register/index'
        });
        return;
      }

      // 检查是否已登录
      if (!this.data.isLoggedIn) {
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

      // 1. 获取openid
      const loginRes = await wx.cloud.callFunction({
        name: 'login'
      });

      if (!loginRes.result || !loginRes.result.openid) {
        throw new Error('获取openid失败');
      }

      // 2. 调用云函数进行登录
      const userLoginRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          type: 'login',
          data: {
            openid: loginRes.result.openid
          }
        }
      });

      if (!userLoginRes.result.success) {
        throw new Error(userLoginRes.result.message || '登录失败');
      }

      // 3. 更新用户信息
      const updateRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          type: 'updateUserInfo',
          data: {
            openid: loginRes.result.openid,
            userInfo: {
              avatarUrl: tempAvatarUrl,
              nickName: tempNickName
            }
          }
        }
      });

      if (!updateRes.result.success) {
        throw new Error(updateRes.result.message || '更新用户信息失败');
      }

      // 4. 保存用户信息到本地
      const userInfo = {
        avatarUrl: tempAvatarUrl,
        nickName: tempNickName,
        _openid: loginRes.result.openid
      };

      wx.setStorageSync('userInfo', JSON.stringify(userInfo));
      this.setData({
        userInfo: userInfo,
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
      // 获取用户openid
      const res = await wx.cloud.callFunction({
        name: 'getOpenId'
      });
      
      const openid = res.result.openid;
      this.setData({ openid });

      // 查询用户是否已注册
      const userRes = await wx.cloud.callFunction({
        name: 'getUserInfo',
        data: { openid }
      });

      if (userRes.result.success) {
        // 用户已注册，更新本地存储的用户信息
        const userInfo = userRes.result.data;
        // 保存所有必要的状态
        wx.setStorageSync('userInfo', userInfo);
        wx.setStorageSync('isLoggedIn', true);
        wx.setStorageSync('openid', openid);
        
        // 更新页面状态
        this.setData({ 
          userInfo,
          isLoggedIn: true,
          openid
        });

        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
      } else {
        // 用户未注册，跳转到注册页面
        wx.navigateTo({
          url: '/pages/register/index'
        });
      }
    } catch (err) {
      console.error('登录失败：', err);
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      });
    }
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除所有本地存储的用户信息
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('isLoggedIn');
          wx.removeStorageSync('openid');
          
          // 更新页面状态
          this.setData({
            userInfo: null,
            isLoggedIn: false,
            openid: ''
          });

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
    if (!this.data.isLoggedIn) {
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
    wx.navigateTo({
      url: '/pages/my/edit/index'
    });
  }
}) 