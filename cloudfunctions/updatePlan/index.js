// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const { planId, planName, startDate, endDate, tasks } = event

  try {
    // 验证日期
    if (!startDate || !endDate || startDate > endDate) {
      return {
        success: false,
        message: '日期格式不正确'
      }
    }

    // 验证计划名称
    if (!planName || !planName.trim()) {
      return {
        success: false,
        message: '请输入计划名称'
      }
    }

    // 验证任务
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return {
        success: false,
        message: '请添加至少一个任务'
      }
    }

    // 开启事务
    const transaction = await db.startTransaction()

    try {
      // 更新计划基本信息
      await transaction.collection('plans').doc(planId).update({
        data: {
          planName: planName.trim(),
          startDate,
          endDate,
          updateTime: db.serverDate()
        }
      })

      // 获取原有的任务记录
      const oldTasks = await db.collection('tasks')
        .where({
          planId: planId
        })
        .get()
      
      // 创建一个映射来存储每天任务的完成状态
      const completedStatusMap = {}
      oldTasks.data.forEach(dayTasks => {
        const taskStatusMap = {}
        dayTasks.tasks.forEach((task, index) => {
          taskStatusMap[task.content] = task.completed
        })
        completedStatusMap[dayTasks.date] = taskStatusMap
      })

      // 删除原有的任务
      await transaction.collection('tasks').where({
        planId: planId
      }).remove()

      // 生成新的每日任务
      const taskList = []
      const start = new Date(startDate)
      const end = new Date(endDate)
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1

      for (let i = 0; i < days; i++) {
        const currentDate = new Date(start)
        currentDate.setDate(start.getDate() + i)
        const dateStr = currentDate.toISOString().split('T')[0]

        // 为每天创建一条任务记录，包含所有任务
        taskList.push({
          planId: planId,
          date: dateStr,
          tasks: tasks.map(task => ({
            content: task.content,
            // 如果这天这个任务之前存在且已完成，则保持完成状态
            completed: completedStatusMap[dateStr]?.[task.content] || false
          })),
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        })
      }

      // 批量添加任务
      if (taskList.length > 0) {
        await transaction.collection('tasks').add({
          data: taskList
        })
      }

      // 提交事务
      await transaction.commit()

      return {
        success: true,
        message: '更新成功'
      }
    } catch (err) {
      // 回滚事务
      await transaction.rollback()
      throw err
    }
  } catch (err) {
    console.error('更新计划失败：', err)
    return {
      success: false,
      message: '更新失败：' + err.message
    }
  }
} 