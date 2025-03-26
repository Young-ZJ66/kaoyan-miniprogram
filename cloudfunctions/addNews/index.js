const cloud = require('wx-server-sdk')
cloud.init({
  env: 'cloud1-9gbyqyqyb5f2cb69'
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { title, content, coverImage } = event
  
  try {
    const result = await db.collection('news').add({
      data: {
        title,
        content,
        coverImage,
        createTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      data: result
    }
  } catch (err) {
    return {
      success: false,
      message: err.message
    }
  }
} 