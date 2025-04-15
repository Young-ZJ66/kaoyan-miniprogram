const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-9gbyqyqyb5f2cb69'
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { openid, deleteRelated } = event;

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

    // 如果需要删除相关记录
    if (deleteRelated) {
      try {
        // 删除点赞记录
        await db.collection('likes_users').where({
          _openid: openid
        }).remove();

        // 删除下载记录
        await db.collection('downloads').where({
          _openid: openid
        }).remove();

        // 删除收藏记录
        await db.collection('collections').where({
          _openid: openid
        }).remove();

        console.log('删除用户相关记录成功');
      } catch (err) {
        console.error('删除用户相关记录失败：', err);
        // 继续执行，不中断删除用户的操作
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