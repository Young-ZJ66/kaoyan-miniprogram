const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { id } = event;
  const wxContext = cloud.getWXContext();

  try {
    // 验证记录是否存在且属于当前用户
    const record = await db.collection('downloads').doc(id).get();
    
    if (!record.data) {
      return {
        success: false,
        message: '下载记录不存在'
      };
    }

    if (record.data._openid !== wxContext.OPENID) {
      return {
        success: false,
        message: '无权删除此记录'
      };
    }

    // 删除记录
    await db.collection('downloads').doc(id).remove();

    return {
      success: true,
      message: '删除成功'
    };
  } catch (err) {
    console.error('删除下载记录失败：', err);
    return {
      success: false,
      message: '删除失败：' + err.message
    };
  }
}; 