const app = getApp()

Page({
  data: {
    messages: [],
    inputMessage: '',
    scrollToMessage: '',
    loading: false,
    userInfo: null,
    lastMessageId: '',
    messageListener: null,
    page: 1,
    pageSize: 10,
    hasMore: true,
    keyboardHeight: 0
  },

  onLoad: function() {
    if (!wx.cloud) {
      return
    }

    // 监听键盘高度变化
    wx.onKeyboardHeightChange(res => {
      this.setData({
        keyboardHeight: res.height
      })
    })

    // 先获取openid
    wx.cloud.callFunction({
      name: 'getOpenId'
    }).then(res => {
      const openid = res.result.openid

      // 获取用户信息
      const userInfo = wx.getStorageSync('userInfo')
      if (userInfo) {
        // 确保userInfo中包含正确的openid
        userInfo.openid = openid
        wx.setStorageSync('userInfo', userInfo)
        this.setData({
          userInfo: userInfo
        }, () => {
          this.loadMessages()
          this.startMessageListener()
        })
      } else {
        wx.getUserProfile({
          desc: '用于完善用户资料',
          success: (res) => {
            const userInfo = {
              ...res.userInfo,
              openid: openid
            }
            wx.setStorageSync('userInfo', userInfo)
            this.setData({
              userInfo: userInfo
            }, () => {
              this.loadMessages()
              this.startMessageListener()
            })
          },
          fail: (err) => {
            wx.showToast({
              title: '获取用户信息失败',
              icon: 'none'
            })
          }
        })
      }
    }).catch(err => {
      wx.showToast({
        title: '获取用户信息失败',
        icon: 'none'
      })
    })
  },

  // 启动消息监听
  startMessageListener: function() {
    const db = wx.cloud.database()
    const _ = db.command
    
    // 先确保之前的监听已经停止
    this.stopMessageListener()
    
    try {
      // 创建消息监听器，监听比当前时间新的消息
      const now = new Date().getTime()
      const listener = db.collection('chat_messages')
        .where({
          createTime: _.gt(now) // 只监听新消息
        })
        .watch({
          onChange: (snapshot) => {
            if (snapshot.docs && snapshot.docs.length > 0) {
              const newMessages = snapshot.docs.map(doc => {
                const isMyMessage = this.data.userInfo.openid === doc.openid
                return {
                  ...doc,
                  createTime: this.formatTime(doc.createTime),
                  timestamp: doc.createTime,
                  isMyMessage: isMyMessage
                }
              })
              
              // 过滤掉已经存在的消息
              const existingIds = this.data.messages.map(msg => msg._id)
              const uniqueNewMessages = newMessages.filter(msg => !existingIds.includes(msg._id))
              
              if (uniqueNewMessages.length > 0) {
                // 将新消息添加到消息列表末尾
                this.setData({
                  messages: [...this.data.messages, ...uniqueNewMessages],
                  scrollToMessage: `msg-${uniqueNewMessages[uniqueNewMessages.length - 1]._id}`
                })
              }
            }
          },
          onError: (err) => {
            console.error('消息监听失败:', err)
            wx.showToast({
              title: '消息监听失败',
              icon: 'none'
            })
            
            // 设置监听器为null，以便后续重试
            this.setData({
              messageListener: null
            })
            
            // 尝试重新启动监听
            setTimeout(() => {
              if (!this.data.messageListener) {
                this.startMessageListener()
              }
            }, 5000) // 延长重试时间到5秒
          }
        })
      
      // 保存监听器引用
      this.setData({
        messageListener: listener
      })
      
      console.log('消息监听器已启动')
    } catch (err) {
      console.error('创建消息监听器失败:', err)
      // 延迟后重试
      setTimeout(() => {
        this.startMessageListener()
      }, 5000)
    }
  },

  // 停止消息监听
  stopMessageListener: function() {
    if (this.data.messageListener) {
      try {
        // 检查连接状态后再关闭
        const listener = this.data.messageListener;
        if (listener && listener.close && typeof listener.close === 'function') {
          listener.close();
          console.log('消息监听器已关闭');
        }
      } catch (e) {
        console.error('关闭消息监听器时出错:', e);
      }
      this.setData({
        messageListener: null
      });
    }
  },

  // 输入事件处理
  onInput: function(e) {
    this.setData({
      inputMessage: e.detail.value
    })
  },

  // 发送消息
  sendMessage: function() {
    if (!this.data.inputMessage.trim()) return
    if (!this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    const content = this.data.inputMessage.trim()
    this.setData({
      inputMessage: ''
    })

    wx.cloud.callFunction({
      name: 'chat',
      data: {
        type: 'sendMessage',
        data: {
          content,
          userInfo: this.data.userInfo
        }
      }
    }).then(res => {
      if (!res.result.success) {
        wx.showToast({
          title: res.result.message || '发送失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      wx.showToast({
        title: '发送失败',
        icon: 'none'
      })
    })
  },

  // 格式化时间
  formatTime: function(timestamp) {
    if (!timestamp) return ''
    
    // 确保timestamp是数字
    const messageTime = typeof timestamp === 'number' ? timestamp : parseInt(timestamp)
    if (isNaN(messageTime)) {
      return ''
    }

    const messageDate = new Date(messageTime)
    if (isNaN(messageDate.getTime())) {
      return ''
    }

    const now = new Date()
    
    // 补零函数
    const padZero = (num) => {
      return num < 10 ? '0' + num : num
    }

    // 获取年月日时分
    const year = messageDate.getFullYear()
    const month = padZero(messageDate.getMonth() + 1)
    const day = padZero(messageDate.getDate())
    const hours = padZero(messageDate.getHours())
    const minutes = padZero(messageDate.getMinutes())

    // 判断是否是今天
    const isToday = 
      messageDate.getFullYear() === now.getFullYear() && 
      messageDate.getMonth() === now.getMonth() && 
      messageDate.getDate() === now.getDate()
    
    if (isToday) {
      return `${hours}:${minutes}`
    }
    
    // 判断是否是昨天
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = 
      messageDate.getFullYear() === yesterday.getFullYear() && 
      messageDate.getMonth() === yesterday.getMonth() && 
      messageDate.getDate() === yesterday.getDate()
    
    if (isYesterday) {
      return `昨天 ${hours}:${minutes}`
    }
    
    // 判断是否是今年
    const isThisYear = messageDate.getFullYear() === now.getFullYear()
    if (isThisYear) {
      return `${month}月${day}日 ${hours}:${minutes}`
    }
    
    // 更早的消息
    return `${year}年${month}月${day}日 ${hours}:${minutes}`
  },

  // 加载消息列表
  loadMessages: function() {
    if (this.data.loading) return Promise.resolve()

    this.setData({ loading: true })
    wx.showLoading({
      title: '加载中...',
    })

    return wx.cloud.callFunction({
      name: 'chat',
      data: {
        type: 'getMessages',
        data: {
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      }
    }).then(res => {
      if (res.result.success) {
        // 格式化时间
        const formattedList = res.result.data.map(item => {
          const isMyMessage = this.data.userInfo.openid === item.openid
          const timestamp = item.createTime
          
          return {
            ...item,
            createTime: this.formatTime(timestamp),
            timestamp: timestamp,
            isMyMessage: isMyMessage
          }
        })

        // 修改消息列表拼接顺序
        const newList = this.data.page === 1 ? 
          formattedList : 
          [...formattedList, ...this.data.messages]

        this.setData({
          messages: newList,
          hasMore: formattedList.length === this.data.pageSize
        }, () => {
          // 如果是第一页，滚动到最新消息
          if (this.data.page === 1 && newList.length > 0) {
            const lastMessage = newList[newList.length - 1]
            this.setData({
              scrollToMessage: `msg-${lastMessage._id}`
            })
          }
        })
      } else {
        wx.showToast({
          title: res.result.message || '获取消息失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      wx.showToast({
        title: '获取消息失败',
        icon: 'none'
      })
    }).finally(() => {
      this.setData({ loading: false })
      wx.hideLoading()
    })
  },

  // 加载更多消息
  loadMoreMessages: function() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({
        page: this.data.page + 1
      })
      this.loadMessages()
    }
  },

  onUnload: function() {
    // 页面卸载时，停止消息监听
    this.stopMessageListener()
  },

  // 处理头像加载错误
  handleAvatarError: function(e) {
    const messageId = e.currentTarget.dataset.id
    const messages = this.data.messages
    
    // 查找对应的消息并修改其头像
    const index = messages.findIndex(msg => msg._id === messageId)
    if (index !== -1) {
      // 使用setData的方式修改特定索引的头像URL
      this.setData({
        [`messages[${index}].avatarUrl`]: '/images/avatar-default.png'
      })
    }
  },

  // 输入框聚焦
  onInputFocus: function(e) {
    // 滚动到最新消息，添加延迟确保视图更新完成
    setTimeout(() => {
      if (this.data.messages.length > 0) {
        const lastMessage = this.data.messages[this.data.messages.length - 1]
        this.setData({
          scrollToMessage: `msg-${lastMessage._id}`
        })
      }
    }, 300) // 延迟300毫秒等待视图更新
  },

  // 键盘高度变化
  onKeyboardHeightChange: function(e) {
    const keyboardHeight = e.detail.height
    this.setData({
      keyboardHeight: keyboardHeight
    }, () => {
      // 滚动到最新消息，添加延迟确保视图更新完成
      setTimeout(() => {
        if (this.data.messages.length > 0) {
          const lastMessage = this.data.messages[this.data.messages.length - 1]
          this.setData({
            scrollToMessage: `msg-${lastMessage._id}`
          })
        }
      }, 300) // 延迟300毫秒等待视图更新
    })
  }
}) 