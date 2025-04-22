const app = getApp()

Page({
  data: {
    newsDetail: null,
    // 添加分类标签的英文到中文的映射
    typeMap: {
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

  onLoad: function(options) {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud-young-2gcblx0nb59a75fc',
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

    

    wx.cloud.callFunction({
      name: 'news',
      data: {
        type: 'getDetail',
        data: { id }
      }
    }).then(res => {
      
      if (res.result.success) {
        // 处理换行符和时间格式
        const newsDetail = res.result.data;
        if (newsDetail.content) {
          // 确保内容是字符串格式
          if (typeof newsDetail.content !== 'string') {
            newsDetail.content = String(newsDetail.content);
          }
          
          // wxParse 组件会自动处理 HTML 内容，不需要做特殊处理
          // 可以在这里对内容做一些预处理，比如清理一些无效标签等
        }
        // 处理时间格式
        newsDetail.createTime = this.formatDate(newsDetail.createdAt);
        
        // 将英文分类映射为中文
        if (newsDetail.type && this.data.typeMap[newsDetail.type]) {
          newsDetail.typeText = this.data.typeMap[newsDetail.type];
        } else {
          newsDetail.typeText = newsDetail.type || '';
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
  },
  
  // 处理图片点击预览
  handleImgTap(e) {
    const { src } = e.detail;
    if (src) {
      wx.previewImage({
        current: src,
        urls: [src]
      });
    }
  },
  
  // 处理链接点击跳转
  handleLinkTap(e) {
    const { href } = e.detail;
    if (href) {
      // 判断是内部链接还是外部链接
      if (href.includes('http://') || href.includes('https://')) {
        // 外部链接，打开webview页面
        wx.navigateTo({
          url: `/components/wxParse/webviewPage/webviewPage?src=${encodeURIComponent(href)}`
        });
      } else {
        // 内部链接，按照小程序路由跳转
        wx.navigateTo({
          url: href
        });
      }
    }
  }
}) 