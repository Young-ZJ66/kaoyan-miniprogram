const app = getApp()

Page({
  data: {
    posts: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false
  },

  onLoad: function() {
    this.loadMyPosts()
  },

  // 加载我的帖子
  loadMyPosts: function(refresh = false) {
    // 如果正在加载或没有更多数据，直接返回
    if (this.data.loading || (!this.data.hasMore && !refresh)) return

    const page = refresh ? 1 : this.data.page

    this.setData({ loading: true })

    if (!refresh) {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });
    }

    wx.cloud.callFunction({
      name: 'forum',
      data: {
        type: 'getMyPosts',
        data: {
          page: page,
          pageSize: this.data.pageSize
        }
      }
    }).then(res => {
      if (!refresh) {
        wx.hideLoading();
      }
      
      if (res.result.success) {
        const newPosts = res.result.data || []
        
        if (newPosts.length === 0) {
          this.setData({
            loading: false,
            hasMore: false
          })
          return
        }
        
        // 格式化时间和处理帖子字段
        newPosts.forEach(post => {
          // 处理时间
          post.formattedTime = this.formatTime(post.createdAt);
          
          // 处理评论和点赞数
          post.commentCount = post.comments || post.commentCount || 0;
          post.likeCount = post.likes || post.likeCount || 0;
          
          // 处理用户信息
          if (!post.userInfo) {
            post.userInfo = {
              nickName: '未知用户',
              avatarUrl: '/images/avatar-default.png'
            }
          } else {
            // 确保用户信息字段完整
            if (!post.userInfo.nickName) post.userInfo.nickName = '未知用户';
            if (!post.userInfo.avatarUrl) post.userInfo.avatarUrl = '/images/avatar-default.png';
          }
          
          // 标记为用户自己的帖子
          post.isOwner = true;
          
          // 检查内容是否需要展开按钮（超过3行或超过100字符）
          post.isOverflow = post.content && (
            post.content.length > 100 || 
            (post.content.match(/\n/g) || []).length >= 3 ||
            post.content.split('\n').some(line => line.length > 30)  // 检查单行是否过长
          );
          
          // 设置初始状态
          post.showFull = false;
          
        })

        this.setData({
          posts: refresh ? newPosts : this.data.posts.concat(newPosts),
          page: page + 1,
          hasMore: newPosts.length >= this.data.pageSize,
          loading: false
        })
        
        // 检查帖子的点赞状态
        this.checkLikeStatus()
      } else {
        console.error('获取帖子失败原因:', res.result.message, res.result.error)
        wx.showToast({
          title: res.result.message || '获取帖子失败',
          icon: 'none'
        })
        this.setData({ loading: false })
      }
    }).catch(err => {
      if (!refresh) {
        wx.hideLoading();
      }
      console.error('获取帖子失败详细错误：', err)
      wx.showToast({
        title: '获取帖子失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    })
  },

  // 加载更多帖子
  loadMore: function() {
    this.loadMyPosts()
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadMyPosts(true)
    wx.stopPullDownRefresh()
  },

  // 检查帖子点赞状态
  checkLikeStatus: function() {
    const posts = this.data.posts
    if (!posts || posts.length === 0) return
    
    const postIds = posts.map(post => post._id)
    
    wx.cloud.callFunction({
      name: 'forum',
      data: {
        type: 'checkLikeStatus',
        data: { postIds }
      }
    }).then(res => {
      if (res.result.success) {
        const likedPostIds = res.result.data || []
        
        // 更新点赞状态
        const updatedPosts = posts.map(post => {
          return {
            ...post,
            isLiked: likedPostIds.includes(post._id)
          }
        })
        
        this.setData({ posts: updatedPosts })
      } else {
        console.error('检查点赞状态失败:', res.result.message)
      }
    }).catch(err => {
      console.error('检查点赞状态出错:', err)
    })
  },

  // 点赞/取消点赞
  likePost: function(e) {
    const postId = e.currentTarget.dataset.id
    
    // 获取当前帖子
    const post = this.data.posts.find(p => p._id === postId)
    if (!post) return
    
    // 设置一个标志来防止事件冒泡
    e.currentTarget.dataset.stopBubble = true
    
    wx.showLoading({
      title: '处理中...',
    })
    
    wx.cloud.callFunction({
      name: 'forum',
      data: {
        type: 'toggleLike',
        data: { id: postId }
      }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        // 更新帖子点赞状态和数量
        const updatedPosts = this.data.posts.map(p => {
          if (p._id === postId) {
            const isLiked = !p.isLiked
            return { 
              ...p, 
              isLiked,
              likeCount: isLiked ? p.likeCount + 1 : p.likeCount - 1
            }
          }
          return p
        })
        
        this.setData({ posts: updatedPosts })
        
        // 通知社区页面刷新
        const pages = getCurrentPages()
        const communityPage = pages.find(page => page.route === 'pages/community/index')
        if (communityPage) {
          communityPage.setData({
            page: 1,
            posts: [],
            hasMore: true
          })
          communityPage.loadPosts()
        }
      } else {
        wx.showToast({
          title: res.result.message || '操作失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('点赞操作失败：', err)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    })
  },

  // 预览图片
  previewImage: function(e) {
    const { urls, current } = e.currentTarget.dataset
    wx.previewImage({
      urls: urls,
      current: current
    })
  },

  // 跳转到帖子详情
  goToPostDetail: function(e) {
    const postId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/community/detail/index?id=${postId}`
    })
  },

  // 删除帖子
  deletePost: function(e) {
    const postId = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个帖子吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
          })
          wx.cloud.callFunction({
            name: 'forum',
            data: {
              type: 'deletePost',
              data: { id: postId }
            }
          }).then(res => {
            wx.hideLoading()
            if (res.result.success) {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              })
              
              // 从列表中移除已删除的帖子
              const updatedPosts = this.data.posts.filter(post => post._id !== postId)
              this.setData({ posts: updatedPosts })
              
              // 通知社区页面刷新
              const pages = getCurrentPages()
              const communityPage = pages.find(page => page.route === 'pages/community/index')
              if (communityPage) {
                communityPage.setData({
                  page: 1,
                  posts: [],
                  hasMore: true
                })
                communityPage.loadPosts()
              }
            } else {
              wx.showToast({
                title: res.result.message || '删除失败',
                icon: 'none'
              })
            }
          }).catch(err => {
            wx.hideLoading()
            console.error('删除帖子失败：', err)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

  // 切换内容展开/收起状态
  toggleContent: function(e) {
    const id = e.currentTarget.dataset.id;
    const posts = this.data.posts;
    const index = posts.findIndex(post => post._id === id);
    
    if (index !== -1) {
      const post = posts[index];
      const key = `posts[${index}].showFull`;
      
      this.setData({
        [key]: !post.showFull
      });
    }
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
        } else if (timestamp._seconds) {
          date = new Date(timestamp._seconds * 1000);
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
}) 