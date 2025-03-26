const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { category } = event;
  console.log('获取下载列表，用户OPENID：', OPENID, '分类：', category);

  try {
    // 查询条件
    const query = {
      _openid: OPENID,
      type: 'download'
    };

    // 如果指定了分类，添加分类筛选条件
    if (category) {
      query.category = category;
    }

    console.log('查询条件：', query);

    const result = await db.collection('downloads')
      .where(query)
      .orderBy('downloadTime', 'desc')
      .get();

    console.log('查询结果：', result);

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