Page({
  // ...
  data: {
    chatMode: "bot", // bot 表示使用agent，model 表示使用大模型，两种选一种配置即可
    showBotAvatar: true, // 是否在对话框左侧显示头像
    agentConfig: {
      botId: "bot-3e2e4259", // agent id,
      allowWebSearch: true, // 允许客户端选择启用联网搜索
      allowUploadFile: false, // 允许上传文件
      allowPullRefresh: true, // 允许下拉刷新
      allowUploadImage: false, // 允许上传图片
    },
    modelConfig: {
      modelProvider: "hunyuan-open", // 大模型服务厂商
      quickResponseModel: "hunyuan-lite", // 大模型名称
      logo: "", // model 头像
      welcomeMsg: "欢迎语", // model 欢迎语
    },
  }
  // ...
})