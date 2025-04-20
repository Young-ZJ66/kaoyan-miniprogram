const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { openid } = event;

  try {
    // 查询用户信息
    const user = await db.collection('users').where({
      _openid: openid
    }).get();

    if (user.data.length === 0) {
      return {
        success: false,
        message: '用户未注册'
      };
    }

    return {
      success: true,
      data: user.data[0]
    };
  } catch (err) {
    console.error('获取用户信息失败：', err);
    return {
      success: false,
      message: '获取用户信息失败'
    };
  }
}; 