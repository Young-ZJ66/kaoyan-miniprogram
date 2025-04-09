// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 获取专业列表
async function getMajors(data) {
  const { schoolId, page = 1, pageSize = 10 } = data
  
  try {
    const skip = (page - 1) * pageSize
    
    // 获取专业列表
    const result = await db.collection('majors')
      .where({
        schoolId: schoolId
      })
      .orderBy('code', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    // 获取总数
    const total = await db.collection('majors')
      .where({
        schoolId: schoolId
      })
      .count()
    
    return {
      code: 0,
      data: {
        list: result.data,
        total: total.total,
        hasMore: skip + result.data.length < total.total
      }
    }
  } catch (err) {
    console.error('获取专业列表失败：', err)
    return {
      code: -1,
      msg: '获取专业列表失败'
    }
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { type, data } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  switch (type) {
    case 'getMajorDetail':
      return await getMajorDetail(data)
    case 'checkCollection':
      return await checkCollection(data, openid)
    case 'toggleCollection':
      return await toggleCollection(data, openid)
    case 'getMajors':
      return await getMajors(data)
    case 'getCollections':
      return await getCollections(openid)
    default:
      return {
        code: -1,
        message: '未知的操作类型'
      }
  }
}

// 获取专业详情
async function getMajorDetail(data) {
  const { majorId } = data
  
  try {
    // 获取专业信息
    const majorResult = await db.collection('majors').doc(majorId).get()
    
    if (!majorResult.data) {
      return {
        code: -1,
        msg: '专业不存在'
      }
    }

    // 获取专业分数线信息
    const scoreResult = await db.collection('scores')
      .where({
        majorId: majorId
      })
      .orderBy('year', 'desc')
      .limit(3)
      .get()

    // 获取专业参考书目
    const bookResult = await db.collection('books')
      .where({
        majorId: majorId
      })
      .get()
    
    return {
      code: 0,
      data: {
        ...majorResult.data,
        scores: scoreResult.data || [],
        books: bookResult.data || []
      }
    }
  } catch (err) {
    console.error('获取专业详情失败：', err)
    return {
      code: -1,
      msg: '获取专业详情失败'
    }
  }
}

// 检查收藏状态
async function checkCollection(data, openid) {
  try {
    const { majorId, schoolId } = data
    const collection = await db.collection('collections')
      .where({
        _openid: openid,
        majorId: majorId,
        schoolId: schoolId
      })
      .get()
    
    return {
      code: 0,
      data: {
        isCollected: collection.data.length > 0
      }
    }
  } catch (err) {
    return {
      code: -1,
      message: '检查收藏状态失败',
      error: err
    }
  }
}

// 切换收藏状态
async function toggleCollection(data, openid) {
  try {
    const { majorId, schoolId } = data
    const collection = await db.collection('collections')
      .where({
        _openid: openid,
        majorId: majorId,
        schoolId: schoolId
      })
      .get()

    if (collection.data.length > 0) {
      // 已收藏，取消收藏
      await db.collection('collections').doc(collection.data[0]._id).remove()
      return {
        code: 0,
        data: {
          isCollected: false
        }
      }
    } else {
      // 未收藏，添加收藏
      await db.collection('collections').add({
        data: {
          _openid: openid,
          majorId: majorId,
          schoolId: schoolId,
          createTime: db.serverDate()
        }
      })
      return {
        code: 0,
        data: {
          isCollected: true
        }
      }
    }
  } catch (err) {
    return {
      code: -1,
      message: '收藏操作失败',
      error: err
    }
  }
}

// 获取收藏列表
async function getCollections(openid) {
  try {
    // 获取收藏记录
    const collections = await db.collection('collections')
      .where({
        _openid: openid
      })
      .orderBy('createTime', 'desc')
      .get()

    // 获取学校和专业信息
    const collectionsWithDetail = await Promise.all(
      collections.data.map(async (collection) => {
        // 获取学校信息
        const schoolResult = await db.collection('schools')
          .doc(collection.schoolId)
          .get()

        // 获取专业信息
        const majorResult = await db.collection('majors')
          .doc(collection.majorId)
          .get()

        return {
          ...collection,
          schoolInfo: schoolResult.data,
          majorInfo: majorResult.data
        }
      })
    )

    return {
      code: 0,
      data: {
        list: collectionsWithDetail
      }
    }
  } catch (err) {
    return {
      code: -1,
      message: '获取收藏列表失败',
      error: err
    }
  }
} 