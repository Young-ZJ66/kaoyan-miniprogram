const cloud = require('wx-server-sdk')
cloud.init({
  env: 'cloud1-9gbyqyqyb5f2cb69'
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { type, data } = event

  switch (type) {
    case 'getList':
      return await getNewsList(data)
    case 'getDetail':
      return await getNewsDetail(data)
    default:
      return {
        success: false,
        message: '未知的操作类型'
      }
  }
}

// 获取新闻列表
async function getNewsList(data) {
  const { page = 1, pageSize = 5 } = data
  try {
    const result = await db.collection('news')
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    return {
      success: false,
      message: err.message
    }
  }
}

// 获取新闻详情
async function getNewsDetail(data) {
  const { id } = data
  try {
    const result = await db.collection('news')
      .doc(id)
      .get()
    
    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    return {
      success: false,
      message: err.message
    }
  }
} 