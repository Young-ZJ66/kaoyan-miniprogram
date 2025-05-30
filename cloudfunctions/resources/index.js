const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 初始化数据库
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const { type, data } = event
    const wxContext = cloud.getWXContext()
    

    // 在需要用户身份的操作中检查 OPENID
    if (['recordDownload', 'add', 'upload', 'update'].includes(type)) {
      if (!wxContext.OPENID) {
        console.error('获取用户OPENID失败')
        return {
          success: false,
          message: '请先登录'
        }
      }
    }

    switch (type) {
      case 'getList':
        return await getList(data)
      case 'getDetail':
        return await getDetail(data)
      case 'upload':
      case 'add':
        return await addResource(data, wxContext.OPENID)
      case 'update':
        return await updateResource(data)
      case 'download':
        return await updateDownloadCount(data)
      case 'incrementDownloads':
        return await updateDownloadCount(data)
      case 'recordDownload':
        return await recordDownload(data, wxContext.OPENID)
      case 'delete':
        return await deleteResource(data, wxContext.OPENID)
      default:
        return {
          success: false,
          message: '未知的操作类型'
        }
    }
  } catch (err) {
    console.error('云函数执行失败：', err)
    return {
      success: false,
      message: '云函数执行失败',
      error: err
    }
  }
}

// 获取资料列表
async function getList(data) {
  try {
    const { category, keyword, page = 1, pageSize = 5 } = data
    let query = db.collection('resources')
    let conditions = {}

    // 添加分类筛选
    if (category && category !== 'all') {
      conditions.category = category
    }

    // 添加关键词搜索
    if (keyword) {
      conditions.title = db.RegExp({
        regexp: keyword,
        options: 'i'
      })
    }

    // 应用所有查询条件
    query = query.where(conditions)

    // 获取总数
    const countResult = await query.count()
    const total = countResult.total

    // 按创建时间倒序排序并进行分页
    query = query.orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)

    const res = await query.get()
    return {
      success: true,
      data: res.data,
      total,
      hasMore: total > page * pageSize
    }
  } catch (err) {
    console.error('获取资料列表失败：', err)
    return {
      success: false,
      message: '获取资料列表失败'
    }
  }
}

// 获取资料详情
async function getDetail(data) {
  try {
    const { id } = data
    const res = await db.collection('resources').doc(id).get()
    
    if (!res.data) {
      return {
        success: false,
        message: '未找到资源'
      }
    }

    // 处理数据
    const resourceData = {
      ...res.data,
      size: res.data.size || '未知大小',
      downloads: res.data.downloads || 0,
      description: res.data.description || '暂无描述',
      uploaderNickName: res.data.uploaderNickName || '未知用户',
      fileName: res.data.fileName || '未命名文件'
    }

    return {
      success: true,
      data: resourceData
    }
  } catch (err) {
    console.error('获取资料详情失败：', err)
    return {
      success: false,
      message: '获取资料详情失败'
    }
  }
}

// 格式化文件大小
function formatFileSize(size) {
  // 确保 size 是数字
  const fileSize = parseInt(size) || 0
  
  if (fileSize < 1024) {
    return fileSize + 'B'
  } else if (fileSize < 1024 * 1024) {
    return (fileSize / 1024).toFixed(2) + 'KB'
  } else if (fileSize < 1024 * 1024 * 1024) {
    return (fileSize / (1024 * 1024)).toFixed(2) + 'MB'
  } else {
    return (fileSize / (1024 * 1024 * 1024)).toFixed(2) + 'GB'
  }
}

// 上传资源
async function uploadResource(data, openid) {
  const { title, category, size, fileID, description, nickName } = data
  try {
    
    

    if (!openid) {
      console.error('获取用户OPENID失败')
      return {
        success: false,
        message: '获取用户信息失败'
      }
    }

    // 从 users 集合中获取用户信息
    const userResult = await db.collection('users')
      .where({
        _openid: openid
      })
      .get()
    
    
    
    let uploaderNickName = '未知用户'
    if (userResult.data && userResult.data.length > 0) {
      uploaderNickName = userResult.data[0].nickName || nickName || '未知用户'
    }

    // 添加资源记录
    const resourceData = {
      title,
      category,
      size: data.size,  // 直接使用小程序端传来的格式化后的大小
      rawSize: data.rawSize,  // 保存原始大小（字节）
      fileID,
      fileName: data.fileName,  // 保存文件名
      description,
      downloads: 0,
      _openid: openid,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),  // 添加更新时间，与创建时间相同
      uploaderNickName
    }
    

    const result = await db.collection('resources').add({
      data: resourceData
    })
    

    // 验证记录是否成功添加
    const verifyResult = await db.collection('resources').doc(result._id).get()
    

    return {
      success: true,
      data: result
    }
  } catch (err) {
    console.error('上传资料失败：', err)
    return {
      success: false,
      message: '上传失败',
      error: err
    }
  }
}

// 更新下载次数
async function updateDownloadCount(data) {
  try {
    const { id } = data
    

    // 更新下载次数
    await db.collection('resources').doc(id).update({
      data: {
        downloads: _.inc(1)
      }
    })
    

    return {
      success: true,
      message: '更新下载次数成功'
    }
  } catch (err) {
    console.error('更新下载次数失败，详细错误：', err)
    return {
      success: false,
      message: '更新下载次数失败',
      error: err
    }
  }
}

// 记录下载历史
async function recordDownload(data, openid) {
  try {
    const { id } = data
    
    

    if (!openid) {
      console.error('获取用户OPENID失败')
      return {
        success: false,
        message: '获取用户信息失败'
      }
    }

    // 获取资源信息
    const resource = await db.collection('resources').doc(id).get()
    

    if (!resource.data) {
      console.error('未找到资源信息')
      return {
        success: false,
        message: '未找到资源信息'
      }
    }

    // 记录下载历史
    const downloadRecord = {
      resourceId: id,
      title: resource.data.title,
      category: resource.data.category,
      _openid: openid,
      createdAt: db.serverDate()
    }
    

    const downloadResult = await db.collection('downloads').add({
      data: downloadRecord
    })
    

    return {
      success: true,
      data: downloadResult
    }
  } catch (err) {
    console.error('记录下载历史失败，详细错误：', err)
    return {
      success: false,
      message: '记录下载历史失败',
      error: err
    }
  }
}

// 删除资源
async function deleteResource(data, openid) {
  try {
    const { id } = data
    
    

    if (!openid) {
      console.error('获取用户OPENID失败')
      return {
        success: false,
        message: '获取用户信息失败'
      }
    }

    // 检查资源是否存在且是否为当前用户上传
    const resource = await db.collection('resources').doc(id).get()
    if (!resource.data) {
      return {
        success: false,
        message: '资源不存在'
      }
    }

    if (resource.data._openid !== openid) {
      return {
        success: false,
        message: '无权删除该资源'
      }
    }

    // 删除云存储中的文件
    if (resource.data.fileID) {
      try {
        await cloud.deleteFile({
          fileList: [resource.data.fileID]
        })
        
      } catch (err) {
        console.error('删除云存储文件失败：', err)
      }
    }

    // 删除资源记录
    const result = await db.collection('resources').doc(id).remove()
    

    return {
      success: true,
      data: result
    }
  } catch (err) {
    console.error('删除资源失败：', err)
    return {
      success: false,
      message: '删除失败',
      error: err
    }
  }
}

// 添加资源
async function addResource(data, openid) {
  
  
  
  try {
    // 验证必要字段
    if (!data.title || !data.fileID) {
      return {
        success: false,
        message: '缺少必要信息'
      }
    }

    return await uploadResource(data, openid)
  } catch (err) {
    console.error('添加资源失败：', err)
    return {
      success: false,
      message: '添加资源失败',
      error: err
    }
  }
}

// 更新资源
async function updateResource(data) {
  try {
    const { id, title, category, description, fileID, fileName, size, rawSize } = data;
    ;

    // 获取当前资源信息
    const currentResource = await db.collection('resources')
      .doc(id)
      .get();
    
    if (!currentResource.data) {
      return {
        success: false,
        message: '资源不存在'
      };
    }

    // 构建更新数据
    const updateData = {
      title,
      description,
      category,
      updatedAt: db.serverDate()
    };

    // 只有在上传了新文件时，才处理文件相关的更新
    if (fileID && fileID !== currentResource.data.fileID) {
      // 删除旧文件
      if (currentResource.data.fileID) {
        try {
          await cloud.deleteFile({
            fileList: [currentResource.data.fileID]
          });
          ;
        } catch (err) {
          console.error('删除旧文件失败：', err);
        }
      }
      
      // 添加新文件相关字段
      updateData.fileID = fileID;
      updateData.fileName = fileName;
      updateData.size = size;  // 使用格式化后的大小
      updateData.rawSize = rawSize;  // 保存原始大小
    }

    // 更新资源信息
    const result = await db.collection('resources')
      .doc(id)
      .update({
        data: updateData
      });

    return {
      success: true,
      data: result
    };
  } catch (err) {
    console.error('更新资源失败：', err);
    return {
      success: false,
      message: '更新资源失败：' + err.message
    };
  }
} 