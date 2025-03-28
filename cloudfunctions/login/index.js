const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 生成token
const generateToken = (openid) => {
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(2, 15);
  return `${openid}_${timestamp}_${nonce}`;
};

// 验证请求参数
const validateRequest = (event) => {
  const { code, timestamp, nonce } = event;
  if (!code || !timestamp || !nonce) {
    return false;
  }
  // 验证时间戳是否在有效期内（5分钟）
  if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    return false;
  }
  return true;
};

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 1. 验证请求参数
    if (!validateRequest(event)) {
      return {
        success: false,
        message: '无效的请求参数'
      };
    }

    // 2. 获取openid
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    // 3. 查询用户信息
    const userRes = await db.collection('users')
      .where({
        _openid: openid
      })
      .get();

    // 4. 生成token和过期时间
    const token = generateToken(openid);
    const expireTime = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7天

    if (userRes.data.length > 0) {
      // 5. 用户已存在，更新登录时间
      const userInfo = userRes.data[0];
      await db.collection('users').doc(userInfo._id).update({
        data: {
          lastLoginTime: db.serverDate()  // 使用 db.serverDate() 存储日期类型
        }
      });

      // 返回完整的用户信息
      return {
        success: true,
        data: {
          token,
          userInfo: {
            _id: userInfo._id,
            _openid: userInfo._openid,
            avatarUrl: userInfo.avatarUrl,
            nickName: userInfo.nickName,
            gender: userInfo.gender,
            birthday: userInfo.birthday,
            region: userInfo.region,
            phone: userInfo.phone,
            email: userInfo.email,
            createTime: userInfo.createTime,
            lastLoginTime: db.serverDate(),  // 返回最新的登录时间
            status: userInfo.status,
            role: userInfo.role
          },
          expireTime
        }
      };
    } else {
      // 6. 用户不存在，返回未注册状态
      return {
        success: false,
        code: 'USER_NOT_REGISTERED',
        message: '用户未注册'
      };
    }
  } catch (err) {
    console.error('登录失败：', err);
    return {
      success: false,
      message: '登录失败：' + err.message
    };
  }
}; 