Page({
  data: {
    schools: [],
    searchKeyword: '',
    regionFilter: '',
    levelFilter: '',
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: false,
    regions: ['', '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆'],
    levels: ['', '985', '211', '双一流', '双非']
  },

  onLoad() {
    this.loadSchools()
  },

  // 加载院校列表
  async loadSchools(isLoadMore = false) {
    if (this.data.isLoading) return
    
    this.setData({ isLoading: true })
    
    if (!isLoadMore) {
      wx.showLoading({
        title: '加载中...',
        mask: true
      })
    }
    
    try {
      const { page, pageSize, searchKeyword, regionFilter, levelFilter } = this.data
      
      // 调用云函数获取院校列表
      const result = await wx.cloud.callFunction({
        name: 'school',
        data: {
          type: 'getSchools',
          data: {
            keyword: searchKeyword,
            region: regionFilter,
            level: levelFilter,
            page,
            pageSize
          }
        }
      })
      
      const { code, data, msg } = result.result
      
      if (code === 0 && data) {
        // 更新数据
        this.setData({
          schools: isLoadMore ? [...this.data.schools, ...data.list] : data.list,
          hasMore: data.hasMore,
          isLoading: false
        })
      } else {
        wx.showToast({
          title: msg || '加载失败',
          icon: 'none'
        })
        this.setData({ isLoading: false })
      }
    } catch (err) {
      console.error('加载院校列表失败：', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      this.setData({ isLoading: false })
    } finally {
      if (!isLoadMore) {
        wx.hideLoading()
      }
    }
  },

  // 搜索输入
  onSearchInput(e) {
    const value = e.detail.value
    this.setData({
      searchKeyword: value,
      page: 1
    }, () => {
      // 使用防抖处理搜索
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
      }
      this.searchTimer = setTimeout(() => {
        this.loadSchools()
      }, 300)
    })
  },

  // 地区筛选
  onRegionFilter(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      regionFilter: value,
      page: 1
    }, () => {
      this.loadSchools()
    })
  },

  // 层次筛选
  onLevelFilter(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      levelFilter: value,
      page: 1
    }, () => {
      this.loadSchools()
    })
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.setData({
        page: this.data.page + 1
      }, () => {
        this.loadSchools(true)
      })
    }
  },

  // 点击院校
  onSchoolTap(e) {
    const schoolId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/school/detail/index?id=${schoolId}`
    })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1
    }, () => {
      this.loadSchools().then(() => {
        wx.stopPullDownRefresh()
      })
    })
  }
}) 