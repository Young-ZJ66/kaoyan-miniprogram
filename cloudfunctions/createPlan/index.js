const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { startDate, endDate, tasks, planName } = event;
  const wxContext = cloud.getWXContext();
  const now = Date.now(); // 当前时间戳

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
        startDate: startDate, // 使用时间戳而不是Date对象
        endDate: endDate, // 使用时间戳而不是Date对象
        createdAt: now,
        updatedAt: now
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
      // 将日期重置为当天的0点，并获取时间戳
      currentDate.setHours(0, 0, 0, 0);
      const dateTimestamp = currentDate.getTime();

      // 为每天创建一条任务记录，包含所有任务
      taskList.push({
        planId: planResult._id,
        date: dateTimestamp, // 使用时间戳
        tasks: tasks.map(task => ({
          content: task.content,
          color: task.color, // 添加颜色信息
          completed: false
        })),
        createdAt: now,
        updatedAt: now,
        _openid: wxContext.OPENID
      });
    }

    // 批量添加任务
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