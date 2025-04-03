const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const { type, data } = event
  console.log('调用forum云函数，类型:', type, '数据:', data)

  switch (type) {
    case 'getPosts':
      return await getPosts(data)
    case 'getPostDetail':
      return await getPostDetail(data)
    case 'likePost':
      return await likePost(data, context)
    case 'commentPost':
      return await commentPost(data, context)
    case 'checkLikeStatus':
      return await checkLikeStatus(data, context)
    default:
      console.error('未知的操作类型:', type)
      return {
        success: false,
        message: '未知的操作类型'
      }
  }
}

// 获取帖子列表
async function getPosts(data) {
  try {
    const { page = 1, pageSize = 10 } = data
    console.log('获取帖子列表, 页码:', page, '每页数量:', pageSize)

    // 分页查询帖子列表
    const posts = await db.collection('posts')
      .orderBy('createTime', 'desc')  // 按发布时间倒序
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    console.log('查询到帖子数量:', posts.data.length)
    return {
      success: true,
      data: posts.data
    }
  } catch (error) {
    console.error('获取帖子列表失败:', error)
    return {
      success: false,
      message: '获取帖子列表失败'
    }
  }
}

// 获取帖子详情
async function getPostDetail(data) {
  try {
    const { id } = data
    if (!id) {
      return {
        success: false,
        message: '帖子ID不能为空'
      }
    }

    console.log('获取帖子详情, ID:', id)
    const post = await db.collection('posts').doc(id).get()
    
    if (!post.data) {
      return {
        success: false,
        message: '帖子不存在'
      }
    }

    return {
      success: true,
      data: post.data
    }
  } catch (error) {
    console.error('获取帖子详情失败:', error)
    return {
      success: false,
      message: '获取帖子详情失败'
    }
  }
}

// 点赞帖子
async function likePost(data, context) {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  console.log('点赞函数调用 - 上下文:', { openid: wxContext.OPENID })
  
  if (!openid) {
    console.error('未获取到用户openid')
    return {
      success: false,
      message: '未获取到用户身份信息'
    }
  }

  try {
    const { id } = data
    if (!id) {
      console.error('帖子ID为空')
      return {
        success: false,
        message: '帖子ID不能为空'
      }
    }

    console.log('点赞/取消点赞帖子, ID:', id, 'OPENID:', openid)
    
    // 检查帖子是否存在
    try {
      const postDoc = await db.collection('posts').doc(id).get()
      if (!postDoc.data) {
        console.error('帖子不存在, ID:', id)
        return {
          success: false,
          message: '帖子不存在'
        }
      }
      console.log('找到帖子:', postDoc.data._id)
    } catch (postError) {
      console.error('查询帖子失败:', postError)
      return {
        success: false,
        message: '帖子不存在或已被删除'
      }
    }
    
    // 检查该用户是否已经点赞过
    let likeRecord = null
    try {
      const likeResult = await db.collection('likes_users').where({
        postId: id,
        openid: openid
      }).get()
      
      likeRecord = likeResult.data && likeResult.data.length > 0 ? likeResult.data[0] : null
      console.log('点赞记录查询结果:', likeRecord ? '已点赞' : '未点赞')
    } catch (likeError) {
      console.error('查询点赞记录失败:', likeError)
      return {
        success: false,
        message: '查询点赞状态失败'
      }
    }
    
    // 如果已经点赞过，则取消点赞
    if (likeRecord) {
      console.log('用户已点赞，执行取消点赞操作, 记录ID:', likeRecord._id)
      
      try {
        // 删除点赞记录
        await db.collection('likes_users').doc(likeRecord._id).remove()
        console.log('删除点赞记录成功')
        
        // 更新帖子的点赞数减1
        await db.collection('posts').doc(id).update({
          data: {
            likes: _.inc(-1)
          }
        })
        console.log('更新帖子点赞数成功 (-1)')
        
        return {
          success: true,
          action: 'unlike',
          message: '取消点赞成功'
        }
      } catch (error) {
        console.error('取消点赞失败:', error)
        return {
          success: false,
          message: '取消点赞失败'
        }
      }
    } 
    // 如果没有点赞过，则添加点赞
    else {
      console.log('用户未点赞，执行点赞操作')
      
      try {
        // 添加点赞记录
        const likeResult = await db.collection('likes_users').add({
          data: {
            postId: id,
            openid: openid,
            createTime: db.serverDate()
          }
        })
        console.log('添加点赞记录成功, ID:', likeResult._id)
        
        // 更新帖子的点赞数加1
        await db.collection('posts').doc(id).update({
          data: {
            likes: _.inc(1)
          }
        })
        console.log('更新帖子点赞数成功 (+1)')
        
        return {
          success: true,
          action: 'like',
          message: '点赞成功'
        }
      } catch (error) {
        console.error('点赞失败:', error)
        return {
          success: false,
          message: '点赞失败'
        }
      }
    }
  } catch (error) {
    console.error('点赞/取消点赞帖子失败:', error)
    return {
      success: false,
      message: '操作失败: ' + error.message
    }
  }
}

// 评论帖子
async function commentPost(data, context) {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  if (!openid) {
    return {
      success: false,
      message: '未获取到用户身份信息'
    }
  }

  try {
    const { id, content } = data
    if (!id) {
      return {
        success: false,
        message: '帖子ID不能为空'
      }
    }

    if (!content || content.trim() === '') {
      return {
        success: false,
        message: '评论内容不能为空'
      }
    }

    console.log('评论帖子, ID:', id, 'OPENID:', openid, '内容:', content)
    
    // 获取用户信息
    const userInfo = await db.collection('users').where({
      _openid: openid
    }).get()

    if (userInfo.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      }
    }

    const user = userInfo.data[0]
    
    // 添加评论
    const comment = {
      postId: id,
      content,
      userInfo: {
        nickName: user.nickName || '匿名用户',
        avatarUrl: user.avatarUrl || '',
        openid
      },
      createTime: db.serverDate()
    }
    
    await db.collection('comments').add({
      data: comment
    })

    // 更新帖子的评论数
    await db.collection('posts').doc(id).update({
      data: {
        comments: _.inc(1)
      }
    })

    return {
      success: true
    }
  } catch (error) {
    console.error('评论帖子失败:', error)
    return {
      success: false,
      message: '评论失败'
    }
  }
}

// 检查点赞状态
async function checkLikeStatus(data, context) {
  const { postIds, openid } = data
  
  console.log('检查点赞状态 - 参数:', { postIdsCount: postIds?.length, openid })
  
  if (!openid || !postIds || !Array.isArray(postIds) || postIds.length === 0) {
    console.error('点赞状态检查 - 参数错误:', { openid, postIds })
    return {
      success: false,
      message: '参数错误'
    }
  }
  
  try {
    console.log('检查点赞状态, 帖子IDs:', postIds, 'OPENID:', openid)
    
    // 查询点赞记录
    const likeRecords = await db.collection('likes_users')
      .where({
        postId: _.in(postIds),
        openid: openid
      })
      .get()
    
    // 提取已点赞的帖子ID
    const likedPostIds = likeRecords.data.map(record => record.postId)
    
    console.log('已点赞的帖子IDs:', likedPostIds)
    
    return {
      success: true,
      data: likedPostIds
    }
  } catch (error) {
    console.error('检查点赞状态失败:', error)
    return {
      success: false,
      message: '检查点赞状态失败: ' + error.message
    }
  }
} 