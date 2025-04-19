Page({
  data: {
    tempAvatarUrl: '',
    tempNickName: '',
    gender: '',
    birthday: '',
    region: [],
    phone: '',
    email: '',
    openid: ''
  },

  onLoad() {
    // 获取用户openid
    wx.cloud.callFunction({
      name: 'getOpenId',
      success: res => {
        this.setData({
          openid: res.result.openid
        });
      },
      fail: err => {
        console.error('获取openid失败：', err);
        wx.showToast({
          title: '获取用户信息失败',
          icon: 'none'
        });
      }
    });
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      tempAvatarUrl: avatarUrl
    });
  },

  // 输入昵称
  onInputNickname(e) {
    this.setData({
      tempNickName: e.detail.value
    });
  },

  // 显示性别选择器
  showGenderPicker() {
    wx.showActionSheet({
      itemList: ['男', '女'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.setData({ gender: '1' });
        } else if (res.tapIndex === 1) {
          this.setData({ gender: '2' });
        }
      }
    });
  },

  // 选择生日
  onBirthdayChange(e) {
    this.setData({
      birthday: e.detail.value
    });
  },

  // 选择地区
  onRegionChange(e) {
    console.log('地区选择改变：', e.detail);
    this.setData({
      region: e.detail.value
    });
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  // 输入邮箱
  onEmailInput(e) {
    this.setData({
      email: e.detail.value
    });
  },

  // 提交表单
  async onSubmit() {
    try {
      const { tempAvatarUrl, tempNickName, gender, birthday, region, phone, email } = this.data;
      
      // 表单验证
      if (!tempAvatarUrl) {
        wx.showToast({
          title: '请选择头像',
          icon: 'none'
        });
        return;
      }

      if (!tempNickName) {
        wx.showToast({
          title: '请输入昵称',
          icon: 'none'
        });
        return;
      }

      if (!gender) {
        wx.showToast({
          title: '请选择性别',
          icon: 'none'
        });
        return;
      }

      if (!birthday) {
        wx.showToast({
          title: '请选择生日',
          icon: 'none'
        });
        return;
      }

      if (!region || region.length === 0) {
        wx.showToast({
          title: '请选择地区',
          icon: 'none'
        });
        return;
      }

      if (!phone) {
        wx.showToast({
          title: '请输入手机号',
          icon: 'none'
        });
        return;
      }

      if (!email) {
        wx.showToast({
          title: '请输入邮箱',
          icon: 'none'
        });
        return;
      }

      // 手机号验证
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        wx.showToast({
          title: '请输入正确的手机号',
          icon: 'none'
        });
        return;
      }

      // 邮箱验证
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        wx.showToast({
          title: '请输入正确的邮箱',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '注册中...'
      });

      // 1. 上传头像到云存储
      const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).substring(2)}.jpg`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempAvatarUrl
      });

      // 2. 获取微信登录凭证
      const loginRes = await wx.login();
      console.log('微信登录结果：', loginRes);

      if (!loginRes.code) {
        throw new Error('获取登录凭证失败');
      }

      // 3. 调用注册云函数
      const registerRes = await wx.cloud.callFunction({
        name: 'register',
        data: {
          code: loginRes.code,
          userInfo: {
            avatarUrl: uploadRes.fileID,
            nickName: tempNickName,
            gender,
            birthday,
            region: region.join(' '),
            phone,
            email
          }
        }
      });

      if (!registerRes.result || !registerRes.result.success) {
        throw new Error(registerRes.result?.message || '注册失败');
      }

      const { token, userInfo, expireTime } = registerRes.result.data;
      
      // 4. 保存认证信息
      wx.setStorageSync('auth', {
        token,
        expireTime
      });
      
      // 5. 保存用户信息
      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('isLoggedIn', true);
      wx.setStorageSync('loginTime', Date.now());

      // 记录注册日志
      try {
        const systemInfo = wx.getDeviceInfo();
        const appBaseInfo = wx.getAppBaseInfo();
        
        wx.cloud.callFunction({
          name: 'logOperation',
          data: {
            type: 'register',
            openid: userInfo._openid,
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
        console.error('记录注册日志失败：', err);
        // 记录日志失败不影响注册流程
      }

      wx.hideLoading();
      wx.showToast({
        title: '注册成功',
        icon: 'success',
        duration: 2000,
        success: () => {
          // 延迟返回上一页，让用户看到成功提示
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });

    } catch (err) {
      console.error('注册失败：', err);
      wx.hideLoading();
      wx.showToast({
        title: err.message || '注册失败，请稍后重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 生成随机字符串
  generateNonce() {
    return Math.random().toString(36).substring(2, 15);
  }
}); 