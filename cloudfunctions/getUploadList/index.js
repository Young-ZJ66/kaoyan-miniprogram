const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { page = 1, pageSize = 20, category } = event;
  console.log('获取上传列表，用户OPENID：', OPENID, '分类：', category);

  try {
    // 查询条件
    const query = {
      _openid: OPENID
    };

    // 如果指定了分类，添加分类筛选条件
    if (category) {
      query.category = category;
    }

    console.log('查询条件：', query);

    const result = await db.collection('resources')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    console.log('查询结果：', result);

    // 格式化数据
    const formattedData = result.data.map(item => ({
      _id: item._id,
      title: item.title,
      type: item.type,
      size: item.size,
      downloads: item.downloads || 0,
      createTime: item.createTime,
      description: item.description,
      fileID: item.fileID,
      fileName: item.fileName,
      category: item.category,
      uploaderNickName: item.uploaderNickName || '未知用户'
    }));

    return {
      success: true,
      data: formattedData
    };
  } catch (err) {
    console.error('获取上传列表失败：', err);
    return {
      success: false,
      message: '获取列表失败',
      error: err
    };
  }
}; 