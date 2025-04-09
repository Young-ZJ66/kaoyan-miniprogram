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
    this.loadLikedPosts()
  },

  // 加载我点赞的帖子
  loadLikedPosts: function(refresh = false) {
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
        type: 'getLikedPosts',
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
          if (post.createTime) {
            // 如果是日期对象格式的时间戳
            if (post.createTime._seconds) {
              post.createTime = this.formatTime(post.createTime._seconds * 1000)
            } 
            // 如果是Date对象
            else if (post.createTime instanceof Date) {
              post.createTime = this.formatTime(post.createTime.getTime())
            }
            // 字符串日期或时间戳
            else {
              post.createTime = this.formatTime(post.createTime)
            }
          } else {
            post.createTime = '未知时间'
          }
          
          // 处理评论和点赞数
          post.commentCount = post.comments || post.commentCount || 0
          post.likeCount = post.likes || post.likeCount || 0
          
          // 处理用户信息
          if (!post.userInfo) {
            post.userInfo = {
              nickName: '未知用户',
              avatarUrl: '/images/avatar-default.png'
            }
          } else {
            // 确保用户信息字段完整
            if (!post.userInfo.nickName) post.userInfo.nickName = '未知用户'
            if (!post.userInfo.avatarUrl) post.userInfo.avatarUrl = '/images/avatar-default.png'
          }
          
          // 设置点赞状态
          post.isLiked = true
          
        })

        this.setData({
          posts: refresh ? newPosts : this.data.posts.concat(newPosts),
          page: page + 1,
          hasMore: newPosts.length >= this.data.pageSize,
          loading: false
        })
      } else {
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
      wx.showToast({
        title: '获取帖子失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    })
  },

  // 加载更多帖子
  loadMore: function() {
    this.loadLikedPosts()
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadLikedPosts(true)
    wx.stopPullDownRefresh()
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

  // 取消点赞
  likePost: function(e) {
    const postId = e.currentTarget.dataset.id
    
    // 获取当前帖子
    const post = this.data.posts.find(p => p._id === postId)
    if (!post) return
    
    // 阻止冒泡，避免触发goToPostDetail
    e.stopPropagation()
    
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
            // 由于是取消点赞，所以从列表中移除这个帖子
            return null
          }
          return p
        }).filter(p => p !== null)
        
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
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    })
  },

  // 展开或收起帖子内容
  toggleContent: function(e) {
    const postId = e.currentTarget.dataset.id
    const posts = this.data.posts.map(post => {
      if (post._id === postId) {
        return { ...post, showFull: !post.showFull }
      }
      return post
    })
    this.setData({ posts })
  },

  // 格式化时间显示
  formatTime: function(timestamp) {
    if (!timestamp) return ''
    
    const now = new Date()
    const date = new Date(timestamp)
    const diff = now - date
    
    // 如果是今天，显示几小时前或几分钟前
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
      if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (60 * 1000))
        return `${minutes === 0 ? 1 : minutes}分钟前`
      } else {
        const hours = Math.floor(diff / (60 * 60 * 1000))
        return `${hours}小时前`
      }
    } 
    // 如果是昨天，显示昨天+时间
    else if (diff < 48 * 60 * 60 * 1000 && now.getDate() - date.getDate() <= 1) {
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    } 
    // 如果是今年，显示月-日 时:分
    else if (date.getFullYear() === now.getFullYear()) {
      return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    } 
    // 其他情况显示完整日期
    else {
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    }
  },
}) 