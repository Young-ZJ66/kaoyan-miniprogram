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
    isCommenting: false,
    replyMode: false,
    replyToCommentId: '',
    replyToNickname: '',
    replyToOpenid: '',
    replyToReplyId: null,
    replyToReplyIndex: null
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

    // 监听点击事件，点击非评论区域时取消回复模式
    this.touchStartHandler = (e) => {
      this.touchStartY = e.touches[0].clientY;
    };

    this.touchEndHandler = (e) => {
      if (this.data.replyMode) {
        // 检测是否是滑动操作，避免滑动时取消回复
        const touchEndY = e.changedTouches[0].clientY;
        const touchDiff = Math.abs(touchEndY - this.touchStartY);
        
        if (touchDiff < 10) { // 如果移动距离小于10px，认为是点击而非滑动
          // 检查点击区域是否在评论区域内
          const target = e.target;
          if (target && !target.dataset.preventCancel) {
            this.cancelReply();
          }
        }
      }
    };
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

  onHide: function() {
    // 离开页面时取消回复模式
    if (this.data.replyMode) {
      this.cancelReply();
    }
  },

  onReady: function() {
    // 在页面准备完成后注册触摸事件处理器
    wx.createSelectorQuery()
      .select('.container')
      .boundingClientRect(res => {
        this.containerRect = res;
      })
      .exec();
  },

  onUnload: function() {
    // 页面卸载时清除事件监听器
    this.touchStartHandler = null;
    this.touchEndHandler = null;
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
        const formattedTime = this.formatTime(res.data.createdAt);
        
        // 获取当前用户信息，判断是否为帖子发布者
        const userInfo = this.data.userInfo || {};
        const userOpenid = userInfo.openid || userInfo._openid || '';
        const postOpenid = res.data._openid || (res.data.userInfo && res.data.userInfo.openid);
        const isOwner = userOpenid && postOpenid && userOpenid === postOpenid;
        
        const post = {
          ...res.data,
          formattedTime: formattedTime,
          isOwner: isOwner  // 添加标识，表示当前用户是否为发帖人
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
    const _ = db.command; // 添加db.command定义
    let mainComments = [];
    
    // 1. 先获取主评论
    db.collection('comments')
      .where({
        postId: this.data.postId,
        isReply: _.or(_.exists(false), _.eq(false)) // 不是回复的评论或isReply字段不存在
      })
      .orderBy('createdAt', 'desc')
      .get()
      .then(res => {
        if (res.data) {
          mainComments = res.data.map(comment => {
            return {
              ...comment,
              formattedTime: this.formatTime(comment.createdAt),
              replies: [] // 初始化回复数组
            };
          });
          
          // 2. 获取所有回复
          return db.collection('comments')
            .where({
              postId: this.data.postId,
              isReply: true
            })
            .orderBy('createdAt', 'asc')
            .get();
        }
        return { data: [] };
      })
      .then(replyRes => {
        // 处理回复数据，将其添加到对应的主评论中
        if (replyRes.data && replyRes.data.length > 0) {
          const replies = replyRes.data;
          
          // 遍历所有回复，将其添加到对应的主评论replies数组中
          replies.forEach(reply => {
            // 查找对应的主评论
            const parentComment = mainComments.find(c => c._id === reply.parentCommentId);
            if (parentComment) {
              // 格式化回复时间
              const formattedReply = {
                ...reply,
                formattedTime: this.formatTime(reply.createdAt)
              };
              
              // 添加到主评论的回复数组中
              parentComment.replies.push(formattedReply);
            }
          });
        }
        
        this.setData({
          comments: mainComments,
          isLoading: false
        });
      })
      .catch(err => {
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

  // 成功操作后设置刷新标记
  setRefreshFlag: function() {
    if (getApp().globalData) {
      getApp().globalData.forumNeedsRefresh = true;
    }
  },

  // 点赞/取消点赞帖子
  toggleLike: function() {
    // 检查用户是否登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再点赞',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/my/index'
            });
          }
        }
      });
      return;
    }

    const id = this.data.postId;
    if (!id) return;

    // 处理点赞/取消点赞
    wx.cloud.callFunction({
      name: 'forum',
      data: {
        type: 'toggleLike',
        data: { id }
      }
    }).then(res => {
      if (res.result.success) {
        // 更新帖子点赞状态
        const isLiked = !this.data.post.isLiked;
        const likeCount = isLiked 
          ? (this.data.post.likes || 0) + 1 
          : Math.max(0, (this.data.post.likes || 0) - 1);
        
        this.setData({
          post: {
            ...this.data.post,
            isLiked,
            likes: likeCount
          }
        });
        
        // 设置刷新标记，让社区页面知道需要刷新数据
        this.setRefreshFlag();
      } else {
        wx.showToast({
          title: res.result.message || '操作失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    });
  },

  // 阻止事件冒泡
  preventBubble: function(e) {
    // 仅阻止冒泡，不做任何操作
    return;
  },

  // 显示回复输入框
  showReplyInput: function(e) {
    const { commentId, nickname, replyId, replyIndex, replyOpenid } = e.currentTarget.dataset;
    
    // 防止重复点击
    if (this.showReplyInputTimer) {
      clearTimeout(this.showReplyInputTimer);
    }
    
    this.showReplyInputTimer = setTimeout(() => {
      this.setData({
        replyMode: true,
        replyToCommentId: commentId,
        replyToNickname: nickname,
        replyToOpenid: replyOpenid || '',
        replyToReplyId: replyId || null,
        replyToReplyIndex: replyIndex !== undefined ? replyIndex : null,
        newComment: '' // 清空输入框
      });
      
      // 让输入框获取焦点
      setTimeout(() => {
        wx.createSelectorQuery()
          .select('.comment-input')
          .context(res => {
            if (res && res.context) {
              res.context.focus();
            }
          })
          .exec();
          
        wx.pageScrollTo({
          scrollTop: 9999,
          duration: 300
        });
      }, 300);
    }, 100); // 100毫秒防抖
  },
  
  // 取消回复
  cancelReply: function() {
    // 如果不在回复模式，直接返回
    if (!this.data.replyMode) return;
    
    this.setData({
      replyMode: false,
      replyToCommentId: '',
      replyToNickname: '',
      replyToOpenid: '',
      replyToReplyId: null,
      replyToReplyIndex: null,
      newComment: '' // 清空输入框
    });
  },

  // 提交评论
  submitComment: function() {
    // 防止重复提交
    if (this.data.isCommenting) {
      return;
    }
    
    const { 
      newComment, 
      postId, 
      replyMode, 
      replyToCommentId, 
      replyToNickname, 
      replyToOpenid,
      replyToReplyId,
      replyToReplyIndex
    } = this.data;
    
    if (!newComment || !newComment.trim()) {
      wx.showToast({
        title: '评论内容不能为空',
        icon: 'none'
      });
      return;
    }
    
    if (!postId) {
      wx.showToast({
        title: '帖子ID不存在',
        icon: 'none'
      });
      return;
    }
    
    // 检查用户是否登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再评论',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/my/index'
            });
          }
        }
      });
      return;
    }
    
    // 显示加载中
    this.setData({
      isCommenting: true
    });
    wx.showLoading({
      title: '提交中...',
    });
    
    // 准备评论数据
    const commentData = {
      postId: postId,
      content: newComment.trim()
    };
    
    // 如果是回复模式，添加回复相关信息
    if (replyMode && replyToCommentId) {
      commentData.isReply = true;
      commentData.parentCommentId = replyToCommentId;
      
      // 如果是回复某个回复，而不是直接回复主评论
      if (replyToReplyId) {
        // 获取当前主评论
        const parentComment = this.data.comments.find(c => c._id === replyToCommentId);
        
        if (parentComment && parentComment.replies && parentComment.replies.length > 0 && replyToReplyIndex !== null) {
          // 找到被回复的回复评论
          const targetReply = parentComment.replies[replyToReplyIndex];
          
          if (targetReply) {
            commentData.replyTo = {
              nickName: targetReply.userInfo.nickName || '匿名用户',
              openid: targetReply.userInfo.openid || ''
            };
          }
        }
      } else {
        // 直接回复主评论
        commentData.replyTo = {
          nickName: replyToNickname,
          openid: replyToOpenid || ''
        };
      }
    }
    
    // 提交评论
    wx.cloud.callFunction({
      name: 'forum',
      data: {
        type: 'addComment',
        data: commentData
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.result.success) {
        // 重置评论状态
        this.setData({
          newComment: '',
          isCommenting: false,
          replyMode: false,
          replyToCommentId: '',
          replyToNickname: '',
          replyToOpenid: '',
          replyToReplyId: null,
          replyToReplyIndex: null
        });
        
        // 更新评论列表
        this.loadComments();
        
        // 设置刷新标记，让社区页面知道需要刷新数据
        this.setRefreshFlag();
        
        wx.showToast({
          title: replyMode ? '回复成功' : '评论成功',
          icon: 'success'
        });
      } else {
        this.setData({
          isCommenting: false
        });
        wx.showToast({
          title: res.result.message || '评论失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      
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
  formatTime: function(timestamp) {
    if (!timestamp) return '';

    let date;
    try {
      // 处理不同类型的时间戳
      if (typeof timestamp === 'object') {
        if (timestamp instanceof Date) {
          date = timestamp;
        } else if (timestamp.$date) {
          date = new Date(timestamp.$date);
        } else if (timestamp.seconds) {
          date = new Date(timestamp.seconds * 1000);
        } else {
          return '';
        }
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      } else {
        return '';
      }

      if (isNaN(date.getTime())) {
        return '';
      }

      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minute = 1000 * 60;
      const hour = minute * 60;
      const day = hour * 24;
      const month = day * 30;
      const year = day * 365;

      // 小于1分钟
      if (diff < minute) {
        return '刚刚';
      }
      // 小于1小时
      if (diff < hour) {
        return Math.floor(diff / minute) + '分钟前';
      }
      // 小于24小时
      if (diff < day) {
        return Math.floor(diff / hour) + '小时前';
      }
      // 小于30天
      if (diff < month) {
        return Math.floor(diff / day) + '天前';
      }
      // 小于365天
      if (diff < year) {
        return Math.floor(diff / month) + '个月前';
      }
      // 超过365天
      return Math.floor(diff / year) + '年前';
    } catch (error) {
      return '';
    }
  },

  // 重置评论
  resetComment: function() {
    this.setData({
      newComment: '',
      isCommenting: false
    });
  },

  // 删除帖子
  deletePost: function() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这篇帖子吗？删除后无法恢复',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
          });
          
          wx.cloud.callFunction({
            name: 'forum',
            data: {
              type: 'deletePost',
              data: { id: this.data.postId }
            }
          }).then(res => {
            wx.hideLoading();
            
            if (res.result.success) {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
              
              // 设置刷新标记，让社区页面知道需要刷新数据
              this.setRefreshFlag();
              
              // 延迟返回
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            } else {
              wx.showToast({
                title: res.result.message || '删除失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('删除帖子失败:', err);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          });
        }
      }
    });
  },
  
  // 下拉刷新函数
  onPullDownRefresh: function() {
    // 显示加载中提示框
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 检查帖子ID是否存在
    if (this.data.postId) {
      // 并行加载帖子详情和评论
      Promise.all([
        new Promise((resolve) => {
          this.loadPostDetail();
          resolve();
        }),
        new Promise((resolve) => {
          this.loadComments();
          resolve();
        })
      ]).then(() => {
        // 所有数据加载完成后，停止下拉刷新动画
        wx.stopPullDownRefresh();
        // 隐藏加载提示框
        wx.hideLoading();
      }).catch(() => {
        wx.stopPullDownRefresh();
        wx.hideLoading();
      });
    } else {
      wx.stopPullDownRefresh();
      wx.hideLoading();
    }
  },
}); 