const app = getApp()

Page({
  data: {
    startDate: '',
    endDate: '',
    tasks: [],
    planName: '',
  },

  onLoad: function() {
    // 设置默认日期范围（今天到3天后）
    const today = new Date()
    const threeDaysLater = new Date()
    threeDaysLater.setDate(today.getDate() + 2)

    this.setData({
      startDate: this.formatDate(today),
      endDate: this.formatDate(threeDaysLater)
    })

    // 添加一个默认任务
    this.addTask()
  },

  // 格式化日期
  formatDate: function(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 将日期转换为时间戳（当天0点）
  dateToTimestamp: function(dateStr) {
    const date = new Date(dateStr + 'T00:00:00.000Z')
    return date.getTime()
  },

  // 开始日期变化
  onStartDateChange: function(e) {
    const startDate = e.detail.value
    const endDate = this.data.endDate

    // 确保结束日期不早于开始日期
    if (endDate < startDate) {
      this.setData({
        startDate,
        endDate: startDate
      })
    } else {
      this.setData({ startDate })
    }
  },

  // 结束日期变化
  onEndDateChange: function(e) {
    const endDate = e.detail.value
    const startDate = this.data.startDate

    // 确保结束日期不早于开始日期
    if (endDate < startDate) {
      wx.showToast({
        title: '结束日期不能早于开始日期',
        icon: 'none'
      })
      return
    }

    this.setData({ endDate })
  },

  // 添加任务
  addTask: function() {
    const tasks = this.data.tasks
    tasks.push({
      content: ''
    })
    this.setData({ tasks })
  },

  // 删除任务
  deleteTask: function(e) {
    const index = e.currentTarget.dataset.index
    const tasks = this.data.tasks
    tasks.splice(index, 1)
    this.setData({ tasks })
  },

  // 任务内容输入
  onTaskInput: function(e) {
    const index = e.currentTarget.dataset.index
    const content = e.detail.value
    const tasks = this.data.tasks
    tasks[index].content = content
    this.setData({ tasks })
  },

  // 处理计划名称输入
  onPlanNameInput: function(e) {
    this.setData({
      planName: e.detail.value
    })
  },

  // 提交计划
  onSubmit: function() {
    // 验证计划名称
    if (!this.data.planName.trim()) {
      wx.showToast({
        title: '请输入计划名称',
        icon: 'none'
      })
      return
    }

    // 验证日期
    if (!this.data.startDate || !this.data.endDate) {
      wx.showToast({
        title: '请选择计划时间',
        icon: 'none'
      })
      return
    }

    // 验证任务
    if (this.data.tasks.length === 0) {
      wx.showToast({
        title: '请添加任务',
        icon: 'none'
      })
      return
    }

    // 检查任务内容是否为空
    for (let i = 0; i < this.data.tasks.length; i++) {
      if (!this.data.tasks[i].content.trim()) {
        wx.showToast({
          title: `第${i+1}个任务内容不能为空`,
          icon: 'none'
        })
        return
      }
    }

    wx.showLoading({
      title: '保存中...',
    })

    // 转换日期为时间戳
    const startTimestamp = this.dateToTimestamp(this.data.startDate)
    const endTimestamp = this.dateToTimestamp(this.data.endDate)

    // 调用云函数保存计划
    wx.cloud.callFunction({
      name: 'createPlan',
      data: {
        startDate: startTimestamp,
        endDate: endTimestamp,
        tasks: this.data.tasks,
        planName: this.data.planName.trim()
      }
    }).then(res => {
      wx.hideLoading()
      
      if (res.result.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })
        // 返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({
          title: res.result.message || '保存失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      wx.hideLoading()
      
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      })
    })
  },

  // 保存计划
  saveChanges: function() {
    // 使用onSubmit函数
    this.onSubmit();
  },

  // 保存计划表单
  savePlan: function() {
    // 使用onSubmit函数
    this.onSubmit();
  },
}) 