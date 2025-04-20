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
    openid: ''
  },

  onLoad() {
    // 获取当前用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const auth = wx.getStorageSync('auth');
    
    if (userInfo && auth && auth.token) {
      // 从 token 中获取 openid
      const openid = auth.token.split('_')[0];
      
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
        email: userInfo.email || ''
      });
    } else {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000,
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
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
        ;
        ;
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

      ;
      ;
      
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

      ;

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
            
            // 记录注销账号日志
            try {
              const systemInfo = wx.getDeviceInfo();
              const appBaseInfo = wx.getAppBaseInfo();
              
              await wx.cloud.callFunction({
                name: 'logOperation',
                data: {
                  type: 'deleteAccount',
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
              console.error('记录注销账号日志失败：', err);
              // 记录日志失败不影响注销流程
            }
            
            // 1. 获取并删除用户的所有计划
            const plansRes = await wx.cloud.database().collection('plans').where({
              _openid: openid
            }).get();

            if (plansRes.data && plansRes.data.length > 0) {
              // 删除每个计划
              for (const plan of plansRes.data) {
                await wx.cloud.callFunction({
                  name: 'deletePlan',
                  data: {
                    planId: plan._id
                  }
                });
              }
            }

            // 2. 获取并删除用户的所有帖子
            const postsRes = await wx.cloud.callFunction({
              name: 'forum',
              data: {
                type: 'getMyPosts',
                data: {
                  openid
                }
              }
            });

            if (postsRes.result && postsRes.result.success) {
              const posts = postsRes.result.data || [];
              for (const post of posts) {
                await wx.cloud.callFunction({
                  name: 'forum',
                  data: {
                    type: 'deletePost',
                    data: {
                      id: post._id
                    }
                  }
                });
              }
            }

            // 3. 删除用户相关记录
            await wx.cloud.callFunction({
              name: 'deleteUser',
              data: {
                openid,
                deleteRelated: true // 添加标志，表示需要删除相关记录
              }
            });

            // 4. 清除本地存储
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