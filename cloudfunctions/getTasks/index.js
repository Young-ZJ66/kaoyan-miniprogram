// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_LIMIT = 100

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const OPENID = wxContext.OPENID
  
  try {
    // 1. 获取总记录数
    const countResult = await db.collection('tasks')
      .where({
        _openid: OPENID
      })
      .count()
    
    const total = countResult.total
    
    // 2. 计算需要分几次获取
    const batchTimes = Math.ceil(total / MAX_LIMIT)
    
    // 3. 批量获取数据
    const tasks = []
    
    for (let i = 0; i < batchTimes; i++) {
      const promise = await db.collection('tasks')
        .where({
          _openid: OPENID
        })
        .orderBy('createdAt', 'asc') // 按照创建时间升序排列
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .get()
      
      tasks.push(...promise.data)
    }
    
    return {
      success: true,
      data: tasks,
      total: total
    }
  } catch (err) {
    console.error('获取任务失败：', err)
    return {
      success: false,
      message: '获取任务失败',
      error: err
    }
  }
} 