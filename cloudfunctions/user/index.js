const cloud = require('wx-server-sdk');
cloud.init({
  env: 'cloud1-9gbyqyqyb5f2cb69'
});

const db = cloud.database();
const userCollection = db.collection('users');

// 云函数入口函数
exports.main = async (event, context) => {
  const { type, data } = event;
  
  if (!type) {
    return {
      success: false,
      message: '缺少操作类型'
    };
  }
  
  if (!data) {
    return {
      success: false,
      message: '缺少数据参数'
    };
  }
  
  switch (type) {
    case 'login':
      return handleLogin(data);
    case 'updateUserInfo':
      return handleUpdateUserInfo(data);
    case 'getUserInfo':
      return handleGetUserInfo(data);
    default:
      return {
        success: false,
        message: '未知的操作类型'
      };
  }
};

// 处理登录
async function handleLogin(data) {
  const { openid } = data;
  
  if (!openid) {
    return {
      success: false,
      message: '缺少openid'
    };
  }
  
  try {
    // 查询用户是否存在
    const user = await userCollection.where({
      _openid: openid
    }).get();
    
    if (user.data.length === 0) {
      // 用户不存在，创建新用户
      const result = await userCollection.add({
        data: {
          _openid: openid,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
      
      return {
        success: true,
        data: {
          _id: result._id,
          _openid: openid
        }
      };
    } else {
      // 用户已存在
      return {
        success: true,
        data: user.data[0]
      };
    }
  } catch (err) {
    console.error('登录失败：', err);
    return {
      success: false,
      message: '登录失败：' + err.message
    };
  }
}

// 更新用户信息
async function handleUpdateUserInfo(data) {
  const { openid, userInfo } = data;
  
  if (!openid || !userInfo) {
    return {
      success: false,
      message: '缺少必要参数'
    };
  }
  
  try {
    const result = await userCollection.where({
      _openid: openid
    }).update({
      data: {
        ...userInfo,
        updateTime: db.serverDate()
      }
    });
    
    if (result.stats.updated === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    return {
      success: true,
      data: result
    };
  } catch (err) {
    console.error('更新用户信息失败：', err);
    return {
      success: false,
      message: '更新用户信息失败：' + err.message
    };
  }
}

// 获取用户信息
async function handleGetUserInfo(data) {
  const { openid } = data;
  
  if (!openid) {
    return {
      success: false,
      message: '缺少openid'
    };
  }
  
  try {
    const user = await userCollection.where({
      _openid: openid
    }).get();
    
    if (user.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    return {
      success: true,
      data: user.data[0]
    };
  } catch (err) {
    console.error('获取用户信息失败：', err);
    return {
      success: false,
      message: '获取用户信息失败：' + err.message
    };
  }
} 