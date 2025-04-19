const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { type, openid, deviceInfo } = event;

    // 1. 验证参数
    if (!type || !openid) {
      return {
        success: false,
        message: '参数不完整'
      };
    }

    // 只允许记录账户相关的操作
    const allowedTypes = ['login', 'register', 'logout', 'deleteAccount'];
    if (!allowedTypes.includes(type)) {
      return {
        success: false,
        message: '不支持的操作类型，仅支持账户相关操作'
      };
    }

    // 2. 记录操作日志
    const logData = {
      type,           // 操作类型：login, register, logout, deleteAccount
      openid,         // 用户openid
      deviceInfo,     // 设备信息
      createdAt: db.serverDate()  // 使用服务器时间
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