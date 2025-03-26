const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-9gbyqyqyb5f2cb69'
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { openid } = event;

  try {
    // 先获取用户信息
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

    // 删除用户头像
    if (currentUser.avatarUrl) {
      try {
        await cloud.deleteFile({
          fileList: [currentUser.avatarUrl]
        });
        console.log('删除用户头像成功');
      } catch (err) {
        console.error('删除用户头像失败：', err);
      }
    }

    // 删除用户记录
    const result = await db.collection('users').where({
      _openid: openid
    }).remove();

    return {
      success: true,
      data: result
    };
  } catch (err) {
    console.error('删除用户失败：', err);
    return {
      success: false,
      message: '删除用户失败：' + err.message
    };
  }
}; 