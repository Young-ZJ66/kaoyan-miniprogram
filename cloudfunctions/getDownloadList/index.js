const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { category } = event;
  ;

  try {
    // 查询条件
    const query = {
      _openid: OPENID
    };

    // 如果指定了分类，添加分类筛选条件
    if (category) {
      query.category = category;
    }

    ;

    const result = await db.collection('downloads')
      .where(query)
      .orderBy('createdAt', 'desc')
      .get();

    ;

    return {
      success: true,
      data: result.data
    };
  } catch (err) {
    console.error('获取下载列表失败：', err);
    return {
      success: false,
      message: '获取列表失败',
      error: err
    };
  }
}; 