const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { openid, avatarUrl, nickName, gender, birthday, region, phone, email } = event;

  try {
    // 先获取用户当前信息
    const user = await db.collection('users').where({
      _openid: openid
    }).get();

    if (user.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }

    const currentUser = user.data[0];

    // 如果更新了头像，删除旧头像
    if (avatarUrl && avatarUrl !== currentUser.avatarUrl && currentUser.avatarUrl) {
      try {
        await cloud.deleteFile({
          fileList: [currentUser.avatarUrl]
        });
        ;
      } catch (err) {
        console.error('删除旧头像失败：', err);
      }
    }

    // 更新用户信息
    const result = await db.collection('users').where({
      _openid: openid
    }).update({
      data: {
        avatarUrl,
        nickName,
        gender,
        birthday,
        region,
        phone,
        email,
        updatedAt: db.serverDate()
      }
    });

    return {
      success: true,
      data: result
    };
  } catch (err) {
    console.error('更新用户信息失败：', err);
    return {
      success: false,
      message: '更新用户信息失败：' + err.message
    };
  }
}; 