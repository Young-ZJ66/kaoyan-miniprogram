const app = getApp()

Page({
  data: {
    newsDetail: null
  },

  onLoad: function(options) {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-9gbyqyqyb5f2cb69',
        traceUser: true,
      })
    }

    if (options.id) {
      this.loadNewsDetail(options.id)
    }
  },

  // 加载资讯详情
  loadNewsDetail: function(id) {
    wx.showLoading({
      title: '加载中...',
    })

    console.log('开始加载资讯详情，ID:', id)

    wx.cloud.callFunction({
      name: 'news',
      data: {
        type: 'getDetail',
        data: { id }
      }
    }).then(res => {
      console.log('获取资讯详情响应:', res)
      if (res.result.success) {
        // 处理换行符
        const newsDetail = res.result.data;
        if (newsDetail.content) {
          // 直接处理字符串中的\n
          const paragraphs = newsDetail.content.split('\\n');
          const nodes = paragraphs.map(p => ({
            name: 'div',
            children: [{
              type: 'text',
              text: p
            }]
          }));
          newsDetail.content = nodes;
          console.log('处理后的内容:', newsDetail.content);
        }
        this.setData({
          newsDetail: newsDetail
        })
      } else {
        console.error('获取资讯详情失败:', res.result.message)
        wx.showToast({
          title: res.result.message || '获取资讯失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('调用云函数失败：', err)
      wx.showToast({
        title: '获取资讯失败',
        icon: 'none'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  }
}) 