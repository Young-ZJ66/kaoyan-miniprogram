// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 确保计划数据结构完整
function validatePlan(plan) {
  return {
    ...plan,
    tasks: Array.isArray(plan.tasks) ? plan.tasks : [],
    totalTasks: typeof plan.totalTasks === 'number' ? plan.totalTasks : 0,
    completedTasks: typeof plan.completedTasks === 'number' ? plan.completedTasks : 0,
    isDeleted: !!plan.isDeleted
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  try {
    // 获取用户的所有计划
    const plansResult = await db.collection('plans')
      .aggregate()
      .match({
        _openid: openId,
        isDeleted: _.neq(true)
      })
      .lookup({
        from: 'tasks',
        let: {
          planId: '$_id'
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$planId', '$$planId']
              }
            }
          }
        ],
        as: 'tasks'
      })
      .sort({
        startDate: -1
      })
      .end()

    // 确保每个计划的数据结构完整
    const validatedPlans = plansResult.list.map(validatePlan)

    return {
      success: true,
      data: validatedPlans
    }
  } catch (err) {
    console.error('获取计划失败：', err)
    return {
      success: false,
      message: '获取计划失败'
    }
  }
} 