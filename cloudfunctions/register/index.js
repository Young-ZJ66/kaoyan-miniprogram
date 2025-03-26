const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-9gbyqyqyb5f2cb69'
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { openid, avatarUrl, nickName, gender, birthday, region, phone, email } = event;

  try {
    // 检查用户是否已注册
    const user = await db.collection('users').where({
      _openid: openid
    }).get();

    if (user.data.length > 0) {
      return {
        success: false,
        message: '用户已注册'
      };
    }

    // 创建用户记录
    const result = await db.collection('users').add({
      data: {
        _openid: openid,
        avatarUrl,
        nickName,
        gender,
        birthday,
        region,
        phone,
        email,
        createTime: db.serverDate()
      }
    });

    return {
      success: true,
      data: result
    };
  } catch (err) {
    console.error('注册失败：', err);
    return {
      success: false,
      message: '注册失败'
    };
  }
}; 