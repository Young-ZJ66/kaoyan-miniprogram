const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 消息集合
const messageCollection = db.collection('chat_messages')
// 在线用户集合
const onlineCollection = db.collection('online_users')

exports.main = async (event, context) => {
  const { type, data } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  switch (type) {
    case 'getMessages':
      return await getMessages(data)
    case 'sendMessage':
      return await sendMessage(openid, data)
    case 'getOnlineCount':
      return await getOnlineCount()
    case 'leaveChat':
      return await leaveChat(openid)
    default:
      return {
        success: false,
        message: '未知的操作类型'
      }
  }
}

// 获取消息列表
async function getMessages({ page, pageSize }) {
  try {
    const skip = (page - 1) * pageSize
    const messages = await messageCollection
      .orderBy('createdAt', 'desc') // 按时间倒序获取最新的消息
      .skip(skip)
      .limit(pageSize)
      .get()

    // 处理消息数据，确保时间格式正确
    const formattedMessages = messages.data.map(msg => ({
      ...msg,
      createdAt: msg.createdAt || msg.serverTime.getTime() // 优先使用客户端时间戳，如果没有则使用服务器时间
    }))

    // 按照时间正序（从旧到新）返回数据
    formattedMessages.sort((a, b) => a.createdAt - b.createdAt)

    return {
      success: true,
      data: formattedMessages
    }
  } catch (err) {
    return {
      success: false,
      message: '获取消息列表失败'
    }
  }
}

// 发送消息
async function sendMessage(openid, { content, userInfo }) {
  try {
    // 获取当前时间戳
    const timestamp = Date.now()
    
    // 只保存必要的用户信息
    const messageData = {
      content,
      openid: openid,
      avatarUrl: userInfo.avatarUrl,
      nickName: userInfo.nickName,
      createdAt: timestamp, // 直接使用时间戳
      serverTime: db.serverDate() // 同时保存服务器时间
    }

    // 创建消息
    const result = await messageCollection.add({
      data: messageData
    })

    return {
      success: true,
      data: {
        _id: result._id,
        ...messageData,
        createdAt: timestamp
      }
    }
  } catch (err) {
    return {
      success: false,
      message: '发送消息失败'
    }
  }
}

// 获取在线人数
async function getOnlineCount() {
  try {
    const count = await onlineCollection.count()
    return {
      success: true,
      data: count.total
    }
  } catch (err) {
    return {
      success: false,
      message: '获取在线人数失败'
    }
  }
}

// 离开聊天室
async function leaveChat(openid) {
  try {
    await onlineCollection.where({
      openid
    }).remove()
    return {
      success: true
    }
  } catch (err) {
    return {
      success: false,
      message: '更新在线状态失败'
    }
  }
}

// 获取用户信息
async function getUserInfo(openid) {
  try {
    const userInfo = await db.collection('users').where({
      openid
    }).get()
    
    if (userInfo.data.length > 0) {
      return userInfo.data[0]
    }
    
    // 如果用户不存在，返回默认信息
    return {
      openid,
      nickName: '匿名用户',
      avatarUrl: '/images/default-avatar.png'
    }
  } catch (err) {
    return {
      openid,
      nickName: '匿名用户',
      avatarUrl: '/images/default-avatar.png'
    }
  }
} 