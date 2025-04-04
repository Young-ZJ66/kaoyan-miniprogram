const app = getApp()

Page({
  data: {
    totalProgress: 0,
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    days: [],
    selectedDate: null,
    selectedDateTasks: [],
    currentPlan: null,
    plans: [],  // 存储所有计划
    buttonX: 0,  // 初始值为0，将在onLoad中设置
    buttonY: 0,  // 初始值为0，将在onLoad中设置
    isLoggedIn: false,  // 添加登录状态标记
    isMenuOpen: false,  // 控制按钮列表的显示状态
    isMenuUp: false  // 添加控制菜单展开方向的状态
  },

  onLoad: function() {
    if (!wx.cloud) {
      // 请使用 2.2.3 或以上的基础库以使用云能力
    } else {
      wx.cloud.init({
        env: 'cloud1-9gbyqyqyb5f2cb69',
        traceUser: true,
      })
    }

    // 设置按钮位置
    this.initButtonPosition()

    // 初始化时只检查登录状态，不显示提示
    this.checkLoginStatus(false)
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      })
    }
    
    // 页面显示时检查登录状态并显示提示
    this.checkLoginStatus(true)
    
    // 避免重复设置按钮位置，防止闪烁
    // 不在onShow中重新设置按钮位置，让initButtonPosition函数只在onLoad时初始化一次
  },

  // 检查登录状态
  checkLoginStatus: function(showTip = true) {
    const userInfo = wx.getStorageSync('userInfo')
    const isLoggedIn = !!userInfo

    this.setData({ isLoggedIn })

    if (isLoggedIn) {
      this.loadCurrentPlan()
    } else {
      // 清除计划数据
      this.setData({
        plans: [],
        currentPlan: null,
        selectedDateTasks: [],
        totalProgress: 0
      })
      // 显示登录提示
      if (showTip) {
        wx.showModal({
          title: '提示',
          content: '登录后可以制定和管理您的计划',
          confirmText: '去登录',
          cancelText: '暂不登录',
          success: (res) => {
            if (res.confirm) {
              this.goToLogin()
            }
          }
        })
      }
    }
    this.generateCalendar()
  },

  // 跳转到登录页面
  goToLogin: function() {
    wx.switchTab({
      url: '/pages/my/index'
    })
  },

  // 加载当前计划
  loadCurrentPlan: function() {
    wx.showLoading({
      title: '加载中...',
    })

    wx.cloud.callFunction({
      name: 'getPlans'
    }).then(res => {
      if (res.result.success) {
        const plans = res.result.data || []
        
        // 先设置计划数据
        this.setData({
          plans: plans,
          currentPlan: plans[0]
        }, () => {
          // 在计划数据设置完成后，再执行其他操作
          this.calculateProgress()
          this.generateCalendar()
          
          // 如果没有选中日期，自动选中当前日期
          if (!this.data.selectedDate) {
            const today = this.formatDate(new Date())
            this.setData({ selectedDate: today }, () => {
              this.loadDateTasks(today)
            })
          } else {
            // 如果已有选中日期，重新加载该日期的任务
            this.loadDateTasks(this.data.selectedDate)
          }
        })
      }
    }).catch(err => {
      wx.showToast({
        title: '获取计划失败',
        icon: 'none'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  // 计算总进度
  calculateProgress: function() {
    if (!this.data.plans || this.data.plans.length === 0) {
      this.setData({ totalProgress: 0 })
      return
    }

    let totalTasks = 0
    let completedTasks = 0

    this.data.plans.forEach(plan => {
      if (plan && Array.isArray(plan.tasks)) {
        plan.tasks.forEach(task => {
          if (task.tasks && Array.isArray(task.tasks)) {
            totalTasks += task.tasks.length
            completedTasks += task.tasks.filter(t => t.completed).length
          }
        })
      }
    })

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    this.setData({ totalProgress: progress })
  },

  // 生成日历数据
  generateCalendar: function() {
    const { currentYear, currentMonth } = this.data
    const firstDay = new Date(currentYear, currentMonth - 1, 1)
    const lastDay = new Date(currentYear, currentMonth, 0)
    const days = []
    
    // 填充当前月的空白日期（占位）
    const firstDayWeek = firstDay.getDay()
    for (let i = 0; i < firstDayWeek; i++) {
      days.push({
        date: '',
        day: '',
        isCurrentMonth: false,
        isToday: false,
        isPast: false,
        hasUnfinished: false,
        isCompleted: false,
        isSelected: false
      })
    }
    
    // 填充当前月的日期
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(currentYear, currentMonth - 1, i)
      const dateStr = this.formatDate(date)
      days.push({
        date: dateStr,
        day: i,
        isCurrentMonth: true,
        isToday: this.isToday(date),
        isPast: this.isPastDate(date),
        hasUnfinished: this.hasUnfinished(date),
        isCompleted: this.isCompleted(date),
        isSelected: dateStr === this.data.selectedDate
      })
    }
    
    // 填充当前月末尾的空白日期（占位）
    const lastDayWeek = lastDay.getDay()
    const remainingDays = 6 - lastDayWeek
    for (let i = 0; i < remainingDays; i++) {
      days.push({
        date: '',
        day: '',
        isCurrentMonth: false,
        isToday: false,
        isPast: false,
        hasUnfinished: false,
        isCompleted: false,
        isSelected: false
      })
    }
    
    this.setData({ days })
  },

  // 格式化日期
  formatDate: function(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 判断是否是今天
  isToday: function(date) {
    const today = new Date()
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate()
  },

  // 判断是否是过去的日期
  isPastDate: function(date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  },

  // 判断日期是否在任意计划内
  isInPlan: function(date) {
    if (!this.data.plans.length) return false
    const dateStr = this.formatDate(date)
    return this.data.plans.some(plan => 
      dateStr >= plan.startDate && dateStr <= plan.endDate
    )
  },

  // 判断日期是否完成所有任务
  isCompleted: function(date) {
    if (!this.data.plans.length) return false
    const dateStr = this.formatDate(date)
    
    // 检查所有计划中该日期的任务
    let hasTasks = false
    const allCompleted = this.data.plans.every(plan => {
      if (!plan || !Array.isArray(plan.tasks)) return true
      
      const dayTasks = plan.tasks.filter(task => task.date === dateStr)
      if (dayTasks.length > 0) {
        hasTasks = true
        // 检查该日期的所有任务是否都已完成
        return dayTasks[0].tasks.every(task => task.completed)
      }
      return true
    })
    
    // 只有当有任务且全部完成时才返回 true
    return hasTasks && allCompleted
  },

  // 判断日期是否有未完成任务
  hasUnfinished: function(date) {
    if (!this.data.plans.length) return false
    const dateStr = this.formatDate(date)
    const today = new Date()
    // 只检查当前日期之前的任务
    if (date > today) return false
    
    // 检查所有计划中该日期的未完成任务
    return this.data.plans.some(plan => {
      // 确保 plan 和 plan.tasks 存在
      if (!plan || !Array.isArray(plan.tasks)) return false
      
      const dayTasks = plan.tasks.filter(task => task.date === dateStr)
      if (dayTasks.length > 0) {
        // 检查该日期的所有任务是否都已完成
        return dayTasks[0].tasks.some(task => !task.completed)
      }
      return false
    })
  },

  // 切换月份
  prevMonth: function() {
    let { currentYear, currentMonth } = this.data
    if (currentMonth === 1) {
      currentYear--
      currentMonth = 12
    } else {
      currentMonth--
    }
    this.setData({ currentYear, currentMonth })
    this.generateCalendar()
  },

  nextMonth: function() {
    let { currentYear, currentMonth } = this.data
    if (currentMonth === 12) {
      currentYear++
      currentMonth = 1
    } else {
      currentMonth++
    }
    this.setData({ currentYear, currentMonth })
    this.generateCalendar()
  },

  // 选择日期
  selectDate: function(e) {
    const date = e.currentTarget.dataset.date
    if (!date) return  // 如果是空白占位日期，不处理

    this.setData({ selectedDate: date }, () => {
      this.generateCalendar()  // 重新生成日历以更新选中状态
      this.loadDateTasks(date)
    })
  },

  // 加载日期任务
  loadDateTasks: function(date) {
    // 如果未登录或没有计划数据，清空任务列表
    if (!this.data.isLoggedIn || !this.data.plans || !this.data.plans.length) {
      this.setData({
        selectedDateTasks: []
      })
      return
    }

    // 获取所有计划中该日期的任务
    let allTasks = []
    this.data.plans.forEach(plan => {
      // 确保 plan 和 plan.tasks 存在，且日期在计划范围内
      if (plan && Array.isArray(plan.tasks) && 
          date >= plan.startDate && date <= plan.endDate) {
        const tasks = plan.tasks.filter(task => task.date === date)
        if (tasks.length > 0) {
          // 将任务数组展开到 allTasks 中
          const tasksWithMeta = tasks[0].tasks.map((task, index) => ({
            ...task,
            _id: `${plan._id}_${index}`,  // 生成唯一ID
            planId: plan._id,
            taskIndex: index
          }))
          allTasks = allTasks.concat(tasksWithMeta)
        }
      }
    })

    // 判断所选日期是否是今天或过去的日期
    const selectedDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 使用getTime()比较日期，确保精确比较
    const isToday = selectedDate.getTime() === today.getTime();
    const isPast = selectedDate.getTime() < today.getTime();
    const isPastOrToday = isPast || isToday;

    // 处理任务列表，为今天和之前的日期添加勾选框
    const processedTasks = allTasks.map(task => ({
      ...task,
      canCheck: isPastOrToday
    }))

    this.setData({
      selectedDateTasks: processedTasks
    })
  },

  // 切换任务状态
  toggleTask: function(e) {
    const taskId = e.currentTarget.dataset.taskId
    const [planId, taskIndex] = taskId.split('_')
    const task = this.data.selectedDateTasks.find(t => t._id === taskId)
    if (!task) return

    wx.showLoading({
      title: '更新中...',
    })

    // 确保 planId 是字符串类型，taskIndex 是数字类型
    const stringPlanId = String(planId)
    const numberTaskIndex = Number(taskIndex)

    wx.cloud.callFunction({
      name: 'toggleTask',
      data: {
        planId: stringPlanId,
        date: this.data.selectedDate,
        taskIndex: numberTaskIndex,
        completed: !task.completed
      }
    }).then(res => {
      if (res.result.success) {
        // 更新本地数据
        const selectedDateTasks = this.data.selectedDateTasks.map(t => 
          t._id === taskId ? { ...t, completed: !t.completed } : t
        )
        
        // 更新计划数据
        const plans = this.data.plans.map(plan => {
          if (plan._id === stringPlanId) {
            const tasks = plan.tasks.map(task => {
              if (task.date === this.data.selectedDate) {
                const updatedTasks = task.tasks.map((t, index) => {
                  if (index === numberTaskIndex) {
                    return { ...t, completed: !t.completed }
                  }
                  return t
                })
                return { ...task, tasks: updatedTasks }
              }
              return task
            })
            return { ...plan, tasks }
          }
          return plan
        })

        this.setData({
          selectedDateTasks,
          plans
        })
        
        this.calculateProgress()
        this.generateCalendar()

        wx.showToast({
          title: task.completed ? '已取消完成' : '已完成',
          icon: 'success'
        })
      } else {
        wx.showToast({
          title: res.result.message || '操作失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  // 切换按钮列表显示状态
  toggleMenu: function() {
    if (!this.data.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后才能使用计划功能',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.goToLogin()
          }
        }
      })
      return
    }
    
    const windowHeight = wx.getWindowInfo().windowHeight
    const buttonY = this.data.buttonY
    const isMenuUp = buttonY > windowHeight / 2

    this.setData({
      isMenuOpen: !this.data.isMenuOpen,
      isMenuUp
    })

    // 如果是打开菜单，延迟一小段时间后检查位置并调整
    if (this.data.isMenuOpen) {
      setTimeout(() => {
        const query = wx.createSelectorQuery()
        query.select('.menu-list').boundingClientRect()
        query.exec((res) => {
          if (res[0]) {
            const menuList = res[0]
            const viewportHeight = windowHeight
            // 如果菜单超出屏幕底部，强制向上展开
            if (menuList.bottom > viewportHeight) {
              this.setData({ isMenuUp: true })
            }
            // 如果菜单超出屏幕顶部，强制向下展开
            if (menuList.top < 0) {
              this.setData({ isMenuUp: false })
            }
          }
        })
      }, 50)
    }
  },

  // 按钮移动时保存位置
  onButtonMove: function(e) {
    const { x, y, source } = e.detail
    
    // 只有当用户主动触摸移动按钮时才更新位置
    if (source === 'touch') {
      // 记录最后的位置，用于防止闪烁
      this._lastMovePosition = { x, y }
      
      // 更新UI
      this.setData({
        buttonX: x,
        buttonY: y
      })
      
      // 异步保存位置到存储，避免频繁I/O操作
      clearTimeout(this._savePositionTimer)
      this._savePositionTimer = setTimeout(() => {
        wx.setStorageSync('planButtonPosition', { x, y })
      }, 200)
    }
  },

  // 跳转到添加计划页面
  goToAddPlan: function() {
    if (!this.data.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后才能制定计划',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.goToLogin()
          }
        }
      })
      return
    }
    wx.navigateTo({
      url: '/pages/plan/add/index'
    })
  },

  // 跳转到管理计划页面
  goToManagePlan: function() {
    if (!this.data.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后才能管理计划',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.goToLogin()
          }
        }
      })
      return
    }
    wx.navigateTo({
      url: '/pages/plan/manage/index'
    })
  },

  // 初始化按钮位置，确保在不同场景下都能正确显示
  initButtonPosition: function() {
    try {
      // 从本地存储读取按钮位置
      const buttonPosition = wx.getStorageSync('planButtonPosition')
      const windowInfo = wx.getWindowInfo()
      
      // 保存窗口信息到实例变量，以便其他函数使用
      this._windowInfo = windowInfo
      
      let x, y
      
      if (buttonPosition && typeof buttonPosition.x === 'number' && typeof buttonPosition.y === 'number') {
        // 确保位置在屏幕范围内，并留出边距
        const maxX = windowInfo.windowWidth - 50
        const maxY = windowInfo.windowHeight - 50
        
        x = Math.max(0, Math.min(buttonPosition.x, maxX))
        y = Math.max(0, Math.min(buttonPosition.y, maxY))
      } else {
        // 使用默认位置
        x = windowInfo.windowWidth - 65
        y = windowInfo.windowHeight - 100
        
        // 保存默认位置到本地存储
        wx.setStorageSync('planButtonPosition', { x, y })
      }
      
      // 记录位置，以便在移动按钮后恢复
      this._lastMovePosition = { x, y }
      
      // 一次性设置初始位置
      this.setData({
        buttonX: x,
        buttonY: y
      })
      
    } catch (error) {
      const windowInfo = wx.getWindowInfo()
      
      // 出错时设置一个保底位置
      this.setData({
        buttonX: windowInfo.windowWidth - 65,
        buttonY: windowInfo.windowHeight - 100
      })
    }
  }
}) 