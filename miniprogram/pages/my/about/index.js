Page({
  data: {
    version: '1.0.0',
    buildDate: '2024-06-25'
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