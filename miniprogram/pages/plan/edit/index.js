const app = getApp()

Page({
  data: {
    planId: '',
    startDate: '',
    endDate: '',
    tasks: [],
    planName: '',
  },

  onLoad: function(options) {
    // 解析传递过来的参数
    const { planId, planName, startDate, endDate, tasks } = options
    
    this.setData({
      planId,
      planName: decodeURIComponent(planName),
      startDate,
      endDate,
      tasks: JSON.parse(decodeURIComponent(tasks))
    })
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

  // 提交修改
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

    wx.showLoading({
      title: '保存中...',
    })

    // 调用云函数更新计划
    wx.cloud.callFunction({
      name: 'updatePlan',
      data: {
        planId: this.data.planId,
        startDate: this.data.startDate,
        endDate: this.data.endDate,
        tasks: this.data.tasks,
        planName: this.data.planName.trim()
      }
    }).then(res => {
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
      console.error('保存计划失败：', err)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  // 删除计划
  deletePlan() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个计划吗？删除后无法恢复。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...',
          });
          
          wx.cloud.callFunction({
            name: 'deletePlan',
            data: {
              planId: this.data.planId
            },
            success: (res) => {
              wx.hideLoading();
              wx.showToast({
                title: '删除成功',
                icon: 'success',
                duration: 2000,
                success: () => {
                  setTimeout(() => {
                    wx.navigateBack();
                  }, 2000);
                }
              });
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showToast({
                title: '删除失败',
                icon: 'error'
              });
            }
          });
        }
      }
    });
  },
}) 