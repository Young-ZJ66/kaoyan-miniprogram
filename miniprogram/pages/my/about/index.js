Page({
  data: {
    version: '1.0.5',
    buildDate: '2025-03-25'
  },

  onLoad: function() {
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: '关于我们'
    });
  },

  // 预览二维码图片
  previewQRCode: function() {
    wx.previewImage({
      urls: ['/images/QR-code.png'],
      current: '/images/QR-code.png'
    });
  },

  // 分享功能
  onShareAppMessage: function() {
    return {
      title: '考研生 - 您的考研伙伴',
      path: '/pages/index/index',
      imageUrl: '/images/share-img.jpg'
    };
  }
}) 