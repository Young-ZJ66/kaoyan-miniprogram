// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const { planId } = event

  try {
    // 开启事务
    const transaction = await db.startTransaction()

    // 删除计划
    await transaction.collection('plans').doc(planId).remove()

    // 删除相关的所有任务
    await transaction.collection('tasks').where({
      planId: planId
    }).remove()

    // 提交事务
    await transaction.commit()

    return {
      success: true
    }
  } catch (err) {
    if (transaction) {
      await transaction.rollback()
    }
    return {
      success: false,
      error: err
    }
  }
} 