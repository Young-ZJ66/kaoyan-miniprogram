const app = getApp()

// 记录正在进行的点赞操作
let likeInProgress = {}; 

// 缓存相关配置
const CACHE_KEY = 'COMMUNITY_POSTS_CACHE';
const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 缓存过期时间：5分钟

Page({
  data: {
    posts: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    usedCache: false // 标记当前显示的是否为缓存数据
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

    // 尝试从缓存加载帖子
    this.loadPostsWithCache();
  },

  onShow: function() {
    // 获取当前用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const currentLoginStatus = !!userInfo;
    
    // 是否需要刷新内容
    const needRefresh = getApp().globalData && getApp().globalData.forumNeedsRefresh;
    
    // 检查登录状态是否发生变化
    if (this.lastLoginStatus !== undefined && this.lastLoginStatus !== currentLoginStatus) {
      // 登录状态发生变化，强制刷新页面并清除缓存
      this.clearPostsCache();
      this.setData({
        page: 1,
        posts: [],
        hasMore: true
      });
      this.loadPostsWithCache();
    } else if (needRefresh) {
      // 需要刷新内容（例如发布新帖子后返回）
      getApp().globalData.forumNeedsRefresh = false;
      this.clearPostsCache(); // 清除缓存确保获取最新内容
      this.setData({
        page: 1
      });
      this.loadPosts(); // 直接从网络加载最新内容
    } else if (this.data.posts.length === 0) {
      // 没有数据时加载
      this.setData({
        page: 1,
        hasMore: true
      });
      this.loadPostsWithCache();
    } else if (this.data.usedCache) {
      // 当前显示的是缓存数据，检查是否需要刷新
      const cache = this.getPostsCache();
      if (!cache || this.isCacheExpired(cache)) {
        // 缓存过期，静默更新数据
        this.silentRefresh();
      }
    }
    
    // 记录当前登录状态，用于下次比较
    this.lastLoginStatus = currentLoginStatus;
    
    // 检查用户登录状态
    if (!currentLoginStatus) {
      // 用户未登录或已退出，重置所有帖子的点赞状态
      this.resetAllLikeStatus();
    }
    
    // 执行原有的onPageShow逻辑
    this.onPageShow();
  },

  // 获取帖子缓存
  getPostsCache: function() {
    try {
      return wx.getStorageSync(CACHE_KEY);
    } catch (e) {
      console.error('读取缓存失败', e);
      return null;
    }
  },

  // 设置帖子缓存
  setPostsCache: function(data) {
    try {
      const cacheData = {
        time: Date.now(),
        data: data,
        page: this.data.page,
        hasMore: this.data.hasMore
      };
      wx.setStorageSync(CACHE_KEY, cacheData);
    } catch (e) {
      console.error('写入缓存失败', e);
    }
  },

  // 清除帖子缓存
  clearPostsCache: function() {
    try {
      wx.removeStorageSync(CACHE_KEY);
    } catch (e) {
      console.error('清除缓存失败', e);
    }
  },

  // 检查缓存是否过期
  isCacheExpired: function(cache) {
    if (!cache || !cache.time) return true;
    return (Date.now() - cache.time) > CACHE_EXPIRE_TIME;
  },

  // 带缓存机制的加载帖子
  loadPostsWithCache: function() {
    // 如果正在加载，直接返回
    if (this.data.loading) return Promise.resolve();

    // 第一页时，尝试读取缓存
    if (this.data.page === 1) {
      const cache = this.getPostsCache();
      
      if (cache && !this.isCacheExpired(cache)) {
        // 缓存有效，直接使用缓存数据
        this.setData({
          posts: cache.data,
          hasMore: cache.hasMore,
          usedCache: true
        });
        
        // 检查点赞状态
        const userInfo = wx.getStorageSync('userInfo') || {};
        const myOpenid = userInfo.openid || userInfo._openid || '';
        if (myOpenid && cache.data.length > 0) {
          this.checkLikeStatus(cache.data, myOpenid);
        }
        
        // 返回成功
        return Promise.resolve();
      }
    }
    
    // 缓存无效或不是第一页，从网络加载
    return this.loadPosts();
  },

  // 静默刷新数据（不显示加载状态，在后台更新）
  silentRefresh: function() {
    // 重置页码，但不清空当前显示的内容
    const originalPage = this.data.page;
    
    this.setData({
      page: 1,
      loading: true,
      usedCache: false
    });
    
    wx.cloud.callFunction({
      name: 'forum',
      data: {
        type: 'getPosts',
        data: {
          page: 1,
          pageSize: this.data.pageSize
        }
      }
    }).then(res => {
      if (res.result.success) {
        // 获取当前用户的openid
        const userInfo = wx.getStorageSync('userInfo') || {};
        const myOpenid = userInfo.openid || userInfo._openid || '';
        
        // 格式化帖子数据
        const formattedPosts = res.result.data.map(post => {
          const postOpenid = post._openid || (post.userInfo && post.userInfo.openid);
          const isOwner = myOpenid && postOpenid === myOpenid;
          
          return {
            ...post,
            createTime: this.formatTime(post.createTime),
            likeCount: post.likes || 0,
            commentCount: post.comments || 0,
            isLiked: false,
            showFull: false,
            isOwner: isOwner
          }
        });
        
        // 更新数据和缓存
        this.setData({
          posts: formattedPosts,
          hasMore: res.result.data.length === this.data.pageSize
        });
        
        // 更新缓存
        this.setPostsCache(formattedPosts);
        
        // 检查点赞状态
        if (myOpenid && formattedPosts.length > 0) {
          this.checkLikeStatus(formattedPosts, myOpenid);
        }
      }
    }).catch(err => {
      console.error('静默刷新失败:', err);
    }).finally(() => {
      this.setData({ 
        loading: false
      });
    });
  },

  // 加载帖子列表
  loadPosts: function() {
    if (this.data.loading) return Promise.resolve();

    this.setData({ loading: true });
    wx.showLoading({
      title: '加载中...',
    });

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
        const userInfo = wx.getStorageSync('userInfo') || {};
        const myOpenid = userInfo.openid || userInfo._openid || '';
        
        // 格式化帖子数据
        const formattedPosts = res.result.data.map(post => {
          // 判断帖子是否为当前用户发布
          const postOpenid = post._openid || (post.userInfo && post.userInfo.openid);
          const isOwner = myOpenid && postOpenid === myOpenid;
          
          return {
            ...post,
            createTime: this.formatTime(post.createTime),
            likeCount: post.likes || 0,
            commentCount: post.comments || 0,
            isLiked: false, // 默认未点赞，实际状态将通过checkLikeStatus更新
            showFull: false, // 控制内容展开收起
            isOwner: isOwner // 添加判断是否为发布者
          }
        });
        
        const newList = this.data.page === 1 ? formattedPosts : [...this.data.posts, ...formattedPosts];
        
        this.setData({
          posts: newList,
          hasMore: res.result.data.length === this.data.pageSize,
          usedCache: false // 标记为非缓存数据
        });
        
        // 如果是第一页，更新缓存
        if (this.data.page === 1) {
          this.setPostsCache(newList);
        }
        
        // 检查每篇帖子的点赞状态
        if (myOpenid) {
          this.checkLikeStatus(newList, myOpenid);
        }
      } else {
        wx.showToast({
          title: res.result.message || '获取帖子失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.showToast({
        title: '获取帖子失败',
        icon: 'none'
      });
      console.error('获取帖子失败:', err);
    }).finally(() => {
      this.setData({ loading: false });
      wx.hideLoading();
    });
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
      });
      this.loadPosts(); // 加载更多时直接从网络加载，不使用缓存
    }
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    // 清除缓存，强制从网络重新加载
    this.clearPostsCache();
    
    // 设置页码为1
    this.setData({
      page: 1,
      hasMore: true,
      usedCache: false
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
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    
    // 防止重复点击：如果该帖子正在处理点赞操作，则忽略
    if (likeInProgress[id]) {
      return;
    }
    
    // 标记该帖子正在处理点赞
    likeInProgress[id] = true;
    
    // 检查用户是否登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      likeInProgress[id] = false; // 重置标记
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
    
    // 先在本地更新UI以提高响应速度
    const posts = this.data.posts;
    const index = posts.findIndex(post => post._id === id);
    
    if (index !== -1) {
      const isLiked = posts[index].isLiked;
      const likeCount = posts[index].likeCount || 0;
      
      // 更新本地状态
      posts[index].isLiked = !isLiked;
      posts[index].likeCount = isLiked ? likeCount - 1 : likeCount + 1;
      
      this.setData({ posts });
      
      // 更新缓存中的数据
      if (this.data.page === 1) {
        this.setPostsCache(posts);
      }
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
        });
        
        // 操作失败，恢复原状态
        if (index !== -1) {
          const isLiked = posts[index].isLiked;
          const likeCount = posts[index].likeCount || 0;
          
          posts[index].isLiked = !isLiked;
          posts[index].likeCount = isLiked ? likeCount - 1 : likeCount + 1;
          
          this.setData({ posts });
          
          // 更新缓存中的数据
          if (this.data.page === 1) {
            this.setPostsCache(posts);
          }
        }
      }
    }).catch(err => {
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
      
      // 操作失败，恢复原状态
      if (index !== -1) {
        const isLiked = posts[index].isLiked;
        const likeCount = posts[index].likeCount || 0;
        
        posts[index].isLiked = !isLiked;
        posts[index].likeCount = isLiked ? likeCount - 1 : likeCount + 1;
        
        this.setData({ posts });
        
        // 更新缓存中的数据
        if (this.data.page === 1) {
          this.setPostsCache(posts);
        }
      }
    }).finally(() => {
      // 操作完成，重置标记
      setTimeout(() => {
        likeInProgress[id] = false;
      }, 500); // 添加500ms延迟，防止过快点击
    });
  },

  // 切换帖子内容显示状态
  toggleContent: function(e) {
    // 从事件中获取帖子ID
    const id = e.currentTarget.dataset.id;
    
    if (!id) return;
    
    // 查找要切换的帖子
    const posts = this.data.posts;
    const index = posts.findIndex(post => post._id === id);
    
    if (index === -1) return;
    
    // 切换显示状态
    posts[index].showFull = !posts[index].showFull;
    
    // 更新数据
    this.setData({
      posts
    });
    
    // 如果在第一页，同时更新缓存
    if (this.data.page === 1) {
      this.setPostsCache(posts);
    }
  },

  // 重置所有帖子的点赞状态
  resetAllLikeStatus: function() {
    const posts = this.data.posts;
    if (!posts || posts.length === 0) return;
    
    const updatedPosts = posts.map(post => {
      return {
        ...post,
        isLiked: false
      };
    });
    
    this.setData({
      posts: updatedPosts
    });
  },

  // 删除帖子
  deletePost: function(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除该帖子吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
          })
          
          wx.cloud.callFunction({
            name: 'forum',
            data: {
              type: 'deletePost',
              data: { id }
            }
          }).then(res => {
            if (res.result.success) {
              // 删除成功，从本地列表中移除该帖子
              const posts = this.data.posts.filter(post => post._id !== id)
              this.setData({ posts })
              
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              })
            } else {
              wx.showToast({
                title: res.result.message || '删除失败',
                icon: 'none'
              })
            }
          }).catch(err => {
            console.error('删除帖子失败:', err)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }).finally(() => {
            wx.hideLoading()
          })
        }
      }
    })
  },

  // 处理分享
  onShareAppMessage: function(res) {
    if (res.from === 'button') {
      // 来自页面内转发按钮
      const id = res.target.dataset.id;
      const post = this.data.posts.find(p => p._id === id);
      
      if (post) {
        return {
          title: post.content.substring(0, 30) + (post.content.length > 30 ? '...' : ''),
          path: '/pages/community/detail/index?id=' + id,
          imageUrl: post.images && post.images.length > 0 ? post.images[0] : ''
        };
      }
    }
    
    // 默认分享
    return {
      title: '学习社区',
      path: '/pages/community/index'
    };
  },

  // 监听页面从详情页返回事件（比如查看帖子详情后返回列表）
  onPageShow: function() {
    // 检查是否需要刷新帖子列表（例如在详情页中进行了点赞或评论操作）
    if (getApp().globalData && getApp().globalData.forumNeedsRefresh) {
      // 重置标记
      getApp().globalData.forumNeedsRefresh = false;
      
      // 从缓存中检索第一页数据
      this.setData({
        page: 1
      });
      
      // 静默刷新数据，不打扰用户
      this.silentRefresh();
    }
  },

  // 监听前一个页面的关闭事件（比如发帖后返回）
  onUnload: function() {
    // 如果有待处理的点赞操作，清除它们
    likeInProgress = {};
  }
}) 