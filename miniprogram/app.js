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
        env: 'cloud1-9gbyqyqyb5f2cb69',
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
  
  checkLoginStatus: function() {
    const auth = wx.getStorageSync('auth');
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    
    if (auth && auth.token && Date.now() < auth.expireTime && userInfo && isLoggedIn) {
      // 验证数据库中的用户信息是否存在
      wx.cloud.database().collection('users').doc(userInfo._id).get({
        success: (res) => {
          if (res.data) {
            this.globalData.userInfo = userInfo;
            this.globalData.isLoggedIn = true;
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
