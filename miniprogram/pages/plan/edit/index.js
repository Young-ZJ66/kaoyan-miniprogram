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
    
    // 解析任务数据
    const tasksData = JSON.parse(decodeURIComponent(tasks))
    
    // 确保每个任务都有颜色属性，并转换颜色格式
    const tasksWithColors = tasksData.map(task => {
      if (!task.color) {
        return {
          ...task,
          color: 'rgba(7, 193, 96, 0.3)' // 默认绿色
        }
      }
      
      // 如果是十六进制颜色，转换为rgba格式
      if (task.color.startsWith('#')) {
        // 将十六进制转为rgba
        let color = task.color;
        switch(color) {
          case '#07c160': // 绿色
            color = 'rgba(7, 193, 96, 0.3)';
            break;
          case '#1890ff': // 蓝色
            color = 'rgba(24, 144, 255, 0.3)';
            break;
          case '#722ed1': // 紫色
            color = 'rgba(114, 46, 209, 0.3)';
            break;
          case '#ff9900': // 橙色
            color = 'rgba(255, 153, 0, 0.3)';
            break;
          case '#ff4d4f': // 红色
            color = 'rgba(255, 77, 79, 0.3)';
            break;
          case '#f56cb8': // 粉色
            color = 'rgba(245, 108, 184, 0.3)';
            break;
        }
        
        return {
          ...task,
          color: color
        };
      }
      
      return task;
    });
    
    this.setData({
      planId,
      planName: decodeURIComponent(planName),
      startDate,
      endDate,
      tasks: tasksWithColors
    })
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
      content: '',
      color: 'rgba(7, 193, 96, 0.3)'  // 默认颜色为半透明绿色
    })
    this.setData({ tasks })
  },

  // 选择任务颜色
  selectTaskColor: function(e) {
    const { index, color } = e.currentTarget.dataset
    const tasks = this.data.tasks
    
    // 根据选择的颜色，设置对应的半透明颜色
    let transparentColor
    
    switch(color) {
      case '#07c160': // 绿色
        transparentColor = 'rgba(7, 193, 96, 0.3)'
        break
      case '#1890ff': // 蓝色
        transparentColor = 'rgba(24, 144, 255, 0.3)'
        break
      case '#722ed1': // 紫色
        transparentColor = 'rgba(114, 46, 209, 0.3)'
        break
      case '#ff9900': // 橙色
        transparentColor = 'rgba(255, 153, 0, 0.3)'
        break
      case '#ff4d4f': // 红色
        transparentColor = 'rgba(255, 77, 79, 0.3)'
        break
      case '#f56cb8': // 粉色
        transparentColor = 'rgba(245, 108, 184, 0.3)'
        break
      default:
        transparentColor = 'rgba(7, 193, 96, 0.3)' // 默认为绿色
    }
    
    tasks[index].color = transparentColor
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

    // 调用云函数更新计划
    wx.cloud.callFunction({
      name: 'updatePlan',
      data: {
        planId: this.data.planId,
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
        title: '保存失败',
        icon: 'none'
      })
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

  // 保存计划
  saveChanges: function() {
    // 验证表单数据
    if (!this.validateForm()) {
      return;
    }

    const plan = this.getFormData();
    
    wx.showLoading({
      title: '保存中...'
    });

    wx.cloud.callFunction({
      name: 'updatePlan',
      data: {
        planId: this.data.planId,
        ...plan
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        // 延迟返回上一页，让用户看到成功提示
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    });
  },

  // 保存计划表单（去除旧函数，使用新函数）
  savePlan: function() {
    // 使用saveChanges函数
    this.saveChanges();
  },
}) 