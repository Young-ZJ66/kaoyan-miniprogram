// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  
  try {
    // 获取请求参数
    const { taskId, taskIndex, completed } = event
    
    if (!taskId || taskIndex === undefined) {
      return {
        success: false,
        message: '缺少必要参数'
      }
    }
    
    // 获取当前任务
    const taskDoc = await db.collection('tasks').doc(taskId).get()
    const task = taskDoc.data
    
    // 检查是否为任务所有者
    if (task._openid !== OPENID) {
      return {
        success: false,
        message: '无权操作此任务'
      }
    }
    
    // 确保要更新的任务索引存在
    if (!task.tasks || !task.tasks[taskIndex]) {
      return {
        success: false,
        message: '任务项不存在'
      }
    }
    
    // 更新任务完成状态
    const tasksCopy = [...task.tasks]
    tasksCopy[taskIndex].completed = completed !== undefined ? completed : !tasksCopy[taskIndex].completed
    
    // 更新数据库
    await db.collection('tasks').doc(taskId).update({
      data: {
        tasks: tasksCopy,
        updatedAt: db.serverDate()
      }
    })
    
    return {
      success: true,
      data: {
        tasks: tasksCopy,
        completedStatus: tasksCopy[taskIndex].completed
      }
    }
    
  } catch (error) {
    console.error('切换任务状态失败:', error)
    return {
      success: false,
      message: '切换任务状态失败',
      error: error
    }
  }
}
