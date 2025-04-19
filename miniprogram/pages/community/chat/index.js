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
          createdAt: _.gt(now) // 只监听新消息
        })
        .watch({
          onChange: (snapshot) => {
            if (snapshot.docs && snapshot.docs.length > 0) {
              const newMessages = snapshot.docs.map(doc => {
                const isMyMessage = this.data.userInfo.openid === doc.openid
                return {
                  ...doc,
                  createdAt: this.formatTime(doc.createdAt),
                  timestamp: doc.createdAt,
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
    } catch (err) {
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
        }
      } catch (e) {
        // 关闭失败也继续执行后续代码
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
    
    // 非第一页加载时不显示加载提示，避免视图跳动
    if (this.data.page === 1) {
      wx.showLoading({
        title: '加载中...',
      })
    }

    // 如果是加载更多(不是第一页)，先记录当前一些关键信息用于保持滚动位置
    let originalFirstMessageId = null;
    
    // 第一页不需要记录锚点
    if (this.data.page > 1 && this.data.messages.length > 0) {
      // 使用当前显示的第一条消息作为锚点
      originalFirstMessageId = this.data.messages[0]._id;
      
      // 禁用滚动动画，避免加载历史消息时的闪烁
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 0
      })
    }

    // 设置超时保护，确保loading状态不会无限期挂起
    const loadingTimeout = setTimeout(() => {
      this.setData({ loading: false });
    }, 10000); // 10秒超时保护

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
      clearTimeout(loadingTimeout); // 清除超时保护
      
      if (res.result.success) {
        // 格式化时间
        const formattedList = res.result.data.map(item => {
          const isMyMessage = this.data.userInfo.openid === item.openid
          const timestamp = item.createdAt
          
          return {
            ...item,
            createdAt: this.formatTime(timestamp),
            timestamp: timestamp,
            isMyMessage: isMyMessage
          }
        })

        // 判断是否有新消息加载
        const hasNewMessages = formattedList.length > 0;
        
        // 加载第一页时或没有历史消息时的处理
        if (this.data.page === 1) {
          this.setData({
            messages: formattedList,
            hasMore: formattedList.length === this.data.pageSize,
            // 第一页加载完成后，滚动到最新消息
            scrollToMessage: hasNewMessages ? `msg-${formattedList[formattedList.length - 1]._id}` : '',
            loading: false // 确保loading状态被重置
          })
        } 
        // 加载历史消息时的处理（两阶段更新）
        else {
          // 第一阶段：先将新消息和现有消息合并，但不设置 scrollToMessage
          const newMessagesList = [...formattedList, ...this.data.messages];
          
          this.setData({
            messages: newMessagesList,
            hasMore: formattedList.length === this.data.pageSize,
            // 重要：先不设置滚动位置
            scrollToMessage: '',
            loading: false // 确保loading状态被重置
          }, () => {
            // 第二阶段：等DOM更新后，设置滚动位置到原来看到的第一条消息
            if (hasNewMessages && originalFirstMessageId) {
              // 使用 nextTick 确保视图已更新
              wx.nextTick(() => {
                this.setData({
                  scrollToMessage: `msg-${originalFirstMessageId}`
                })
              })
            }
          })
        }
      } else {
        // 出错时也要重置loading状态
        this.setData({ loading: false });
        wx.showToast({
          title: res.result.message || '获取消息失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      clearTimeout(loadingTimeout); // 清除超时保护
      this.setData({ loading: false }); // 确保出错时也重置loading状态
      
      wx.showToast({
        title: '获取消息失败',
        icon: 'none'
      })
    }).finally(() => {
      if (this.data.page === 1) {
        wx.hideLoading()
      }
    })
  },

  // 防抖控制变量
  _loadMoreTimerId: null,
  _isScrollingUp: false,
  
  // 加载更多消息（防抖处理）
  loadMoreMessages: function() {
    // 清除之前的定时器
    if (this._loadMoreTimerId) {
      clearTimeout(this._loadMoreTimerId);
    }
    
    // 如果正在滚动，先标记状态，稍后处理
    this._isScrollingUp = true;
    
    // 如果已经在加载中，不要重复触发
    if (this.data.loading) {
      return;
    }
    
    // 延迟200ms执行，避免快速滚动触发多次加载
    this._loadMoreTimerId = setTimeout(() => {
      // 只有当有更多消息可加载，且当前不在加载状态时才处理
      if (this.data.hasMore && !this.data.loading && this._isScrollingUp) {
        
        // 禁用滚动动画，避免闪烁
        if (this.data.messages.length > 0) {
          // 清空滚动定位，避免加载时的位置跳动
          this.setData({
            scrollToMessage: ''
          });
        }
        
        // 更新页码
        this.setData({
          page: this.data.page + 1
        });
        
        // 直接调用loadMessages，而不是在这里设置loading状态
        this.loadMessages().then(() => {
          // 重置滚动状态
          this._isScrollingUp = false;
        }).catch(err => {
          // 加载失败时，恢复页码
          this.setData({
            page: Math.max(1, this.data.page - 1)
          });
          // 重置滚动状态
          this._isScrollingUp = false;
        });
      } else if (!this.data.hasMore && this.data.page > 1 && !this.data.loading) {
        // 重置滚动状态
        this._isScrollingUp = false;
      } else {
        // 其他情况也重置滚动状态
        this._isScrollingUp = false;
      }
    }, 200);
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