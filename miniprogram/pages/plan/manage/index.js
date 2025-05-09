const app = getApp()

Page({
  data: {
    plans: []
  },

  onLoad: function() {
    this.loadPlans()
  },

  onShow: function() {
    // 每次显示页面时重新加载计划列表
    this.loadPlans()
  },

  // 加载计划列表
  loadPlans: function() {
    this.setData({ loading: true });
    
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'getPlans'
    }).then(res => {
      wx.hideLoading();
      
      if (res.result.success) {
        const plans = res.result.data || [];
        
        // 处理计划数据，计算进度
        const processedPlans = plans.map(plan => {
          // 计算计划进度
          let totalTasks = 0;
          let completedTasks = 0;
          
          if (plan.tasks && plan.tasks.length > 0) {
            plan.tasks.forEach(dateTask => {
              if (dateTask.tasks && dateTask.tasks.length > 0) {
                totalTasks += dateTask.tasks.length;
                completedTasks += dateTask.tasks.filter(task => task.completed).length;
              }
            });
          }
          
          const progress = totalTasks > 0 ? Math.floor((completedTasks / totalTasks) * 100) : 0;
          
          // 处理createdAt字段，格式化时间
          const createdAt = plan.createdAt ? this.formatTime(plan.createdAt) : (plan.createTime ? this.formatTime(plan.createTime) : '未知');
          
          // 格式化开始日期和结束日期
          const startDate = this.formatDateStr(plan.startDate);
          const endDate = this.formatDateStr(plan.endDate);
          
          return {
            ...plan,
            progress,
            createdAt,
            startDate,
            endDate
          };
        });
        
        this.setData({
          plans: processedPlans,
          loading: false
        });
      } else {
        this.setData({ loading: false });
        wx.showToast({
          title: '获取计划失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      this.setData({ loading: false });
      wx.showToast({
        title: '获取计划失败',
        icon: 'none'
      });
    });
  },

  // 格式化时间
  formatTime: function(timestamp) {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  // 格式化日期为YYYY-MM-DD字符串
  formatDateStr: function(dateObj) {
    if (!dateObj) return '';
    
    // 处理从云数据库返回的日期对象
    const date = new Date(dateObj);
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return dateObj; // 如果无法解析为日期对象，则返回原始值
    }
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 跳转到编辑计划页面
  goToEditPlan: function(e) {
    const plan = e.currentTarget.dataset.plan
    // 将计划数据转换为编辑页面需要的格式
    const tasks = plan.tasks[0].tasks.map(task => ({
      content: task.content,
      color: task.color || 'rgba(7, 193, 96, 0.3)' // 保留颜色信息或设置默认值
    }))
    
    wx.navigateTo({
      url: `/pages/plan/edit/index?planId=${plan._id}&planName=${encodeURIComponent(plan.planName)}&startDate=${plan.startDate}&endDate=${plan.endDate}&tasks=${encodeURIComponent(JSON.stringify(tasks))}`
    })
  }
}) 