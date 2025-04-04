const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-9gbyqyqyb5f2cb69'
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { startDate, endDate, tasks, planName } = event;
  const wxContext = cloud.getWXContext();

  try {
    // 验证日期
    if (!startDate || !endDate || startDate > endDate) {
      return {
        success: false,
        message: '日期格式不正确'
      };
    }

    // 验证计划名称
    if (!planName || !planName.trim()) {
      return {
        success: false,
        message: '请输入计划名称'
      };
    }

    // 验证任务
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return {
        success: false,
        message: '请添加至少一个任务'
      };
    }

    // 创建计划
    const planResult = await db.collection('plans').add({
      data: {
        _openid: wxContext.OPENID,
        planName: planName.trim(),
        startDate,
        endDate,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    // 生成每日任务
    const taskList = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];

      // 为每天创建一条任务记录，包含所有任务
      taskList.push({
        planId: planResult._id,
        date: dateStr,
        tasks: tasks.map(task => ({
          content: task.content,
          completed: false
        })),
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        _openid: wxContext.OPENID  // 添加用户ID
      });
    }

    // 批量添加任务 - 修改这里的逻辑
    if (taskList.length > 0) {
      // 一次只能添加一条数据，所以需要循环添加
      for (const task of taskList) {
        await db.collection('tasks').add({
          data: task
        });
      }
    }

    return {
      success: true,
      message: '创建成功',
      planId: planResult._id
    };
  } catch (err) {
    return {
      success: false,
      message: '创建失败：' + err.message
    };
  }
}; 