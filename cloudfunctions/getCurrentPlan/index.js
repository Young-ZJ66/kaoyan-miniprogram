const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const today = new Date().toISOString().split('T')[0];

  try {
    // 获取用户当前有效的计划
    const plans = await db.collection('plans')
      .where({
        _openid: wxContext.OPENID,
        endDate: db.command.gte(today)
      })
      .orderBy('startDate', 'asc')
      .limit(1)
      .get();

    if (plans.data.length === 0) {
      return {
        success: true,
        data: null
      };
    }

    const plan = plans.data[0];

    // 获取计划的所有任务
    const tasks = await db.collection('tasks')
      .where({
        planId: plan._id
      })
      .get();

    // 计算完成的任务数
    const completedTasks = tasks.data.filter(task => task.completed).length;

    return {
      success: true,
      data: {
        ...plan,
        tasks: tasks.data,
        totalTasks: tasks.data.length,
        completedTasks
      }
    };
  } catch (err) {
    console.error('获取计划失败：', err);
    return {
      success: false,
      message: '获取计划失败：' + err.message
    };
  }
}; 