const app = getApp()

// 记录正在进行的点赞操作
let likeInProgress = {}; 

Page({
  data: {
    posts: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false
  },

  onLoad: function() {
    if (!wx.cloud) {
      // 请使用 2.2.3 或以上的基础库以使用云能力
    } else {
      wx.cloud.init({
        env: 'cloud1-9gbyqyqyb5f2cb69',
        traceUser: true,
      })
    }

    this.loadPosts()
  },

  onShow: function() {
    // 获取当前用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const currentLoginStatus = !!userInfo;
    
    // 检查登录状态是否发生变化
    if (this.lastLoginStatus !== undefined && this.lastLoginStatus !== currentLoginStatus) {
      // 登录状态发生变化，强制刷新页面
      this.setData({
        page: 1,
        posts: [],
        hasMore: true
      });
      this.loadPosts();
    } else if (this.data.posts.length === 0) {
      // 没有数据时加载
      this.setData({
        page: 1,
        hasMore: true
      });
      this.loadPosts();
    }
    
    // 记录当前登录状态，用于下次比较
    this.lastLoginStatus = currentLoginStatus;
    
    // 检查用户登录状态
    if (!currentLoginStatus) {
      // 用户未登录或已退出，重置所有帖子的点赞状态
      this.resetAllLikeStatus();
    }
  },

  // 加载帖子列表
  loadPosts: function() {
    if (this.data.loading) return Promise.resolve()

    this.setData({ loading: true })
    wx.showLoading({
      title: '加载中...',
    })

    return wx.cloud.callFunction({
      name: 'forum',
      data: {
        type: 'getPosts',
        data: {
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      }
    }).then(res => {
      if (res.result.success) {
        // 获取当前用户的openid
        const userInfo = wx.getStorageSync('userInfo') || {}
        const myOpenid = userInfo.openid || userInfo._openid || ''
        
        // 格式化帖子数据
        const formattedPosts = res.result.data.map(post => {
          // 检查是否已点赞（简单实现，实际应从后端获取）
          return {
            ...post,
            createTime: this.formatTime(post.createTime),
            likeCount: post.likes || 0,
            commentCount: post.comments || 0,
            isLiked: false, // 默认未点赞，实际状态将通过checkLikeStatus更新
            showFull: false // 新增showFull属性
          }
        })
        
        const newList = this.data.page === 1 ? formattedPosts : [...this.data.posts, ...formattedPosts]
        this.setData({
          posts: newList,
          hasMore: res.result.data.length === this.data.pageSize
        })
        
        // 检查每篇帖子的点赞状态
        if (myOpenid) {
          this.checkLikeStatus(newList, myOpenid)
        }
      } else {
        wx.showToast({
          title: res.result.message || '获取帖子失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      wx.showToast({
        title: '获取帖子失败',
        icon: 'none'
      })
    }).finally(() => {
      this.setData({ loading: false })
      wx.hideLoading()
    })
  },

  // 检查帖子点赞状态
  checkLikeStatus: function(posts, openid) {
    if (!posts.length || !openid) {
      return
    }
    
    const postIds = posts.map(post => post._id)
    
    wx.cloud.callFunction({
      name: 'forum',
      data: {
        type: 'checkLikeStatus',
        data: {
          postIds,
          openid
        }
      }
    }).then(res => {
      if (res.result.success) {
        const likedPostIds = res.result.data || []
        
        // 更新帖子的点赞状态
        const updatedPosts = posts.map(post => {
          const isLiked = likedPostIds.includes(post._id)
          return {
            ...post,
            isLiked
          }
        })
        
        this.setData({
          posts: updatedPosts
        })
      }
    }).catch(err => {
      // 检查点赞状态失败
    })
  },

  // 格式化时间
  formatTime: function(dateObj) {
    if (!dateObj) return ''
    
    // 如果是日期字符串，转为日期对象
    let date
    if (typeof dateObj === 'string') {
      date = new Date(dateObj)
    } else if (dateObj instanceof Date) {
      date = dateObj
    } else if (dateObj && dateObj.$date) {
      // 处理云函数返回的日期格式 { $date: timestamp }
      date = new Date(dateObj.$date)
    } else {
      return ''
    }
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return ''
    }
    
    const now = new Date()
    const diff = now - date
    
    // 小于1分钟显示"刚刚"
    if (diff < 60 * 1000) {
      return '刚刚'
    }
    
    // 小于1小时显示"x分钟前"
    if (diff < 60 * 60 * 1000) {
      return Math.floor(diff / (60 * 1000)) + '分钟前'
    }
    
    // 小于24小时显示"x小时前"
    if (diff < 24 * 60 * 60 * 1000) {
      return Math.floor(diff / (60 * 60 * 1000)) + '小时前'
    }
    
    // 小于30天显示"x天前"
    if (diff < 30 * 24 * 60 * 60 * 1000) {
      return Math.floor(diff / (24 * 60 * 60 * 1000)) + '天前'
    }
    
    // 否则显示完整日期
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    
    return `${year}-${month}-${day}`
  },

  // 加载更多
  loadMore: function() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({
        page: this.data.page + 1
      })
      this.loadPosts()
    }
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    // 设置页码为1
    this.setData({
      page: 1,
      hasMore: true
    });
    
    // 先清空当前帖子列表
    this.setData({
      posts: []
    });
    
    this.loadPosts()
      .then(() => {
        wx.stopPullDownRefresh();
      })
      .catch(err => {
        wx.stopPullDownRefresh();
      });
  },

  // 进入聊天室
  goToChatRoom: function() {
    // 检查用户是否登录
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再进入聊天室',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/my/index'
            })
          }
        }
      })
      return
    }

    wx.navigateTo({
      url: '/pages/community/chat/index'
    })
  },

  // 发布帖子
  goToPost: function() {
    // 检查用户是否登录
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再发帖',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/my/index'
            })
          }
        }
      })
      return
    }

    wx.navigateTo({
      url: '/pages/community/post/index'
    })
  },

  // 进入帖子详情
  goToPostDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    
    wx.navigateTo({
      url: '/pages/community/detail/index?id=' + id
    });
  },

  // 跳转到发帖页面
  navigateToPost() {
    // 检查用户是否登录
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再发帖',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/my/index'
            })
          }
        }
      })
      return
    }

    wx.navigateTo({
      url: '/pages/community/post/index'
    })
  },

  // 预览图片
  previewImage: function(e) {
    const urls = e.currentTarget.dataset.urls
    const current = e.currentTarget.dataset.current
    
    wx.previewImage({
      current: current,
      urls: urls
    })
  },

  // 点赞帖子
  likePost: function(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    
    // 防止重复点击：如果该帖子正在处理点赞操作，则忽略
    if (likeInProgress[id]) {
      return
    }
    
    // 标记该帖子正在处理点赞
    likeInProgress[id] = true
    
    // 检查用户是否登录
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      likeInProgress[id] = false // 重置标记
      wx.showModal({
        title: '提示',
        content: '请先登录后再点赞',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/my/index'
            })
          }
        }
      })
      return
    }
    
    // 先在本地更新UI以提高响应速度
    const posts = this.data.posts
    const index = posts.findIndex(post => post._id === id)
    
    if (index !== -1) {
      const isLiked = posts[index].isLiked
      const likeCount = posts[index].likeCount || 0
      
      // 更新本地状态
      posts[index].isLiked = !isLiked
      posts[index].likeCount = isLiked ? likeCount - 1 : likeCount + 1
      
      this.setData({ posts })
    }
    
    // 调用云函数进行实际的点赞/取消点赞操作
    wx.cloud.callFunction({
      name: 'forum',
      data: {
        type: 'likePost',
        data: { id }
      }
    }).then(res => {
      if (!res.result.success) {
        wx.showToast({
          title: res.result.message || '操作失败',
          icon: 'none'
        })
        
        // 操作失败，恢复原状态
        if (index !== -1) {
          const isLiked = posts[index].isLiked
          const likeCount = posts[index].likeCount || 0
          
          posts[index].isLiked = !isLiked
          posts[index].likeCount = isLiked ? likeCount - 1 : likeCount + 1
          
          this.setData({ posts })
        }
      }
    }).catch(err => {
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
      
      // 操作失败，恢复原状态
      if (index !== -1) {
        const isLiked = posts[index].isLiked
        const likeCount = posts[index].likeCount || 0
        
        posts[index].isLiked = !isLiked
        posts[index].likeCount = isLiked ? likeCount - 1 : likeCount + 1
        
        this.setData({ posts })
      }
    }).finally(() => {
      // 操作完成，重置标记
      setTimeout(() => {
        likeInProgress[id] = false
      }, 500) // 添加500ms延迟，防止过快点击
    })
  },

  // 切换帖子内容显示状态
  toggleContent: function(e) {
    // 从事件中获取帖子ID
    const id = e.currentTarget.dataset.id;
    
    // catchtap已经阻止了事件冒泡，这里不需要额外处理
    
    const posts = this.data.posts;
    const index = posts.findIndex(post => post._id === id);
    
    if (index !== -1) {
      // 切换显示状态
      posts[index].showFull = !posts[index].showFull;
      
      this.setData({
        posts: posts
      });
    }
  },

  // 重置所有帖子的点赞状态
  resetAllLikeStatus: function() {
    if (!this.data.posts.length) return;
    
    const updatedPosts = this.data.posts.map(post => {
      return {
        ...post,
        isLiked: false
      };
    });
    
    this.setData({
      posts: updatedPosts
    });
  }
}) 