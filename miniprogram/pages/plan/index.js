const app = getApp()

Page({
  data: {
    buttonX: 0,  // 初始值为0，将在onLoad中设置
    buttonY: 0,  // 初始值为0，将在onLoad中设置
    isMenuOpen: false,  // 控制按钮列表的显示状态
    isMenuUp: false,  // 添加控制菜单展开方向的状态
    isLoggedIn: false,  // 添加登录状态标记
    countdownInfo: null, // 倒计时信息
    totalProgress: 0,    // 任务总进度
    needRefresh: false,  // 标记是否需要刷新数据
    
    // 日历相关数据
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    days: [],
    selectedDate: null,
    
    // 任务相关数据
    taskList: [],        // 所有任务
    dailyTasks: {},      // 按日期分组的任务，格式：{ '2023-05-01': [...tasks] }
    currentDateTasks: [] // 当前选中日期的任务
  },

  onLoad: function() {
    if (!wx.cloud) {
      // 请使用 2.2.3 或以上的基础库以使用云能力
    } else {
      wx.cloud.init({
        env: 'cloud-young-2gcblx0nb59a75fc',
        traceUser: true,
      })
    }

    // 设置按钮位置
    this.initButtonPosition()

    // 初始化时检查登录状态，不显示提示
    const isLoggedIn = this.checkLoginStatus(false)
    
    // 获取倒计时信息
    this.getCountdownInfo()
    
    // 设置当前日期为选中日期
    const today = new Date()
    const formattedToday = this.formatDate(today)
    this.setData({
      selectedDate: formattedToday
    })
    
    // 生成日历数据
    this.generateCalendarDays()
    
    // 如果已登录，加载当天任务
    if (isLoggedIn) {
      this.loadDateTasks(formattedToday)
    }
  },

  onHide: function() {
    // 设置标记，表示需要在返回前台时刷新
    this.needRefresh = true
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      })
    }
    
    // 页面显示时检查登录状态，不显示提示
    const isLoggedIn = this.checkLoginStatus(false)
    
    // 如果已登录，并且需要刷新数据
    if (isLoggedIn && (this.data.needRefresh || this.needRefresh)) {
      // 重置刷新标记
      this.setData({ needRefresh: false })
      this.needRefresh = false
      
      // 强制重新获取任务列表
      this.getUserTasks()
    }
  },

  // 检查登录状态
  checkLoginStatus: function(showTip = true) {
    // 获取完整的登录信息
    const auth = wx.getStorageSync('auth');
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    
    // 判断是否真正登录（token有效，用户信息存在）
    const isReallyLoggedIn = auth && auth.token && Date.now() < auth.expireTime && userInfo && isLoggedIn;
    
    // 更新登录状态
    this.setData({ 
      isLoggedIn: isReallyLoggedIn 
    });
    
    // 未登录时，清空任务相关数据
    if (!isReallyLoggedIn) {
      this.setData({
        taskList: [],
        dailyTasks: {},
        currentDateTasks: [],
        totalProgress: 0
      });
      
      // 重新生成日历，移除任务标记
      this.generateCalendarDays();
    }

    // 显示登录提示
    if (!isReallyLoggedIn && showTip) {
      wx.showModal({
        title: '提示',
        content: '登录后可以制定和管理您的计划',
        confirmText: '去登录',
        cancelText: '暂不登录',
        success: (res) => {
          if (res.confirm) {
            this.goToLogin();
          }
        }
      });
    } else if (isReallyLoggedIn) {
      // 如果已登录，获取任务列表
      this.getUserTasks();
    }
    
    return isReallyLoggedIn;
  },

  // 跳转到登录页面
  goToLogin: function() {
    wx.switchTab({
      url: '/pages/my/index'
    })
  },

  // 获取用户任务列表
  getUserTasks: function(showLoading = true) {
    if (showLoading) {
      wx.showLoading({
        title: '加载任务...',
      })
    }
    
    // 从本地存储获取用户信息
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo._openid) {
      if (showLoading) wx.hideLoading()
      wx.showToast({
        title: '用户信息获取失败',
        icon: 'none'
      })
      return
    }
    
    const db = wx.cloud.database()
    
    // 使用从本地存储获取的openid查询任务
    return db.collection('tasks')
      .where({
        _openid: userInfo._openid
      })
      .get()
      .then(res => {
        const tasks = res.data || []
        
        // 将任务按日期分组
        const dailyTasks = this.groupTasksByDate(tasks)
        
        // 计算任务总进度
        const progress = this.calculateTasksProgress(tasks)
        
        this.setData({
          taskList: tasks,
          dailyTasks: dailyTasks,
          totalProgress: progress
        })
        
        // 重新生成日历数据，添加任务标记
        this.generateCalendarDays()
        
        // 如果有选中的日期，加载该日期的任务
        if (this.data.selectedDate) {
          this.loadDateTasks(this.data.selectedDate)
        }
        
        return tasks
      })
      .catch(err => {
        wx.showToast({
          title: '获取任务失败',
          icon: 'none'
        })
        return []
      })
      .finally(() => {
        if (showLoading) wx.hideLoading()
      })
  },
  
  // 将任务按日期分组
  groupTasksByDate: function(tasks) {
    const dailyTasks = {}
    
    tasks.forEach(task => {
      if (task.date) {
        // 将时间戳转换为日期字符串 YYYY-MM-DD
        const dateObj = new Date(task.date)
        const dateStr = this.formatDate(dateObj)
        
        if (!dailyTasks[dateStr]) {
          dailyTasks[dateStr] = []
        }
        
        dailyTasks[dateStr].push(task)
      }
    })
    
    return dailyTasks
  },

  // 计算任务总进度
  calculateTasksProgress: function(taskList) {
    let totalTasks = 0
    let completedTasks = 0
    
    taskList.forEach(taskGroup => {
      if (taskGroup.tasks && taskGroup.tasks.length > 0) {
        taskGroup.tasks.forEach(task => {
          totalTasks++
          if (task.completed) {
            completedTasks++
          }
        })
      }
    })
    
    if (totalTasks === 0) return 0
    
    // 计算百分比并四舍五入到整数
    const progressPercent = Math.round((completedTasks / totalTasks) * 100)
    return progressPercent
  },

  // 获取倒计时信息
  getCountdownInfo: function(showLoading = true) {
    if (showLoading) {
      wx.showLoading({
        title: '加载中...',
      })
    }
    
    return wx.cloud.callFunction({
      name: 'getCountdown'
    }).then(res => {
      if (res.result.success) {
        const countdownData = res.result.data
        
        this.setData({
          countdownInfo: countdownData
        })
        
        // 更新日历，显示倒计时日期
        this.generateCalendarDays()
        
        return countdownData
      }
      return null
    }).catch(err => {
      return null
    }).finally(() => {
      if (showLoading) wx.hideLoading()
    })
  },
  
  // 日历相关函数
  // 生成日历数据
  generateCalendarDays: function() {
    const { currentYear, currentMonth, dailyTasks, countdownInfo } = this.data
    const days = []
    
    // 获取当月第一天是星期几
    const firstDay = new Date(currentYear, currentMonth - 1, 1)
    const firstDayWeekDay = firstDay.getDay()
    
    // 获取当月的最后一天
    const lastDay = new Date(currentYear, currentMonth, 0)
    const lastDate = lastDay.getDate()
    
    // 当前日期（用于比较过期任务）
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // 准备倒计时日期
    let countdownDateStr = null
    let nextDayStr = null
    if (countdownInfo) {
      countdownDateStr = countdownInfo.countdownDay
      nextDayStr = countdownInfo.nextDay
    }
    
    // 填充上个月的日期（作为占位符，依然需要生成以保持布局正确）
    for (let i = 0; i < firstDayWeekDay; i++) {
      days.push({
        date: `prev-${i}`, // 使用唯一的key
        day: '', // 不显示日期数字
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasTasks: false
      })
    }
    
    // 填充当月的日期
    for (let i = 1; i <= lastDate; i++) {
      const date = new Date(currentYear, currentMonth - 1, i)
      const dateStr = this.formatDate(date)
      
      // 检查该日期是否有任务
      const hasTasks = dailyTasks && dailyTasks[dateStr] && dailyTasks[dateStr].length > 0
      
      // 检查该日期的任务状态
      let taskStatus = 'none' // 默认状态：无任务
      let hasOverdueTasks = false
      let allTasksCompleted = true
      
      if (hasTasks) {
        // 遍历该日期的所有任务
        const tasks = dailyTasks[dateStr]
        
        // 检查是否有任务，且是否都完成了
        for (let j = 0; j < tasks.length; j++) {
          const taskGroup = tasks[j]
          
          for (let k = 0; k < taskGroup.tasks.length; k++) {
            const taskItem = taskGroup.tasks[k]
            
            // 如果有任何未完成的任务，标记为未全部完成
            if (!taskItem.completed) {
              allTasksCompleted = false
              
              // 如果日期在今天之前且有未完成任务，标记为过期
              if (date < today) {
                hasOverdueTasks = true
              }
            }
          }
        }
        
        // 设置任务状态
        if (allTasksCompleted) {
          taskStatus = 'completed' // 全部完成
        } else if (hasOverdueTasks) {
          taskStatus = 'overdue' // 有过期任务
        }
      }
      
      // 检查是否为倒计时日期
      const isCountdownDay = dateStr === countdownDateStr
      const isNextDay = dateStr === nextDayStr
      
      days.push({
        date: dateStr,
        day: i,
        isCurrentMonth: true,
        isToday: this.isToday(date),
        isSelected: this.isDateEqual(date, this.data.selectedDate),
        hasTasks: hasTasks,
        taskCount: hasTasks ? dailyTasks[dateStr].length : 0,
        taskStatus: taskStatus,
        isCountdownDay: isCountdownDay,
        isNextDay: isNextDay
      })
    }
    
    // 填充下个月的日期（补全日历）
    const daysCount = days.length
    const remainingDays = 7 - (daysCount % 7)
    if (remainingDays < 7) {
      for (let i = 0; i < remainingDays; i++) {
        days.push({
          date: `next-${i}`, // 使用唯一的key
          day: '', // 不显示日期数字
          isCurrentMonth: false,
          isToday: false,
          isSelected: false,
          hasTasks: false
        })
      }
    }
    
    this.setData({ days })
  },
  
  // 格式化日期为 YYYY-MM-DD 字符串
  formatDate: function(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },
  
  // 判断是否为今天
  isToday: function(date) {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  },
  
  // 判断两个日期是否相等
  isDateEqual: function(date1, date2) {
    if (!date1 || !date2) return false
    
    // 如果date2是字符串，先转为Date对象
    let d2 = date2
    if (typeof date2 === 'string') {
      d2 = new Date(date2)
    }
    
    return (
      date1.getDate() === d2.getDate() &&
      date1.getMonth() === d2.getMonth() &&
      date1.getFullYear() === d2.getFullYear()
    )
  },
  
  // 切换到上个月
  prevMonth: function() {
    let { currentYear, currentMonth } = this.data
    
    if (currentMonth === 1) {
      currentYear--
      currentMonth = 12
    } else {
      currentMonth--
    }
    
    this.setData({
      currentYear,
      currentMonth
    }, () => {
      this.generateCalendarDays()
    })
  },
  
  // 切换到下个月
  nextMonth: function() {
    let { currentYear, currentMonth } = this.data
    
    if (currentMonth === 12) {
      currentYear++
      currentMonth = 1
    } else {
      currentMonth++
    }
    
    this.setData({
      currentYear,
      currentMonth
    }, () => {
      this.generateCalendarDays()
    })
  },
  
  // 选择日期
  selectDate: function(e) {
    const date = e.currentTarget.dataset.date
    
    // 如果点击的是空白处或已选中的日期，不做任何操作
    if (!date || date.startsWith('prev-') || date.startsWith('next-')) return
    
    this.setData({
      selectedDate: date
    }, () => {
      this.generateCalendarDays()
      this.loadDateTasks(date)
    })
  },
  
  // 加载选中日期的任务
  loadDateTasks: function(date) {
    if (!date) return
    
    const { dailyTasks } = this.data
    const tasks = dailyTasks[date] || []
    
    // 判断选中日期与当前日期的关系
    const selectedDate = new Date(date)
    selectedDate.setHours(0, 0, 0, 0) // 设置时间为当天的00:00:00
    
    const today = new Date()
    today.setHours(0, 0, 0, 0) // 设置时间为当天的00:00:00
    
    // 确定是否显示勾选框
    // 只有当选中日期不晚于今天时才显示勾选框
    const showCheckbox = selectedDate <= today
    
    this.setData({
      currentDateTasks: tasks,
      showTaskCheckbox: showCheckbox // 添加控制勾选框显示的状态
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
    
    // 设置标记，表示需要在返回时刷新
    this.setData({
      needRefresh: true
    })
    
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
    
    // 设置标记，表示需要在返回时刷新
    this.setData({
      needRefresh: true
    })
    
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
  },

  // 日期更改处理函数
  onDateChange: function(e) {
    const selectedDate = new Date(e.detail.value);
    
    // 确保使用UTC时间处理
    const utcDate = new Date(Date.UTC(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate()
    ));
    
    const dateStr = this.formatDate(utcDate);
    
    // 更新组件状态
    this.setData({
      selectedDate: dateStr,
      displayDate: e.detail.value
    });
    
    // 加载选中日期的任务
    this.loadDateTasks(dateStr);
  },

  // 切换任务完成状态
  toggleTaskStatus: function(e) {
    const { taskId, taskIndex, completed } = e.currentTarget.dataset;
    
    // 防止快速点击导致重复提交
    if (this._lastToggleTime && (Date.now() - this._lastToggleTime < 500)) {
      return;
    }
    this._lastToggleTime = Date.now();
    
    // 显示加载中
    wx.showLoading({
      title: '更新中...',
      mask: true
    });
    
    // 先在本地更新UI状态，使体验更流畅
    const newCompletedStatus = !completed;
    const currentDateTasks = [...this.data.currentDateTasks];
    
    // 深拷贝，确保不影响原始数据结构
    for (let i = 0; i < currentDateTasks.length; i++) {
      if (currentDateTasks[i]._id === taskId) {
        const tasksCopy = [...currentDateTasks[i].tasks];
        tasksCopy[taskIndex] = {
          ...tasksCopy[taskIndex],
          completed: newCompletedStatus
        };
        currentDateTasks[i] = {
          ...currentDateTasks[i],
          tasks: tasksCopy
        };
        break;
      }
    }
    
    // 更新UI
    this.setData({
      currentDateTasks: currentDateTasks
    });
    
    // 调用云函数更新数据库
    wx.cloud.callFunction({
      name: 'toggleTask',
      data: {
        taskId: taskId,
        taskIndex: taskIndex,
        completed: newCompletedStatus
      }
    })
    .then(res => {
      if (res.result && res.result.success) {
        // 数据库更新成功
        wx.hideLoading();
        
        // 更新任务组和日历标记
        this.updateTasksAfterToggle(taskId, res.result.data.tasks);
        
        // 显示完成状态的反馈
        wx.showToast({
          title: newCompletedStatus ? '已完成' : '已取消完成',
          icon: 'success',
          duration: 1500
        });
      } else {
        throw new Error(res.result.message || '更新失败');
      }
    })
    .catch(err => {
      wx.hideLoading();
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
      
      // 恢复原始状态
      this.getUserTasks();
    });
  },
  
  // 更新任务列表和日历标记
  updateTasksAfterToggle: function(taskId, updatedTasks) {
    // 获取原始数据的副本
    const taskList = [...this.data.taskList];
    const dailyTasks = {...this.data.dailyTasks};
    
    // 找到并更新对应的任务
    for (let i = 0; i < taskList.length; i++) {
      if (taskList[i]._id === taskId) {
        taskList[i] = {
          ...taskList[i],
          tasks: updatedTasks
        };
        break;
      }
    }
    
    // 重新分组任务
    const newDailyTasks = this.groupTasksByDate(taskList);
    
    // 重新计算总进度
    const newProgress = this.calculateTasksProgress(taskList);
    
    this.setData({
      taskList: taskList,
      dailyTasks: newDailyTasks,
      totalProgress: newProgress
    });
    
    // 重新生成日历，更新任务标记
    this.generateCalendarDays();
  },

  // 下拉刷新处理
  onPullDownRefresh: function() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })
    
    // 刷新所有数据
    Promise.all([
      // 获取倒计时信息(不显示额外加载提示)
      this.getCountdownInfo(false),
      
      // 如果用户已登录，获取任务列表(不显示额外加载提示)
      this.data.isLoggedIn ? this.getUserTasks(false) : Promise.resolve([])
    ]).then(() => {
      // 设置当前日期为选中日期
      const today = new Date()
      const formattedToday = this.formatDate(today)
      
      this.setData({
        selectedDate: formattedToday
      })
      
      // 生成日历数据
      this.generateCalendarDays()
      
      // 加载当天任务
      this.loadDateTasks(formattedToday)
      
      // 停止下拉刷新动画
      wx.stopPullDownRefresh()
      
      // 隐藏加载提示框
      wx.hideLoading()
      
    }).catch((error) => {
      console.error('刷新数据失败：', error)
      
      // 发生错误时也停止下拉刷新动画
      wx.stopPullDownRefresh()
      
      // 隐藏加载提示框
      wx.hideLoading()
      
    })
  }
}) 