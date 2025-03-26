const app = getApp()

Page({
  data: {
    newsList: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false
  },

  onLoad: function() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-9gbyqyqyb5f2cb69',
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
          pageSize: this.data.pageSize
        }
      }
    }).then(res => {
      if (res.result.success) {
        const newList = this.data.page === 1 ? res.result.data : [...this.data.newsList, ...res.result.data]
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
      url: `/pages/news/detail/index?id=${id}`
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