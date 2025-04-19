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

exports.main = async (event, context) => {
  try {
    const { code, userInfo } = event;

    // 1. 获取openid
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    // 2. 检查用户是否已注册
    const userRes = await db.collection('users')
      .where({
        _openid: openid
      })
      .get();

    if (userRes.data.length > 0) {
      return {
        success: false,
        message: '用户已注册'
      };
    }

    // 3. 创建新用户
    const newUser = {
      _openid: openid,
      avatarUrl: userInfo.avatarUrl || '',
      nickName: userInfo.nickName || '',
      gender: userInfo.gender || '1',
      birthday: userInfo.birthday || '',
      region: userInfo.region || '',
      phone: userInfo.phone || '',
      email: userInfo.email || '',
      role: 'user',
      status: true,  // true表示用户状态正常
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      lastLoginTime: db.serverDate()
    };

    const addRes = await db.collection('users').add({
      data: newUser
    });

    // 4. 生成token和过期时间
    const token = generateToken(openid);
    const expireTime = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7天

    return {
      success: true,
      data: {
        token,
        userInfo: {
          _id: addRes._id,
          ...newUser
        },
        expireTime
      }
    };
  } catch (err) {
    console.error('注册失败：', err);
    return {
      success: false,
      message: '注册失败：' + err.message
    };
  }
}; 