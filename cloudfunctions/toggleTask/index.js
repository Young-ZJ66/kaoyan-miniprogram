const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-9gbyqyqyb5f2cb69'
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { planId, date, taskIndex, completed } = event;
  const wxContext = cloud.getWXContext();

  try {
    // 获取计划信息
    const plan = await db.collection('plans').doc(planId).get();
    
    if (!plan.data) {
      return {
        success: false,
        message: '计划不存在'
      };
    }

    // 验证权限
    if (plan.data._openid !== wxContext.OPENID) {
      return {
        success: false,
        message: '无权操作此任务'
      };
    }

    // 获取任务记录
    const taskResult = await db.collection('tasks')
      .where({
        planId: planId,
        date: date
      })
      .get();

    if (!taskResult.data || taskResult.data.length === 0) {
      return {
        success: false,
        message: '任务不存在'
      };
    }

    const task = taskResult.data[0];
    const tasks = task.tasks || [];
    const updatedTasks = tasks.map((t, index) => {
      if (index === taskIndex) {
        return { ...t, completed };
      }
      return t;
    });

    // 更新任务状态
    await db.collection('tasks').doc(task._id).update({
      data: {
        tasks: updatedTasks,
        updateTime: db.serverDate()
      }
    });

    return {
      success: true,
      message: '更新成功'
    };
  } catch (err) {
    console.error('更新任务状态失败：', err);
    return {
      success: false,
      message: '更新失败：' + err.message
    };
  }
}; 