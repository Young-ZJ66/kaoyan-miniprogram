const app = getApp()

Page({
  data: {
    newsList: [],
    resourcesList: [],
    searchKey: '',
    page: 1,
    pageSize: 5,
    hasMore: true,
    currentCategory: 'all',
    categoryMap: {
      'politics': '政治',
      'english': '英语',
      'math': '数学',
      'major': '专业课'
    },
    loading: false
  },

  onLoad: function() {
    this.initCloud()
    this.loadNewsList()
    this.loadResources()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      });
    }
  },

  // 初始化云开发
  initCloud: function() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud-young-2gcblx0nb59a75fc',
        traceUser: true,
      })
    }
  },

  // 加载资讯列表
  loadNewsList: function() {
    wx.showLoading({
      title: '加载中...',
    })

    wx.cloud.callFunction({
      name: 'news',
      data: {
        type: 'getList',
        data: {
          page: 1,
          pageSize: 3  // 只显示3条
        }
      }
    }).then(res => {
      if (res.result.success) {
        this.setData({
          newsList: res.result.data
        })
      } else {
        wx.showToast({
          title: '获取资讯失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('获取资讯失败：', err)
      wx.showToast({
        title: '获取资讯失败',
        icon: 'none'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  // 格式化时间
  formatTime: function(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hour = d.getHours().toString().padStart(2, '0');
    const minute = d.getMinutes().toString().padStart(2, '0');
    const second = d.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  },

  // 加载资料列表
  loadResources: function() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    wx.showLoading({
      title: '加载中...',
    });

    wx.cloud.callFunction({
      name: 'resources',
      data: {
        type: 'getList',
        data: {
          category: this.data.currentCategory,
          keyword: this.data.searchKey,
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      }
    }).then(res => {
      if (res.result.success) {
        // 处理时间格式
        const resourcesList = res.result.data.map(item => ({
          ...item,
          createdAt: this.formatTime(item.createdAt)
        }));

        this.setData({
          resourcesList: resourcesList,
          hasMore: res.result.hasMore,
          total: res.result.total
        });

        // 如果当前页没有数据且不是第一页，自动回到上一页
        if (resourcesList.length === 0 && this.data.page > 1) {
          this.prevPage();
        }
      } else {
        wx.showToast({
          title: '获取资料失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('获取资料失败：', err);
      wx.showToast({
        title: '获取资料失败',
        icon: 'none'
      });
    }).finally(() => {
      wx.hideLoading();
      this.setData({ loading: false });
    });
  },

  // 切换分类
  switchCategory: function(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      currentCategory: category,
      page: 1,
      searchKey: '',
      resourcesList: []
    }, () => {
      this.loadResources();
    });
  },

  // 搜索输入
  onSearchInput: function(e) {
    this.setData({
      searchKey: e.detail.value,
      page: 1,
      resourcesList: []
    }, () => {
      this.loadResources();
    });
  },

  // 跳转到资讯详情
  goToNewsDetail: function(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/index/news/detail/index?id=${id}`
    })
  },

  // 跳转到资料详情
  goToResourceDetail: function(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/resource/detail/index?id=${id}`
    })
  },

  // 跳转到上传页面
  goToUpload: function() {
    wx.navigateTo({
      url: '/pages/resource/upload/index'
    })
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.setData({
      searchKey: '',
      page: 1,
      resourcesList: []
    }, () => {
      this.loadNewsList();
      this.loadResources();
      wx.stopPullDownRefresh();
    });
  },

  copyCode(e) {
    const code = e.target?.dataset?.code || '';
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({
          title: '已复制',
        })
      },
      fail: (err) => {
        console.error('复制失败-----', err);
      }
    })
  },

  discoverCloud() {
    wx.switchTab({
      url: '/pages/examples/index',
    })
  },

  gotoGoodsListPage() {
    wx.navigateTo({
      url: '/pages/goods-list/index',
    })
  },

  // 点击资讯项
  onNewsTap: function(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/index/news/detail/index?id=${id}`
    })
  },

  // 跳转到资讯列表页
  goToNewsList: function() {
    wx.navigateTo({
      url: '/pages/index/news/list/index'
    })
  },

  // 上一页
  prevPage: function() {
    if (this.data.page > 1) {
      this.setData({
        page: this.data.page - 1,
        resourcesList: []
      }, () => {
        this.loadResources();
      });
    }
  },

  // 下一页
  nextPage: function() {
    if (this.data.hasMore) {
      this.setData({
        page: this.data.page + 1,
        resourcesList: []
      }, () => {
        this.loadResources();
      });
    }
  },
});
