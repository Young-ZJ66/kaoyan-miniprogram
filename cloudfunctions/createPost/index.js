const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { content, images } = event

  console.log('收到创建帖子请求：', {
    openid: wxContext.OPENID,
    contentLength: content?.length || 0,
    imagesCount: images?.length || 0
  })

  // 验证参数
  if (!wxContext.OPENID) {
    console.error('创建帖子失败：未获取到用户openid')
    return {
      success: false,
      message: '未获取到用户身份信息'
    }
  }

  if ((!content || content.trim() === '') && (!images || images.length === 0)) {
    console.error('创建帖子失败：帖子内容和图片均为空')
    return {
      success: false,
      message: '帖子内容不能为空'
    }
  }

  try {
    // 获取用户信息
    console.log('开始查询用户信息，openid:', wxContext.OPENID)
    const userInfo = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get()

    console.log('查询到用户信息结果:', userInfo.data)

    if (userInfo.data.length === 0) {
      console.error('创建帖子失败：用户不存在')
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
    
    console.log('准备创建帖子数据:', postData)
    const result = await db.collection('posts').add({
      data: postData
    })
    
    console.log('帖子创建成功, ID:', result._id)

    return {
      success: true,
      postId: result._id
    }
  } catch (error) {
    console.error('创建帖子失败：', error)
    return {
      success: false,
      message: '创建帖子失败：' + (error.message || '未知错误')
    }
  }
} 