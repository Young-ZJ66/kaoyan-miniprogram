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
    case 'deletePost':
      return await deletePost(data, context)
    case 'createPost':
      return await createPost(data, context)
    case 'addComment':
      return await addComment(data, context)
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

// 删除帖子
async function deletePost(data, context) {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  console.log('删除帖子函数调用 - 上下文:', { openid: wxContext.OPENID })
  
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

    console.log('准备删除帖子, ID:', id, 'OPENID:', openid)
    
    // 检查帖子是否存在且是否为该用户发布的
    let post = null
    try {
      const postDoc = await db.collection('posts').doc(id).get()
      post = postDoc.data
      
      if (!post) {
        console.error('帖子不存在, ID:', id)
        return {
          success: false,
          message: '帖子不存在'
        }
      }
      
      // 验证帖子是否为当前用户发布的
      // 判断依据：检查 _openid 字段或 userInfo.openid 字段
      const postOpenid = post._openid || (post.userInfo && post.userInfo.openid)
      
      console.log('帖子发布者openid:', postOpenid, '当前用户openid:', openid)
      
      if (!postOpenid || postOpenid !== openid) {
        console.error('无权删除他人帖子, 帖子发布者:', postOpenid, '当前用户:', openid)
        return {
          success: false,
          message: '您没有权限删除此帖子'
        }
      }
      
      console.log('找到帖子并验证权限通过:', post._id)
    } catch (postError) {
      console.error('查询帖子失败:', postError)
      return {
        success: false,
        message: '帖子不存在或已被删除'
      }
    }
    
    // 开始删除操作
    const transaction = await db.startTransaction()
    
    try {
      // 1. 删除帖子相关的点赞记录
      await transaction.collection('likes_users').where({
        postId: id
      }).remove()
      console.log('已删除帖子相关的点赞记录')
      
      // 2. 删除帖子相关的评论
      await transaction.collection('comments').where({
        postId: id
      }).remove()
      console.log('已删除帖子相关的评论')
      
      // 3. 删除帖子本身
      await transaction.collection('posts').doc(id).remove()
      console.log('已删除帖子本身')
      
      // 4. 如果帖子有图片，删除云存储中的图片
      if (post.images && post.images.length > 0) {
        try {
          console.log('准备删除帖子图片，图片列表:', post.images)
          
          // 云函数中删除文件需要处理文件路径
          const fileIDs = []
          for (const imageUrl of post.images) {
            // 检查图片URL的格式
            if (typeof imageUrl !== 'string') {
              console.error('无效的图片URL格式:', imageUrl)
              continue
            }
            
            let fileID = imageUrl
            // 如果图片URL已经是cloud://开头的文件ID格式，直接使用
            if (!imageUrl.startsWith('cloud://')) {
              console.error('图片URL不是cloud://格式，无法删除:', imageUrl)
              continue
            }
            
            fileIDs.push(fileID)
          }
          
          if (fileIDs.length > 0) {
            console.log('将删除以下文件:', fileIDs)
            const deleteResult = await cloud.deleteFile({
              fileList: fileIDs
            })
            
            console.log('删除图片结果:', deleteResult)
            
            // 检查删除结果
            if (deleteResult.fileList) {
              deleteResult.fileList.forEach(file => {
                if (file.status !== 0) {
                  console.error('删除图片失败:', file.fileID, file.errMsg)
                } else {
                  console.log('成功删除图片:', file.fileID)
                }
              })
            }
          } else {
            console.log('没有找到有效的文件ID，跳过删除图片步骤')
          }
        } catch (fileError) {
          console.error('删除图片过程中出错:', fileError)
          // 图片删除失败不影响整体事务
        }
      } else {
        console.log('帖子没有图片，跳过删除图片步骤')
      }
      
      // 提交事务
      await transaction.commit()
      
      return {
        success: true,
        message: '帖子删除成功'
      }
    } catch (error) {
      // 如果出错，回滚事务
      await transaction.rollback()
      console.error('删除帖子失败:', error)
      return {
        success: false,
        message: '删除帖子失败'
      }
    }
  } catch (error) {
    console.error('删除帖子操作失败:', error)
    return {
      success: false,
      message: '操作失败'
    }
  }
}

// 创建帖子
async function createPost(data, context) {
  const wxContext = cloud.getWXContext()
  const { content, images } = data

  // 验证参数
  if (!wxContext.OPENID) {
    return {
      success: false,
      message: '未获取到用户身份信息'
    }
  }

  if ((!content || content.trim() === '') && (!images || images.length === 0)) {
    return {
      success: false,
      message: '帖子内容不能为空'
    }
  }

  try {
    // 获取用户信息
    const userInfo = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get()

    if (userInfo.data.length === 0) {
      return {
        success: false,
        message: '用户不存在，请先完成注册'
      }
    }

    const user = userInfo.data[0]

    // 创建帖子
    const postData = {
      content: content || '',
      images: images || [],
      userInfo: {
        nickName: user.nickName || '匿名用户',
        avatarUrl: user.avatarUrl || '',
        openid: wxContext.OPENID
      },
      createTime: db.serverDate(),
      likes: 0,
      comments: 0
    }
    
    const result = await db.collection('posts').add({
      data: postData
    })

    return {
      success: true,
      postId: result._id
    }
  } catch (error) {
    return {
      success: false,
      message: '创建帖子失败：' + (error.message || '未知错误')
    }
  }
}

// 添加评论
async function addComment(data, context) {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  if (!openid) {
    return {
      success: false,
      message: '未获取到用户身份信息'
    }
  }

  try {
    const { postId, content } = data
    
    if (!postId) {
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
    
    // 检查帖子是否存在
    try {
      const postDoc = await db.collection('posts').doc(postId).get()
      if (!postDoc.data) {
        return {
          success: false,
          message: '帖子不存在'
        }
      }
    } catch (postError) {
      return {
        success: false,
        message: '帖子不存在或已被删除'
      }
    }
    
    // 获取用户信息
    let userInfo = null
    try {
      const userResult = await db.collection('users').where({
        _openid: openid
      }).get()
      
      if (userResult.data.length === 0) {
        return {
          success: false,
          message: '用户信息不存在'
        }
      }
      
      userInfo = userResult.data[0]
    } catch (userError) {
      return {
        success: false,
        message: '获取用户信息失败'
      }
    }
    
    // 添加评论
    try {
      const result = await db.collection('comments').add({
        data: {
          postId,
          content: content.trim(),
          userInfo: {
            _openid: openid,
            nickName: userInfo.nickName || '匿名用户',
            avatarUrl: userInfo.avatarUrl || ''
          },
          createTime: db.serverDate()
        }
      })
      
      // 更新帖子评论数
      await db.collection('posts').doc(postId).update({
        data: {
          comments: _.inc(1)
        }
      })
      
      return {
        success: true,
        commentId: result._id
      }
    } catch (addError) {
      return {
        success: false,
        message: '添加评论失败'
      }
    }
  } catch (error) {
    return {
      success: false,
      message: '评论失败: ' + error.message
    }
  }
} 