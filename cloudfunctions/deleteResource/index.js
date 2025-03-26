const cloud = require('wx-server-sdk');
cloud.init({
  env: 'cloud1-9gbyqyqyb5f2cb69'
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { id } = event;
  const { OPENID } = cloud.getWXContext();

  try {
    // 检查是否是资源所有者
    const resource = await db.collection('resources')
      .doc(id)
      .get();

    if (!resource.data || resource.data._openid !== OPENID) {
      return {
        success: false,
        message: '无权限删除该资源'
      };
    }

    // 删除资源
    await db.collection('resources')
      .doc(id)
      .remove();

    return {
      success: true
    };
  } catch (err) {
    console.error('删除资源失败：', err);
    return {
      success: false,
      message: '删除失败'
    };
  }
}; 