// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const { type, data } = event

  switch (type) {
    case 'getSchools':
      return getSchools(data)
    case 'getSchoolDetail':
      return getSchoolDetail(data)
    case 'searchSchoolsByMajor':
      return searchSchoolsByMajor(data)
    default:
      return {
        code: -1,
        msg: '未知操作类型'
      }
  }
}

// 获取院校列表
async function getSchools(data) {
  const { keyword, region, level, page = 1, pageSize = 10 } = data
  
  try {
    // 构建查询条件
    let query = {}
    
    // 关键词搜索
    if (keyword) {
      query.name = db.RegExp({
        regexp: keyword,
        options: 'i'
      })
    }
    
    // 地区筛选
    if (region) {
      query.region = region
    }
    
    // 层次筛选
    if (level) {
      if (level === '双非') {
        // 双非院校：既不是985也不是211
        query.level = _.nin(['985', '211'])
      } else {
        // 其他层次：包含该层次的院校
        query.level = level
      }
    }
    
    // 获取总数
    const countResult = await db.collection('schools').where(query).count()
    const total = countResult.total
    
    // 获取列表
    const list = await db.collection('schools')
      .where(query)
      .orderBy('_id', 'asc')  // 按 _id 升序排序
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    return {
      code: 0,
      data: {
        list: list.data,
        total,
        hasMore: total > page * pageSize
      }
    }
  } catch (err) {
    console.error('获取院校列表失败：', err)
    return {
      code: -1,
      msg: '获取院校列表失败'
    }
  }
}

// 获取院校详情
async function getSchoolDetail(data) {
  const { schoolId } = data
  
  try {
    // 获取院校信息
    const schoolResult = await db.collection('schools').doc(schoolId).get()
    
    if (!schoolResult.data) {
      return {
        code: -1,
        msg: '院校不存在'
      }
    }
    
    return {
      code: 0,
      data: schoolResult.data
    }
  } catch (err) {
    console.error('获取院校详情失败：', err)
    return {
      code: -1,
      msg: '获取院校详情失败'
    }
  }
}

// 按专业搜索院校
async function searchSchoolsByMajor(data) {
  const { majorName, majorCode, degreeType, page = 1, pageSize = 10 } = data
  
  try {
    // 查询条件
    const query = {}
    
    if (majorName && majorName.trim() !== '') {
      query.name = db.RegExp({
        regexp: majorName,
        options: 'i'
      })
    }
    
    if (majorCode && majorCode.trim() !== '') {
      query.code = majorCode
    }
    
    if (degreeType && degreeType !== '') {
      query.degreeType = degreeType
    }
    
    // 查询符合条件的专业
    const majorsResult = await db.collection('majors')
      .where(query)
      .get()
    
    // 提取院校ID
    const schoolIds = [...new Set(majorsResult.data.map(item => item.schoolId))]
    
    // 查询院校信息
    const schools = []
    
    // 分批次查询院校信息
    const batchSize = 20 // 一次最多查询20个ID
    
    for (let i = 0; i < schoolIds.length; i += batchSize) {
      const batchIds = schoolIds.slice(i, i + batchSize)
      
      const schoolsResult = await db.collection('schools')
        .where({
          _id: _.in(batchIds)
        })
        .get()
      
      schools.push(...schoolsResult.data)
    }
    
    // 分页处理
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const pagedSchools = schools.slice(startIndex, endIndex)
    
    return {
      code: 0,
      data: {
        list: pagedSchools,
        total: schools.length,
        page,
        pageSize,
        hasMore: endIndex < schools.length
      }
    }
  } catch (err) {
    console.error('按专业搜索院校失败：', err)
    return {
      code: -1,
      msg: '按专业搜索院校失败'
    }
  }
} 