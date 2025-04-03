const app = getApp();

Page({
  data: {
    postId: '',
    post: null,
    comments: [],
    loading: true,
    newComment: '',
    userInfo: null,
    isLoading: false,
    isCommenting: false
  },

  onLoad: function (options) {
    if (options.id) {
      // 获取用户信息
      const userInfo = wx.getStorageSync('userInfo');
      
      this.setData({
        postId: options.id,
        userInfo: userInfo || null
      });
      
      this.loadPostDetail();
      this.loadComments();
    } else {
      wx.showToast({
        title: '帖子不存在',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onShow: function() {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    
    // 检查用户登录状态变化
    if (!userInfo && this.data.userInfo) {
      // 用户登出了，重置点赞状态
      if (this.data.post) {
        const post = this.data.post;
        post.isLiked = false;
        this.setData({
          userInfo: null,
          post: post
        });
      }
      return;
    }
    
    // 如果本地存储有用户信息，直接使用
    if (userInfo) {
      this.setData({
        userInfo: userInfo
      });
      
      // 如果之前已加载过帖子，更新点赞状态
      if (this.data.post) {
        this.checkLikeStatus();
      }
    }
  },

  // 加载帖子详情
  loadPostDetail: function () {
    const db = wx.cloud.database();
    
    wx.showLoading({
      title: '加载中',
    });
    
    db.collection('posts').doc(this.data.postId).get().then(res => {
      if (res.data) {
        // 格式化时间
        const createTime = this.formatTime(res.data.createTime);
        const post = {
          ...res.data,
          createTime: createTime
        };
        
        this.setData({
          post: post,
          loading: false
        });
        
        // 检查用户是否点赞过该帖子
        this.checkLikeStatus();
      } else {
        wx.showToast({
          title: '帖子不存在',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
      
      wx.hideLoading();
    }).catch(err => {
      this.setData({
        loading: false
      });
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  // 加载评论列表
  loadComments: function () {
    this.setData({
      isLoading: true
    });
    
    // 直接从数据库查询评论
    const db = wx.cloud.database();
    db.collection('comments')
      .where({
        postId: this.data.postId
      })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        if (res.data) {
          const comments = res.data.map(comment => {
            return {
              ...comment,
              createTime: this.formatTime(comment.createTime)
            };
          });
          
          this.setData({
            comments: comments,
            isLoading: false
          });
        }
      }).catch(err => {
        this.setData({
          isLoading: false
        });
        wx.showToast({
          title: '获取评论失败',
          icon: 'none'
        });
      });
  },

  // 检查点赞状态
  checkLikeStatus: function () {
    if (!this.data.userInfo) {
      return;
    }
    
    // 尝试获取用户的openid
    const openid = this.data.userInfo.openid || this.data.userInfo._openid || '';
    if (!openid) {
      return;
    }
    
    wx.cloud.callFunction({
      name: 'forum',
      data: {
        type: 'checkLikeStatus',
        data: {
          postIds: [this.data.postId],
          openid: openid
        }
      }
    }).then(res => {
      if (res.result && res.result.success && this.data.post) {
        const post = this.data.post;
        const likedPostIds = res.result.data || [];
        post.isLiked = likedPostIds.includes(this.data.postId);
        
        this.setData({
          post: post
        });
      }
    }).catch(err => {
      // 检查点赞状态失败
    });
  },

  // 点赞/取消点赞
  likePost: function () {
    if (!this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    // 尝试获取用户的openid
    const openid = this.data.userInfo.openid || this.data.userInfo._openid || '';
    if (!openid) {
      wx.showToast({
        title: '用户信息不完整',
        icon: 'none'
      });
      return;
    }

    if (this.likeInProgress) return;
    this.likeInProgress = true;
    
    const post = this.data.post;
    // 先更新UI状态
    post.isLiked = !post.isLiked;
    post.likes = post.isLiked ? (post.likes || 0) + 1 : (post.likes || 1) - 1;
    
    this.setData({
      post: post
    });

    // 调用云函数
    wx.cloud.callFunction({
      name: 'forum',
      data: {
        type: 'likePost',
        data: {
          id: this.data.postId
        }
      }
    }).then(res => {
      // 已在UI上处理了状态，无需再次更新
      
      setTimeout(() => {
        this.likeInProgress = false;
      }, 500); // 点赞操作完成后，延迟500ms重置状态，防止重复点击
    }).catch(err => {
      // 发生错误，恢复原状态
      post.isLiked = !post.isLiked;
      post.likes = post.isLiked ? (post.likes || 0) + 1 : (post.likes || 1) - 1;
      
      this.setData({
        post: post
      });
      
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
      
      this.likeInProgress = false;
    });
  },

  // 提交评论
  submitComment: function () {
    if (!this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    if (!this.data.newComment.trim()) {
      wx.showToast({
        title: '评论内容不能为空',
        icon: 'none'
      });
      return;
    }

    if (this.data.isCommenting) return;
    
    this.setData({
      isCommenting: true
    });

    wx.cloud.callFunction({
      name: 'forum',
      data: {
        type: 'commentPost',
        data: {
          id: this.data.postId,
          content: this.data.newComment
        }
      }
    }).then(res => {
      if (res.result && res.result.success) {
        // 添加新评论到列表
        const newCommentObj = {
          _id: res.result.commentId || Date.now().toString(),
          postId: this.data.postId,
          content: this.data.newComment,
          userInfo: this.data.userInfo,
          createTime: this.formatTime(new Date())
        };
        
        const comments = [newCommentObj, ...this.data.comments];
        
        // 更新帖子评论数
        const post = this.data.post;
        post.comments = (post.comments || 0) + 1;
        
        this.setData({
          comments: comments,
          newComment: '',
          isCommenting: false,
          post: post
        });
        
        wx.showToast({
          title: '评论成功',
          icon: 'success'
        });
      } else {
        this.setData({
          isCommenting: false
        });
        
        wx.showToast({
          title: '评论失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      this.setData({
        isCommenting: false
      });
      
      wx.showToast({
        title: '评论失败',
        icon: 'none'
      });
    });
  },

  // 输入评论内容
  inputComment: function (e) {
    this.setData({
      newComment: e.detail.value
    });
  },

  // 预览图片
  previewImage: function (e) {
    const { urls, current } = e.currentTarget.dataset;
    wx.previewImage({
      urls: urls,
      current: current
    });
  },

  // 格式化时间
  formatTime: function (date) {
    if (!date) return '';
    
    // 处理不同类型的日期输入
    let dateObj;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'number') {
      // 处理时间戳
      dateObj = new Date(date);
    } else if (typeof date === 'string') {
      // 尝试解析ISO日期字符串
      dateObj = new Date(date);
    } else {
      return '未知时间';
    }
    
    // 检查日期是否有效
    if (isNaN(dateObj.getTime())) {
      return '未知时间';
    }
    
    const now = new Date();
    const diff = now.getTime() - dateObj.getTime();
    
    // 小于1分钟显示"刚刚"
    if (diff < 60 * 1000) {
      return '刚刚';
    }
    
    // 小于1小时显示"x分钟前"
    if (diff < 60 * 60 * 1000) {
      return Math.floor(diff / (60 * 1000)) + '分钟前';
    }
    
    // 小于24小时显示"x小时前"
    if (diff < 24 * 60 * 60 * 1000) {
      return Math.floor(diff / (60 * 60 * 1000)) + '小时前';
    }
    
    // 小于30天显示"x天前"
    if (diff < 30 * 24 * 60 * 60 * 1000) {
      return Math.floor(diff / (24 * 60 * 60 * 1000)) + '天前';
    }
    
    // 大于30天显示具体日期，格式：yyyy-MM-dd
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    
    return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
  },

  // 重置评论
  resetComment: function() {
    this.setData({
      newComment: '',
      isCommenting: false
    });
  }
}); 