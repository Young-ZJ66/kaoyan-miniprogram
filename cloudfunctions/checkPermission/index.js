const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 验证token
const validateToken = (token) => {
  if (!token) return null;
  const [openid] = token.split('_');
  return openid;
}

exports.main = async (event, context) => {
  try {
    const { resourceId, token } = event;
    
    // 1. 验证参数
    if (!resourceId || !token) {
      return {
        success: false,
        message: '参数不完整'
      };
    }

    // 2. 验证token
    const openid = validateToken(token);
    if (!openid) {
      return {
        success: false,
        message: '无效的token'
      };
    }

    // 3. 获取资源信息
    const resourceRes = await db.collection('resources')
      .doc(resourceId)
      .get();

    if (!resourceRes.data) {
      return {
        success: false,
        message: '资源不存在'
      };
    }

    const resource = resourceRes.data;

    // 4. 获取用户信息
    const userRes = await db.collection('users')
      .where({
        _openid: openid
      })
      .get();

    if (!userRes.data || userRes.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }

    const user = userRes.data[0];

    // 5. 检查权限
    const isOwner = resource._openid === openid;
    const hasPermission = isOwner || user.role === 'admin';

    return {
      success: true,
      data: {
        isOwner,
        hasPermission
      }
    };

  } catch (err) {
    console.error('权限检查失败：', err);
    return {
      success: false,
      message: '权限检查失败：' + err.message
    };
  }
} 