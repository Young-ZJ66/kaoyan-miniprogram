const app = getApp()

Page({
  data: {
    userInfo: null,
    tempAvatarUrl: '',
    tempNickName: '',
    gender: '1',
    birthday: '',
    region: ['', '', ''],
    phone: '',
    email: '',
    genderArray: ['男', '女'],
    genderIndex: 0,
    date: '',
    startDate: '',
    endDate: '',
    openid: ''
  },

  onLoad() {
    // 获取当前用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const openid = wx.getStorageSync('openid');
    
    if (userInfo && openid) {
      // 设置日期范围
      const today = new Date();
      const startDate = new Date(today.getFullYear() - 50, today.getMonth(), today.getDate());
      const endDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      
      // 设置表单数据
      this.setData({
        userInfo,
        openid,
        tempAvatarUrl: userInfo.avatarUrl || '',
        tempNickName: userInfo.nickName || '',
        gender: userInfo.gender || '1',  // 默认为男，使用字符串
        genderIndex: userInfo.gender === '1' ? 0 : 1,  // '1'为男(0)，'2'为女(1)
        birthday: userInfo.birthday || '',
        region: userInfo.region ? userInfo.region.split(' ') : ['请选择', '', ''],
        phone: userInfo.phone || '',
        email: userInfo.email || '',
        date: userInfo.birthday || '',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
    } else {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000,
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 2000);
        }
      });
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      tempAvatarUrl: avatarUrl
    });
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({
      tempNickName: e.detail.value
    });
  },

  // 选择性别
  onGenderChange() {
    wx.showActionSheet({
      itemList: ['男', '女'],
      success: (res) => {
        const gender = res.tapIndex === 0 ? '1' : '2';  // 0为男('1')，1为女('2')
        console.log('选择的性别索引：', res.tapIndex);
        console.log('设置的性别值：', gender);
        this.setData({
          genderIndex: res.tapIndex,
          gender: gender
        });
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

  // 提交修改
  async handleSubmit() {
    const { userInfo, openid, tempAvatarUrl, tempNickName, gender, birthday, region, phone, email } = this.data;
    
    if (!openid) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    // 表单验证
    if (!tempNickName) {
      wx.showToast({
        title: '请输入昵称',
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

    if (!region[0] || !region[1] || !region[2]) {
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

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
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

    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      wx.showToast({
        title: '请输入正确的邮箱',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({
        title: '提交中...',
      });

      // 如果有新头像，先上传
      let fileID = userInfo.avatarUrl;
      if (tempAvatarUrl && tempAvatarUrl !== userInfo.avatarUrl) {
        try {
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: `avatars/${openid}_${Date.now()}.jpg`,
            filePath: tempAvatarUrl,
          });
          fileID = uploadRes.fileID;
        } catch (uploadErr) {
          console.error('头像上传失败：', uploadErr);
          wx.hideLoading();
          wx.showToast({
            title: '头像上传失败',
            icon: 'none'
          });
          return;
        }
      }

      console.log('提交的openid：', openid);
      console.log('提交的性别值：', gender);
      
      // 调用更新用户信息云函数
      const res = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: {
          openid: openid,
          avatarUrl: fileID,
          nickName: tempNickName,
          gender: gender,
          birthday,
          region: region.join(' '),
          phone,
          email
        }
      });

      console.log('更新用户信息返回结果：', res);

      if (res.result && res.result.success) {
        // 更新本地存储的用户信息
        const newUserInfo = {
          ...userInfo,
          avatarUrl: fileID,
          nickName: tempNickName,
          gender: gender,
          birthday,
          region: region.join(' '),
          phone,
          email
        };
        wx.setStorageSync('userInfo', newUserInfo);

        wx.hideLoading();
        wx.showToast({
          title: '修改成功',
          icon: 'success',
          duration: 2000,
          success: () => {
            setTimeout(() => {
              wx.navigateBack();
            }, 2000);
          }
        });
      } else {
        throw new Error(res.result?.message || '更新用户信息失败');
      }
    } catch (err) {
      console.error('修改失败：', err);
      wx.hideLoading();
      wx.showToast({
        title: err.message || '修改失败',
        icon: 'none'
      });
    }
  },

  // 注销账号
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要注销账号吗？此操作不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({
              title: '注销中...',
            });

            const { openid } = this.data;
            
            // 调用删除用户云函数
            const result = await wx.cloud.callFunction({
              name: 'deleteUser',
              data: {
                openid
              }
            });

            if (result.result && result.result.success) {
              // 清除本地存储
              wx.clearStorageSync();
              
              wx.hideLoading();
              wx.showToast({
                title: '注销成功',
                icon: 'success',
                duration: 2000,
                success: () => {
                  setTimeout(() => {
                    // 跳转到登录页面
                    wx.reLaunch({
                      url: '/pages/my/index'
                    });
                  }, 2000);
                }
              });
            } else {
              throw new Error(result.result?.message || '注销失败');
            }
          } catch (err) {
            console.error('注销失败：', err);
            wx.hideLoading();
            wx.showToast({
              title: err.message || '注销失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
}); 