const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const { type, data } = event
    const wxContext = cloud.getWXContext()
    console.log('云函数入口，获取到的上下文：', wxContext)

    // 在需要用户身份的操作中检查 OPENID
    if (['addPost', 'deletePost', 'toggleLike', 'addComment', 'getMyPosts', 'getLikedPosts'].includes(type)) {
      if (!wxContext.OPENID) {
        console.error('获取用户OPENID失败')
        return {
          success: false,
          message: '请先登录'
        }
      }
    }

    // 根据操作类型执行不同的函数
    switch (type) {
      case 'getPosts':
        return await getPosts(data)
      case 'getPostDetail':
        return await getPostDetail(data, wxContext.OPENID)
      case 'addPost':
        return await addPost(data, wxContext.OPENID)
      case 'deletePost':
        return await deletePost(data, wxContext.OPENID)
      case 'toggleLike':
        return await toggleLike(data, wxContext.OPENID)
      case 'addComment':
        return await addComment(data, wxContext.OPENID)
      case 'getMyPosts':
        return await getMyPosts(data, wxContext.OPENID)
      case 'getLikedPosts':
        return await getLikedPosts(data, wxContext.OPENID)
      case 'checkLikeStatus':
        return await checkLikeStatus(data, wxContext.OPENID)
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
async function getPostDetail(data, openid) {
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
async function toggleLike(data, openid) {
  console.log('点赞函数调用 - 上下文:', { openid })
  
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
async function addComment(data, openid) {
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

    console.log('评论帖子, ID:', postId, 'OPENID:', openid, '内容:', content)
    
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
      postId: postId,
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
    await db.collection('posts').doc(postId).update({
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
async function checkLikeStatus(data, openid) {
  const { postIds } = data
  
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
async function deletePost(data, openid) {
  console.log('删除帖子函数调用 - 上下文:', { openid })
  
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
async function addPost(data, openid) {
  console.log('创建帖子函数调用，用户ID:', openid, '数据:', data)
  
  // 验证参数
  if (!openid) {
    console.error('未获取到用户openid')
    return {
      success: false,
      message: '未获取到用户身份信息'
    }
  }

  const { content, images } = data

  if ((!content || content.trim() === '') && (!images || images.length === 0)) {
    console.error('帖子内容和图片均为空')
    return {
      success: false,
      message: '帖子内容不能为空'
    }
  }

  try {
    // 获取用户信息
    console.log('查询用户信息, openid:', openid)
    const userInfo = await db.collection('users').where({
      _openid: openid
    }).get()

    if (userInfo.data.length === 0) {
      console.error('用户不存在')
      return {
        success: false,
        message: '用户不存在，请先完成注册'
      }
    }

    const user = userInfo.data[0]
    console.log('获取到用户信息:', user.nickName)

    // 创建帖子，添加_openid字段以便正确查询
    const postData = {
      content: content || '',
      images: images || [],
      _openid: openid,  // 添加_openid字段
      userInfo: {
        nickName: user.nickName || '匿名用户',
        avatarUrl: user.avatarUrl || '',
        openid: openid
      },
      createTime: db.serverDate(),
      likes: 0,
      comments: 0
    }
    
    console.log('准备创建帖子，数据:', postData)
    const result = await db.collection('posts').add({
      data: postData
    })
    console.log('帖子创建成功, ID:', result._id)

    return {
      success: true,
      postId: result._id
    }
  } catch (error) {
    console.error('创建帖子失败:', error)
    return {
      success: false,
      message: '创建帖子失败：' + (error.message || '未知错误')
    }
  }
}

// 获取我发布的帖子
async function getMyPosts(data, openid) {
  try {
    const { page = 1, pageSize = 10 } = data
    
    console.log(`获取我的帖子，用户:${openid}, 页码:${page}, 每页数量:${pageSize}`)
    
    // 构建查询条件 - 支持两种数据结构
    // 1. 新版帖子直接用_openid字段
    // 2. 旧版帖子用userInfo.openid字段
    const query = db.collection('posts')
      .where(_.or([
        {
          '_openid': openid  // 查询当前用户发布的帖子（新版数据结构）
        },
        {
          'userInfo.openid': openid  // 查询当前用户发布的帖子（旧版数据结构）
        }
      ]))
      .orderBy('createTime', 'desc')  // 按创建时间倒序
    
    // 获取总数
    const countResult = await query.count()
    const total = countResult.total
    console.log(`用户${openid}的帖子总数: ${total}`)
    
    // 查询帖子
    const skip = (page - 1) * pageSize
    const postsResult = await query.skip(skip).limit(pageSize).get()
    const posts = postsResult.data
    
    console.log(`查询到的帖子:`, posts)
    
    // 获取用户信息
    let userIds = [];
    posts.forEach(post => {
      // 处理两种数据结构
      if (post._openid) {
        userIds.push(post._openid);
      } else if (post.userInfo && post.userInfo.openid) {
        userIds.push(post.userInfo.openid);
      }
    });
    
    userIds = [...new Set(userIds)]; // 去重
    
    let usersMap = {};
    if (userIds.length > 0) {
      const usersResult = await db.collection('users')
        .where({
          _openid: db.command.in(userIds)
        })
        .get()
      
      usersResult.data.forEach(user => {
        usersMap[user._openid] = user
      })
    }
    
    // 处理结果，关联用户信息
    const formattedPosts = posts.map(post => {
      // 针对两种数据结构采用不同处理方式
      if (post.userInfo && post.userInfo.openid) {
        // 已有用户信息的情况
        return post;
      } else {
        // 只有_openid的情况
        const user = usersMap[post._openid] || {}
        return {
          ...post,
          userInfo: {
            _id: user._id || '',
            nickName: user.nickName || '未知用户',
            avatarUrl: user.avatarUrl || '',
            openid: post._openid
          }
        }
      }
    })
    
    return {
      success: true,
      data: formattedPosts,
      total,
      hasMore: total > (page * pageSize)
    }
  } catch (err) {
    console.error('获取我的帖子失败：', err)
    return {
      success: false,
      message: '获取我的帖子失败',
      error: err
    }
  }
}

// 获取我点赞的帖子
async function getLikedPosts(data, openid) {
  try {
    const { page = 1, pageSize = 10 } = data
    
    console.log(`获取我点赞的帖子，用户:${openid}, 页码:${page}, 每页数量:${pageSize}`)
    
    // 先获取用户点赞记录
    const likesResult = await db.collection('likes_users')
      .where({
        openid: openid  // 查询当前用户的点赞记录
      })
      .orderBy('createTime', 'desc')  // 按点赞时间倒序
      .get()
    
    const likes = likesResult.data
    console.log(`获取到点赞记录数量:`, likes.length)
    
    // 获取点赞的帖子ID列表
    const postIds = likes.map(like => like.postId)
    
    if (postIds.length === 0) {
      return {
        success: true,
        data: [],
        total: 0,
        hasMore: false
      }
    }
    
    // 分页计算
    const startIndex = (page - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, postIds.length)
    const currentPagePostIds = postIds.slice(startIndex, endIndex)
    
    if (currentPagePostIds.length === 0) {
      return {
        success: true,
        data: [],
        total: postIds.length,
        hasMore: false
      }
    }
    
    // 查询帖子
    const postsResult = await db.collection('posts')
      .where({
        _id: db.command.in(currentPagePostIds)
      })
      .get()
    
    const posts = postsResult.data
    console.log(`查询到的帖子数量:`, posts.length)
    
    // 根据点赞时间排序
    const postsMap = {}
    posts.forEach(post => {
      postsMap[post._id] = post
    })
    
    const sortedPosts = currentPagePostIds
      .map(id => postsMap[id])
      .filter(post => post); // 过滤掉已删除的帖子
    
    // 获取用户信息
    let userIds = [];
    sortedPosts.forEach(post => {
      // 处理两种数据结构
      if (post._openid) {
        userIds.push(post._openid);
      } else if (post.userInfo && post.userInfo.openid) {
        userIds.push(post.userInfo.openid);
      }
    });
    
    userIds = [...new Set(userIds)]; // 去重
    console.log(`需要查询的用户IDs:`, userIds)
    
    let usersMap = {};
    if (userIds.length > 0) {
      const usersResult = await db.collection('users')
        .where({
          _openid: db.command.in(userIds)
        })
        .get()
      
      console.log(`查询到的用户数量:`, usersResult.data.length)
      usersResult.data.forEach(user => {
        usersMap[user._openid] = user
      })
    }
    
    // 处理结果，关联用户信息
    const formattedPosts = sortedPosts.map(post => {
      // 针对两种数据结构采用不同处理方式
      if (post.userInfo && post.userInfo.openid && post.userInfo.nickName && post.userInfo.avatarUrl) {
        // 已有完整用户信息的情况
        return post;
      } else if (post.userInfo && post.userInfo.openid) {
        // 有部分用户信息的情况，补充完整
        const user = usersMap[post.userInfo.openid] || {}
        return {
          ...post,
          userInfo: {
            ...post.userInfo,
            _id: user._id || post.userInfo._id || '',
            nickName: user.nickName || post.userInfo.nickName || '未知用户',
            avatarUrl: user.avatarUrl || post.userInfo.avatarUrl || ''
          }
        }
      } else {
        // 只有_openid的情况
        const user = usersMap[post._openid] || {}
        return {
          ...post,
          userInfo: {
            _id: user._id || '',
            nickName: user.nickName || '未知用户',
            avatarUrl: user.avatarUrl || '',
            openid: post._openid
          }
        }
      }
    })
    
    return {
      success: true,
      data: formattedPosts,
      total: postIds.length,
      hasMore: endIndex < postIds.length
    }
  } catch (err) {
    console.error('获取我点赞的帖子失败：', err)
    return {
      success: false,
      message: '获取我点赞的帖子失败',
      error: err
    }
  }
} 