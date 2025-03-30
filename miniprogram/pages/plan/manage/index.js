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
    wx.showLoading({
      title: '加载中...',
    })

    wx.cloud.callFunction({
      name: 'getPlans'
    }).then(res => {
      if (res.result.success) {
        const plans = res.result.data || []
        // 计算每个计划的进度并格式化时间
        const plansWithProgress = plans.map(plan => {
          let totalTasks = 0
          let completedTasks = 0

          if (plan && Array.isArray(plan.tasks)) {
            plan.tasks.forEach(task => {
              if (task.tasks && Array.isArray(task.tasks)) {
                totalTasks += task.tasks.length
                completedTasks += task.tasks.filter(t => t.completed).length
              }
            })
          }

          const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

          return {
            ...plan,
            progress,
            createTime: this.formatTime(plan.createTime)
          }
        })

        this.setData({
          plans: plansWithProgress
        })
      } else {
        wx.showToast({
          title: '获取计划失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('获取计划失败：', err)
      wx.showToast({
        title: '获取计划失败',
        icon: 'none'
      })
    }).finally(() => {
      wx.hideLoading()
    })
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

  // 跳转到编辑计划页面
  goToEditPlan: function(e) {
    const plan = e.currentTarget.dataset.plan
    // 将计划数据转换为编辑页面需要的格式
    const tasks = plan.tasks[0].tasks.map(task => ({
      content: task.content
    }))
    
    wx.navigateTo({
      url: `/pages/plan/edit/index?planId=${plan._id}&planName=${encodeURIComponent(plan.planName)}&startDate=${plan.startDate}&endDate=${plan.endDate}&tasks=${encodeURIComponent(JSON.stringify(tasks))}`
    })
  }
}) 