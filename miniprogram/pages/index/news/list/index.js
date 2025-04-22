const app = getApp()

Page({
  data: {
    newsList: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    currentType: 'all',  // 添加当前选中分类
    // 添加分类标签的英文到中文的映射
    typeMap: {
      'all': '全部',
      'policy': '政策',
      'admissions': '择校',
      'prep': '备考',
      'process': '流程',
      'data': '数据',
      'tools': '工具',
      'mindset': '心理',
      'tracks': '专项'
    }
  },

  // 格式化时间
  formatDate: function(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hour = d.getHours().toString().padStart(2, '0');
    const minute = d.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  onLoad: function() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud-young-2gcblx0nb59a75fc',
        traceUser: true,
      })
    }

    this.loadNewsList()
  },

  // 加载资讯列表
  loadNewsList: function() {
    if (this.data.loading) return Promise.resolve()

    this.setData({ loading: true })
    wx.showLoading({
      title: '加载中...',
    })

    return wx.cloud.callFunction({
      name: 'news',
      data: {
        type: 'getList',
        data: {
          page: this.data.page,
          pageSize: this.data.pageSize,
          newsType: this.data.currentType !== 'all' ? this.data.currentType : ''
        }
      }
    }).then(res => {
      if (res.result.success) {
        // 处理时间格式并将英文类型映射为中文
        const processedData = res.result.data.map(item => {
          // 获取对应的中文类型名称，如果不存在则保留原值
          const typeInChinese = this.data.typeMap[item.type] || item.type;
          
          return {
            ...item,
            createTime: this.formatDate(item.createdAt),
            // 保留原始type值，但添加一个显示用的中文类型名称
            typeText: typeInChinese
          };
        });
        
        const newList = this.data.page === 1 ? processedData : [...this.data.newsList, ...processedData]
        this.setData({
          newsList: newList,
          hasMore: res.result.data.length === this.data.pageSize
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
      this.setData({ loading: false })
      wx.hideLoading()
    })
  },

  // 切换分类
  switchType: function(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.currentType) return;
    
    this.setData({
      currentType: type,
      page: 1,
      newsList: []
    }, () => {
      this.loadNewsList();
    });
  },

  // 加载更多
  loadMore: function() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({
        page: this.data.page + 1
      })
      this.loadNewsList()
    }
  },

  // 跳转到资讯详情
  goToNewsDetail: function(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/index/news/detail/index?id=${id}`
    })
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.setData({
      page: 1,
      hasMore: true
    })
    this.loadNewsList().then(() => {
      wx.stopPullDownRefresh()
    }).catch(() => {
      wx.stopPullDownRefresh()
    })
  }
}) 