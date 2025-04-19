const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-9gbyqyqyb5f2cb69'
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 获取当前日期
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()
    
    // 获取大于等于今天的最近一个倒计时日期
    // 现在countdown_day存储的是时间戳，直接比较数值
    const result = await db.collection('countdown_days')
      .where({
        countdown_day: _.gte(todayTimestamp)
      })
      .orderBy('countdown_day', 'asc')
      .limit(1)
      .get()
    
    if (result.data.length === 0) {
      return {
        success: false,
        message: '未找到倒计时信息'
      }
    }

    const countdownInfo = result.data[0]
    
    // 计算剩余天数 - 使用时间戳计算
    const countdownTimestamp = countdownInfo.countdown_day
    const timeDiff = countdownTimestamp - todayTimestamp
    const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
    
    // 处理时区问题：时间戳是UTC时间，需要转换为本地时间
    // 创建一个新的日期对象，并设置其为中国时区（东八区，UTC+8）
    const countdownDate = new Date(countdownTimestamp)
    // 时区偏移量 (分钟)
    const timeZoneOffset = 480; // 东八区 = 8 * 60 分钟
    
    // 调整为东八区时间
    const localTime = new Date(countdownTimestamp + timeZoneOffset * 60 * 1000)
    
    const year = localTime.getUTCFullYear()
    const month = String(localTime.getUTCMonth() + 1).padStart(2, '0')
    const day = String(localTime.getUTCDate()).padStart(2, '0')
    const formattedDate = `${year}-${month}-${day}`
    
    // 计算后一天的日期
    const nextDayTimestamp = countdownTimestamp + (24 * 60 * 60 * 1000)
    // 同样调整为东八区时间
    const nextDayLocal = new Date(nextDayTimestamp + timeZoneOffset * 60 * 1000)
    
    const nextYear = nextDayLocal.getUTCFullYear()
    const nextMonth = String(nextDayLocal.getUTCMonth() + 1).padStart(2, '0')
    const nextDayDate = String(nextDayLocal.getUTCDate()).padStart(2, '0')
    const formattedNextDay = `${nextYear}-${nextMonth}-${nextDayDate}`
    
    // 打印调试信息
    console.log('倒计时日期时间戳:', countdownTimestamp)
    console.log('转换后的日期:', formattedDate)
    console.log('下一天日期:', formattedNextDay)
    
    return {
      success: true,
      data: {
        _id: countdownInfo._id,
        countdownDay: formattedDate,
        nextDay: formattedNextDay,
        daysRemaining: daysRemaining,
        year: year.toString(),
        shortYear: (year % 100 + 1).toString() // 年份+1，取最后两位，如2025年返回26
      }
    }
  } catch (err) {
    console.error('获取倒计时信息失败：', err)
    return {
      success: false,
      message: '获取倒计时信息失败：' + err.message
    }
  }
} 