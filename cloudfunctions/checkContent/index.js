// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 检查是否传入了内容
    if (!event.content) {
      return {
        success: false,
        errCode: -1,
        errMsg: '内容不能为空'
      }
    }

    // 调用微信官方提供的内容安全检测接口
    const result = await cloud.openapi.security.msgSecCheck({
      content: event.content,
      version: 2, // 使用版本2的API
      scene: 2, // 场景值，2代表社区论坛
      openid: event.userInfo.openId // 用户的openid
    })

    // 结果处理
    if (result && result.result && result.result.suggest === 'risky') {
      // 内容可能包含敏感信息
      return {
        success: false,
        errCode: 87014, // 微信官方敏感词错误码
        errMsg: '内容含有敏感词',
        detail: result.result.label // 返回具体的敏感词类型
      }
    }

    // 检测通过
    return {
      success: true,
      errCode: 0,
      errMsg: 'OK'
    }
  } catch (err) {
    // 错误处理
    return {
      success: false,
      errCode: err.errCode || -1,
      errMsg: err.errMsg || err.message || '内容检测失败'
    }
  }
} 