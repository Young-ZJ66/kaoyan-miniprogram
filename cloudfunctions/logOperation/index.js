const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { type, userId, timestamp, deviceInfo } = event;

    // 1. 验证参数
    if (!type || !userId || !timestamp) {
      return {
        success: false,
        message: '参数不完整'
      };
    }

    // 2. 记录操作日志
    const logData = {
      type,           // 操作类型：login, download, upload 等
      userId,         // 用户ID
      timestamp,      // 操作时间
      deviceInfo,     // 设备信息
      createTime: Date.now()
    };

    const result = await db.collection('operation_logs').add({
      data: logData
    });

    return {
      success: true,
      data: result
    };

  } catch (err) {
    console.error('记录操作日志失败：', err);
    return {
      success: false,
      message: '记录操作日志失败：' + err.message
    };
  }
} 