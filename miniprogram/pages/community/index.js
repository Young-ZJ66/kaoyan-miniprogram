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
        env: 'cloud-young-2gcblx0nb59a75fc',
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
          
          // 检查内容是否需要展开按钮（超过3行或超过100字符）
          const isOverflow = post.content && (
            post.content.length > 100 || 
            (post.content.match(/\n/g) || []).length >= 3 ||
            post.content.split('\n').some(line => line.length > 30)  // 检查单行是否过长
          );
          
          return {
            ...post,
            formattedTime: this.formatTime(post.createdAt),
            likeCount: post.likes || 0,
            commentCount: post.comments || 0,
            isLiked: false,
            showFull: false,
            isOverflow: isOverflow,
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

  // 判断内容是否超过3行
  isContentOverflow: function(content) {
    if (!content) return false;
    // 将内容按换行符分割成数组
    const lines = content.split('\n').filter(line => line.trim() !== '');
    // 如果行数大于3，或者最后一行不为空且总行数等于3，则认为需要展开
    return lines.length > 3 || (lines.length === 3 && content.trim().endsWith('\n'));
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
          const postOpenid = post._openid || (post.userInfo && post.userInfo.openid);
          const isOwner = myOpenid && postOpenid === myOpenid;
          
          // 检查内容是否需要展开按钮（超过3行或超过100字符）
          const isOverflow = post.content && (
            post.content.length > 100 || 
            (post.content.match(/\n/g) || []).length >= 3 ||
            post.content.split('\n').some(line => line.length > 30)  // 检查单行是否过长
          );
          
          return {
            ...post,
            formattedTime: this.formatTime(post.createdAt),
            likeCount: post.likes || 0,
            commentCount: post.comments || 0,
            isLiked: false,
            showFull: false,
            isOverflow: isOverflow,
            isOwner: isOwner
          }
        });
        
        const newList = this.data.page === 1 ? formattedPosts : [...this.data.posts, ...formattedPosts];
        
        this.setData({
          posts: newList,
          hasMore: res.result.data.length === this.data.pageSize,
          usedCache: false
        });
        
        if (this.data.page === 1) {
          this.setPostsCache(newList);
        }
        
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

  goToChatAI: function() {
    // 检查用户是否登录
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
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
      url: '/pages/community/chatAI/index'
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
    // 检查是否应该阻止事件冒泡
    if (e.currentTarget.dataset.stopBubble) {
      return
    }
    
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/community/detail/index?id=${id}`
    })
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
        type: 'toggleLike',
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
    
    // 设置阻止事件冒泡标志
    e.currentTarget.dataset.stopBubble = true;
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
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条帖子吗？',
      success: res => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...'
          });
          
          wx.cloud.callFunction({
            name: 'forum',
            data: {
              type: 'deletePost',
              data: {
                id: id  // 修改参数名，与云函数保持一致
              }
            }
          }).then(res => {
            wx.hideLoading();
            if (res.result.success) {
              // 更新列表，移除被删除的帖子
              const posts = this.data.posts.filter(post => post._id !== id);
              this.setData({
                posts: posts
              });
              
              // 更新缓存
              if (this.data.page === 1) {
                this.setPostsCache(posts);
              }
              
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
            } else {
              wx.showToast({
                title: res.result.message || '删除失败',
                icon: 'error'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            });
          });
        }
      }
    });
    
    // 防止事件冒泡
    e.currentTarget.dataset.stopBubble = true;
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