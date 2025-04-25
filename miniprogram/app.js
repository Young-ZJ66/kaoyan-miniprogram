// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: 'cloud-young-2gcblx0nb59a75fc',
        traceUser: true,
        // 添加以下参数以增强稳定性
        timeout: 15000, // 设置较长的超时时间
      });
    }

    this.globalData = {
      userInfo: null,
      forumNeedsRefresh: false, // 社区页面是否需要刷新的标记
      isLoggedIn: false
    };
    
    this.checkLoginStatus();
  },
  
  // 小程序显示时触发
  onShow: function() {
    // 如果用户已登录，更新最后登录时间
    if (this.globalData.isLoggedIn && this.globalData.userInfo) {
      this.updateLastLoginTime(this.globalData.userInfo._openid);
    }
  },
  
  // 记录登录日志
  logLogin: function(openid) {
    if (!openid) return;
    
    try {
      const systemInfo = wx.getDeviceInfo();
      const appBaseInfo = wx.getAppBaseInfo();
      
      wx.cloud.callFunction({
        name: 'logOperation',
        data: {
          type: 'login',
          openid: openid,
          deviceInfo: {
            model: systemInfo.model,
            system: systemInfo.system,
            platform: systemInfo.platform,
            version: appBaseInfo.version,
            SDKVersion: appBaseInfo.SDKVersion
          }
        },
        fail: (err) => {
          console.error('记录登录日志失败：', err);
        }
      });
    } catch (err) {
      console.error('记录登录日志失败：', err);
      // 记录日志失败不影响登录流程
    }
  },
  
  // 更新最后登录时间的方法
  updateLastLoginTime: function(openid) {
    if (!openid) return;
    
    const now = Date.now();
    // 设置更新间隔为30分钟，避免频繁调用
    const UPDATE_INTERVAL = 30 * 60 * 1000; // 30分钟
    
    // 获取存储在本地的上次登录时间
    const lastLoginTime = wx.getStorageSync('loginTime') || 0;
    
    // 如果距离上次更新时间不足设定的间隔，则不更新
    if (now - lastLoginTime < UPDATE_INTERVAL) {
      console.log('距离上次更新登录时间未超过间隔，跳过本次更新');
      return;
    }
    
    const db = wx.cloud.database();
    db.collection('users').where({
      _openid: openid
    }).update({
      data: {
        lastLoginTime: db.serverDate()
      },
      success: () => {
        // 更新成功后，记录本次更新时间到本地存储
        wx.setStorageSync('loginTime', now);
        
        // 记录登录日志
        this.logLogin(openid);
      },
      fail: (err) => {
        console.error('更新最后登录时间失败：', err);
      }
    });
  },
  
  checkLoginStatus: function() {
    const auth = wx.getStorageSync('auth');
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    
    if (auth && auth.token && Date.now() < auth.expireTime && userInfo && isLoggedIn) {
      // 验证数据库中的用户信息是否存在
      wx.cloud.database().collection('users').where({
        _openid: userInfo._openid
      }).get({
        success: (res) => {
          if (res.data && res.data.length > 0) {
            // 检查用户状态是否为禁用状态（status为false表示被禁用）
            if (res.data[0].status === false) {
              this.clearLoginData();
              wx.showModal({
                title: '账号已禁用',
                content: '您的账号已被管理员禁用',
                showCancel: false
              });
            } else {
              this.globalData.userInfo = userInfo;
              this.globalData.isLoggedIn = true;
              
              // 更新用户最后登录时间
              this.updateLastLoginTime(userInfo._openid);
            }
          } else {
            this.clearLoginData();
          }
        },
        fail: () => {
          this.clearLoginData();
        }
      });
    } else {
      this.clearLoginData();
    }
  },
  
  clearLoginData: function() {
    wx.removeStorageSync('auth');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('isLoggedIn');
    wx.removeStorageSync('loginTime');
    
    this.globalData.userInfo = null;
    this.globalData.isLoggedIn = false;
  },
  
  getUserInfo: function() {
    return this.globalData.userInfo;
  },
  
  getLoginStatus: function() {
    return this.globalData.isLoggedIn;
  }
});
