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

  // 表单提交
  async onSubmit() {
    const { tempAvatarUrl, tempNickName, gender, birthday, region, phone, email, openid } = this.data;

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

    try {
      // 上传头像到云存储
      const cloudPath = `avatars/${openid}_${Date.now()}.jpg`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempAvatarUrl
      });

      // 调用注册云函数
      const res = await wx.cloud.callFunction({
        name: 'register',
        data: {
          openid,
          avatarUrl: uploadRes.fileID,
          nickName: tempNickName,
          gender,
          birthday,
          region: region.join(' '),
          phone,
          email
        }
      });

      if (res.result.success) {
        // 保存用户信息到本地
        wx.setStorageSync('userInfo', {
          avatarUrl: uploadRes.fileID,
          nickName: tempNickName,
          gender,
          birthday,
          region: region.join(' '),
          phone,
          email
        });

        // 先隐藏加载提示
        wx.hideLoading({
          complete: () => {
            // 显示成功提示
            wx.showToast({
              title: '注册成功',
              icon: 'success',
              duration: 2000,
              success: () => {
                // 等待提示显示完成后再执行登录
                setTimeout(() => {
                  console.log('开始执行登录，openid:', openid);
                  // 调用登录云函数
                  wx.cloud.callFunction({
                    name: 'login',
                    data: {
                      openid: openid
                    },
                    success: (loginRes) => {
                      console.log('登录云函数返回结果：', loginRes);
                      if (loginRes.result && loginRes.result.openid) {
                        // 保存登录状态
                        wx.setStorageSync('isLoggedIn', true);
                        // 保存用户openid
                        wx.setStorageSync('openid', loginRes.result.openid);
                        // 保存用户信息
                        const userInfo = wx.getStorageSync('userInfo') || {};
                        wx.setStorageSync('userInfo', {
                          ...userInfo,
                          openid: loginRes.result.openid
                        });
                        // 跳转到首页
                        wx.switchTab({
                          url: '/pages/my/index'
                        });
                      } else {
                        console.error('登录失败，返回结果：', loginRes);
                        wx.showToast({
                          title: '登录失败，请重试',
                          icon: 'none',
                          duration: 2000
                        });
                      }
                    },
                    fail: (err) => {
                      console.error('登录云函数调用失败：', err);
                      wx.showToast({
                        title: '登录失败，请重试',
                        icon: 'none',
                        duration: 2000
                      });
                    }
                  });
                }, 2000);
              }
            });
          }
        });
      } else {
        throw new Error(res.result.message || '注册失败');
      }
    } catch (err) {
      console.error('注册失败：', err);
      wx.hideLoading({
        complete: () => {
          wx.showToast({
            title: err.message || '注册失败',
            icon: 'none'
          });
        }
      });
    }
  }
}); 